use itertools::Itertools;
use smallvec::{smallvec, SmallVec};
use std::fmt;

use super::{
    ArraySize, Axis, FormulaError, FormulaErrorMsg, FormulaResult, FormulaResultExt, Span,
    SpannableIterExt, Spanned, Unspan,
};

const CURRENCY_PREFIXES: &[char] = &['$', '¥', '£', '€'];

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Single(BasicValue),
    Array(Array),
}
impl Default for Value {
    fn default() -> Self {
        Value::Single(BasicValue::default())
    }
}
impl fmt::Display for Value {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Value::Single(v) => write!(f, "{v}"),
            Value::Array(a) => write!(f, "{a}"),
        }
    }
}

impl<T: Into<BasicValue>> From<T> for Value {
    fn from(value: T) -> Self {
        Value::Single(value.into())
    }
}
impl From<Array> for Value {
    fn from(array: Array) -> Self {
        Value::Array(array)
    }
}

impl Value {
    pub fn basic_value(&self) -> Result<&BasicValue, FormulaErrorMsg> {
        match self {
            Value::Single(value) => Ok(value),
            Value::Array(a) => a.basic_value().ok_or_else(|| FormulaErrorMsg::Expected {
                expected: "single value".into(),
                got: Some(a.type_name().into()),
            }),
        }
    }
    pub fn into_basic_value(self) -> Result<BasicValue, FormulaErrorMsg> {
        match self {
            Value::Single(value) => Ok(value),
            Value::Array(a) => a.into_basic_value().map_err(|a| FormulaErrorMsg::Expected {
                expected: "single value".into(),
                got: Some(a.type_name().into()),
            }),
        }
    }
    pub fn basic_values_slice(&self) -> &[BasicValue] {
        match self {
            Value::Single(value) => std::slice::from_ref(value),
            Value::Array(array) => &array.values,
        }
    }

    /// Returns a formula-source-code representation of the value.
    pub fn repr(&self) -> String {
        match self {
            Value::Single(value) => value.repr(),
            Value::Array(array) => array.repr(),
        }
    }

    /// Replaces NaN and Inf with errors; otherwise returns the value
    /// unchanged.
    pub fn purify_floats(self, span: Span) -> FormulaResult<Self> {
        match self {
            Value::Single(v) => v.purify_float(span).map(Value::Single),
            Value::Array(a) => a.purify_floats(span).map(Value::Array),
        }
    }

    /// Returns the unique width and height that fits all of `values`.
    ///
    /// - If `values` does not contain any arrays, returns `(1, 1)`.
    /// - Sizes of `1` are ignored.
    /// - If there are multiple unequal sizes greater than one, returns an
    ///   error.
    /// - Both numbers returned are always nonzero.
    pub fn common_array_size<'a>(
        values: impl Copy + IntoIterator<Item = &'a Spanned<Value>>,
    ) -> FormulaResult<ArraySize> {
        Ok(ArraySize {
            w: Array::common_len(Axis::X, values.into_iter().filter_map(|v| v.as_array()))?,
            h: Array::common_len(Axis::Y, values.into_iter().filter_map(|v| v.as_array()))?,
        })
    }
}
impl Spanned<Value> {
    pub fn basic_value(&self) -> FormulaResult<Spanned<&BasicValue>> {
        self.inner.basic_value().with_span(self.span)
    }
    pub fn into_basic_value(self) -> FormulaResult<Spanned<BasicValue>> {
        self.inner.into_basic_value().with_span(self.span)
    }
    pub fn as_array(&self) -> Option<Spanned<&Array>> {
        match &self.inner {
            Value::Single(_) => None,
            Value::Array(array) => Some(Spanned {
                span: self.span,
                inner: array,
            }),
        }
    }

    /// Returns the value from an array if this is an array value, or the single
    /// value itself otherwise. If the array index is out of bounds, returns an
    /// internal error.
    pub fn get(&self, x: u32, y: u32) -> FormulaResult<Spanned<&BasicValue>> {
        match &self.inner {
            Value::Single(value) => Ok(value),
            Value::Array(a) => a.get(x, y),
        }
        .with_span(self.span)
    }

    /// Iterates over an array, converting values to a particular type. If a
    /// value cannot be converted, it is ignored.
    pub fn into_iter<T>(self) -> impl Iterator<Item = FormulaResult<Spanned<T>>>
    where
        BasicValue: TryInto<T, Error = FormulaErrorMsg>,
    {
        // Ignore array values that fail to coerce, but return an error for a
        // single value that fails to coerce. This is consistent with Excel
        // semantics.

        let mut single_value: Option<FormulaResult<Spanned<T>>> = None;
        let mut array: SmallVec<[BasicValue; 1]> = smallvec![];
        match self.inner {
            Value::Single(v) => {
                let v = Spanned {
                    inner: v,
                    span: self.span,
                };
                single_value = Some(v.try_coerce::<T>())
            }
            Value::Array(a) => array = a.values,
        };

        itertools::chain!(
            single_value,
            array
                .into_iter()
                .with_all_same_span(self.span)
                .flat_map(|v| v.coerce_or_none::<T>())
        )
    }
    /// Returns an iterator over basic values
    pub fn iter_basic_values(&self) -> impl Iterator<Item = Spanned<&BasicValue>> {
        self.inner
            .basic_values_slice()
            .iter()
            .map(move |v| Spanned {
                span: self.span,
                inner: v,
            })
    }
    /// Returns an iterator over basic values.
    pub fn into_iter_basic_values(
        self,
    ) -> impl Iterator<Item = FormulaResult<Spanned<BasicValue>>> {
        let span = self.span;

        match self.inner {
            Value::Single(value) => smallvec![value],
            Value::Array(array) => array.values,
        }
        .into_iter()
        .with_all_same_span(self.span)
        .map(move |v| {
            v.into_non_error_value()
                .map(|inner| Spanned { span, inner })
        })
    }
}

/// 2D array of values in the formula language. The array may be a single value
/// (1x1) but must not be degenerate (zero width or zero height).
#[derive(Debug, Clone, PartialEq)]
pub struct Array {
    /// Number of columns, which may be any positive integer (but not zero).
    width: u32,
    /// Number of rows, which may be any positive integer (but not zero).
    height: u32,
    /// Flattened array of `width * height` many values, stored in row-major
    /// order.
    values: SmallVec<[BasicValue; 1]>,
}
impl fmt::Display for Array {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{{")?;
        let mut is_first_row = true;
        for row in self.rows() {
            if is_first_row {
                is_first_row = false;
            } else {
                write!(f, "; ")?;
            }
            let mut is_first_value = true;
            for value in row {
                if is_first_value {
                    is_first_value = false;
                } else {
                    write!(f, ", ")?;
                }
                write!(f, "{value}")?;
            }
        }
        write!(f, "}}")?;
        Ok(())
    }
}

impl From<BasicValue> for Array {
    fn from(value: BasicValue) -> Self {
        Array {
            width: 1,
            height: 1,
            values: smallvec![value],
        }
    }
}
impl From<Value> for Array {
    fn from(value: Value) -> Self {
        match value {
            Value::Single(value) => Array::from(value),
            Value::Array(array) => array,
        }
    }
}

impl Array {
    /// Constructs an array from an iterator in row-major order.
    pub fn new_row_major(
        width: u32,
        height: u32,
        values: SmallVec<[BasicValue; 1]>,
    ) -> FormulaResult<Self> {
        if width > 0 && height > 0 && values.len() == width as usize * height as usize {
            Ok(Self {
                width,
                height,
                values,
            })
        } else {
            internal_error!(
                "bad array dimensions {}x{} ({} values)",
                width,
                height,
                values.len(),
            )
        }
    }
    /// Returns a formula-source-code representation of the value.
    pub fn repr(&self) -> String {
        format!(
            "{{{}}}",
            self.rows()
                .map(|row| row.iter().map(|v| v.repr()).join(", "))
                .join("; "),
        )
    }

    /// Transposes an array (swaps rows and columns). This is an expensive
    /// operation for large arrays.
    pub fn transpose(&self) -> Array {
        let width = self.height;
        let height = self.width;
        let values = Self::indices(width, height)
            .map(|(x, y)| self.get(y, x).unwrap().clone())
            .collect();
        Self::new_row_major(width, height, values).unwrap()
    }
    /// Flips an array horizontally. This is an expensive operation for large
    /// arrays.
    pub fn flip_horizontally(&self) -> Array {
        let ArraySize { w, h } = self.array_size();
        Self::new_row_major(
            w,
            h,
            self.rows()
                .map(|row| row.iter().rev().cloned())
                .flatten()
                .collect(),
        )
        .unwrap()
    }
    /// Flips an array vertically. This is an expensive operation for large
    /// arrays.
    pub fn flip_vertically(&self) -> Array {
        let ArraySize { w, h } = self.array_size();
        Self::new_row_major(w, h, self.rows().rev().flatten().cloned().collect()).unwrap()
    }

    /// Returns an iterator over `(x, y)` array indices in canonical order.
    pub fn indices(width: u32, height: u32) -> impl Iterator<Item = (u32, u32)> {
        itertools::iproduct!(0..height, 0..width).map(|(y, x)| (x, y))
    }

    /// Returns the width of an array.
    pub fn width(&self) -> u32 {
        self.width
    }
    /// Returns the height of an array.
    pub fn height(&self) -> u32 {
        self.height
    }
    /// Returns the width and height of an array.
    pub fn array_size(&self) -> ArraySize {
        ArraySize {
            w: self.width,
            h: self.height,
        }
    }
    /// Returns an iterator over the rows of the array.
    pub fn rows(&self) -> std::slice::Chunks<'_, BasicValue> {
        self.values.chunks(self.width as usize)
    }

    /// Returns the only basic value in a 1x1 array, or an error if this is not
    /// a 1x1 array.
    pub fn into_basic_value(self) -> Result<BasicValue, Self> {
        if self.values.len() == 1 {
            Ok(self.values.into_iter().next().unwrap())
        } else {
            Err(self)
        }
    }
    /// Returns a reference to the only basic value in a 1x1 array, or an error
    /// if this is not a 1x1 array.
    pub fn basic_value(&self) -> Option<&BasicValue> {
        if self.values.len() == 1 {
            self.values.get(0)
        } else {
            None
        }
    }
    /// Returns the value at a given position in an array. If the width is 1,
    /// then `x` is ignored. If the height is 1, then `y` is ignored. Otherwise,
    /// returns an error if a coordinate is out of bounds.
    pub fn get(&self, x: u32, y: u32) -> Result<&BasicValue, FormulaErrorMsg> {
        let i = self.array_size().flatten_index(x, y)?;
        Ok(&self.values[i])
    }
    /// Returns a flat slice of basic values in the array.
    pub fn basic_values_slice(&self) -> &[BasicValue] {
        &self.values
    }

    /// Returns a human-friendly string describing the type of value.
    pub fn type_name(&self) -> &'static str {
        match self.basic_value() {
            Some(v) => v.type_name(),
            None => "array",
        }
    }

    /// Replaces NaN and Inf with errors; otherwise returns the value
    /// unchanged.
    pub fn purify_floats(mut self, span: Span) -> FormulaResult<Self> {
        for v in &mut self.values {
            *v = std::mem::take(v).purify_float(span)?;
        }
        Ok(self)
    }

    /// Returns the unique length that fits all `values` along `axis`. See
    /// `common_array_size()` for more.
    pub fn common_len<'a>(
        axis: Axis,
        arrays: impl IntoIterator<Item = Spanned<&'a Array>>,
    ) -> FormulaResult<u32> {
        let mut common_len = 1;

        for array in arrays {
            let new_array_len = array.inner.array_size()[axis];
            match (common_len, new_array_len) {
                (a, b) if a == b => continue,
                (_, 1) => continue,
                (1, l) => common_len = l,
                _ => {
                    return Err(FormulaErrorMsg::ArrayAxisMismatch {
                        axis,
                        expected: common_len,
                        got: new_array_len,
                    }
                    .with_span(array.span))
                }
            }
        }

        Ok(common_len)
    }
}
impl Spanned<Array> {
    /// Checks that an array is linear (width=1 or height=1), then returns which
    /// is the long axis. Returns `None` in the case of a 1x1 array.
    pub fn array_linear_axis(&self) -> FormulaResult<Option<Axis>> {
        match self.inner.array_size() {
            ArraySize { w: 1, h: 1 } => Ok(None),
            ArraySize { w: _, h: 1 } => Ok(Some(Axis::X)),
            ArraySize { w: 1, h: _ } => Ok(Some(Axis::Y)),
            _ => Err(FormulaErrorMsg::NonLinearArray.with_span(self.span)),
        }
    }
    /// Checks that an array is linear along a particular axis, then returns the
    /// length along that axis.
    pub fn array_linear_length(&self, axis: Axis) -> FormulaResult<u32> {
        self.check_array_size_on(axis.other_axis(), 1)?;
        Ok(self.inner.array_size()[axis])
    }

    /// Checks the size of the array on one axis, returning an error if it does
    /// not match exactly.
    pub fn check_array_size_on(&self, axis: Axis, len: u32) -> FormulaResult<()> {
        let expected = len;
        let got = self.inner.array_size()[axis];
        if expected == got {
            Ok(())
        } else {
            Err(FormulaErrorMsg::ExactArrayAxisMismatch {
                axis,
                expected,
                got,
            }
            .with_span(self.span))
        }
    }

    /// Checks the size of the array, returning an error if it does not match
    /// exactly.
    pub fn check_array_size_exact(&self, size: ArraySize) -> FormulaResult<()> {
        let expected = size;
        let got = self.inner.array_size();
        if expected == got {
            Ok(())
        } else {
            Err(FormulaErrorMsg::ExactArraySizeMismatch { expected, got }.with_span(self.span))
        }
    }
}

/// Non-array value in the formula language.
#[derive(Debug, Default, Clone, PartialEq)]
pub enum BasicValue {
    /// Blank cell, which contains nothing.
    #[default]
    Blank,
    /// Empty string.
    String(String),
    /// Numeric value.
    Number(f64),
    /// Logical value.
    Bool(bool),
    /// Error value.
    Err(Box<FormulaError>),
}
impl fmt::Display for BasicValue {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BasicValue::Blank => write!(f, ""),
            BasicValue::String(s) => write!(f, "{s}"),
            BasicValue::Number(n) => write!(f, "{n}"),
            BasicValue::Bool(true) => write!(f, "TRUE"),
            BasicValue::Bool(false) => write!(f, "FALSE"),
            BasicValue::Err(e) => write!(f, "{}", e.msg),
        }
    }
}
/// Implement `AsRef` so we can use `impl AsRef<BasicValue>` to be generic over
/// `BasicValue` and `&BasicValue`.
impl AsRef<BasicValue> for BasicValue {
    fn as_ref(&self) -> &BasicValue {
        self
    }
}

impl BasicValue {
    /// Returns a human-friendly string describing the type of value.
    pub fn type_name(&self) -> &'static str {
        match self {
            BasicValue::Blank => "blank",
            BasicValue::String(_) => "text",
            BasicValue::Number(_) => "number",
            BasicValue::Bool(_) => "boolean",
            BasicValue::Err(_) => "error",
        }
    }
    /// Returns a formula-source-code representation of the value.
    pub fn repr(&self) -> String {
        match self {
            BasicValue::Blank => String::new(),
            BasicValue::String(s) => format!("{s:?}"),
            BasicValue::Number(n) => n.to_string(),
            BasicValue::Bool(b) => match b {
                true => "TRUE".to_string(),
                false => "FALSE".to_string(),
            },
            BasicValue::Err(_) => format!("[error]"),
        }
    }

    pub fn is_blank_or_empty_string(&self) -> bool {
        self.is_blank() || *self == BasicValue::String(String::new())
    }
    /// Returns the contained error, if this is an error value.
    pub fn error(&self) -> Option<&FormulaError> {
        match self {
            BasicValue::Err(e) => Some(e),
            _ => None,
        }
    }

    /// Coerces the value to a specific type; returns `None` if the conversion
    /// fails or the original value is `None`.
    pub fn coerce_nonblank<'a, T>(&'a self) -> Option<T>
    where
        &'a BasicValue: TryInto<T>,
    {
        match self.is_blank() {
            true => None,
            false => self.try_into().ok(),
        }
    }

    /// Compares two values but propogates errors and returns `None` in the case
    /// of disparate types.
    pub fn partial_cmp(&self, other: &Self) -> FormulaResult<Option<std::cmp::Ordering>> {
        Ok(Some(match (self, other) {
            (BasicValue::Err(e), _) | (_, BasicValue::Err(e)) => return Err((**e).clone()),

            (BasicValue::Number(a), BasicValue::Number(b)) => a.total_cmp(&b),
            (BasicValue::String(a), BasicValue::String(b)) => {
                let a = a.to_ascii_uppercase();
                let b = b.to_ascii_uppercase();
                a.cmp(&b)
            }
            (BasicValue::Bool(a), BasicValue::Bool(b)) => a.cmp(b),
            (BasicValue::Blank, BasicValue::Blank) => std::cmp::Ordering::Equal,

            (BasicValue::Number(_), _)
            | (BasicValue::String(_), _)
            | (BasicValue::Bool(_), _)
            | (BasicValue::Blank, _) => return Ok(None),
        }))
    }

    /// Compares two values using a total ordering that propogates errors and
    /// converts blanks to zeros.
    pub fn cmp(&self, other: &Self) -> FormulaResult<std::cmp::Ordering> {
        fn type_id(v: &BasicValue) -> u8 {
            // Sort order, based on the results of Excel's `SORT()` function.
            // The comparison operators are the same, except that blank coerces
            // to zero before comparison.
            match v {
                BasicValue::Number(_) => 0,
                BasicValue::String(_) => 1,
                BasicValue::Bool(_) => 2,
                BasicValue::Err(_) => 3,
                BasicValue::Blank => 4,
            }
        }

        let mut lhs = self;
        let mut rhs = other;
        if lhs.is_blank() {
            lhs = &BasicValue::Number(0.0);
        }
        if rhs.is_blank() {
            rhs = &BasicValue::Number(0.0);
        }

        Ok(lhs
            .partial_cmp(rhs)?
            .unwrap_or_else(|| type_id(lhs).cmp(&type_id(rhs))))
    }

    /// Returns whether `self == other` using `BasicValue::cmp()`.
    pub fn eq(&self, other: &Self) -> FormulaResult<bool> {
        Ok(self.cmp(other)? == std::cmp::Ordering::Equal)
    }
    /// Returns whether `self < other` using `BasicValue::cmp()`.
    pub fn lt(&self, other: &Self) -> FormulaResult<bool> {
        Ok(self.cmp(other)? == std::cmp::Ordering::Less)
    }
    /// Returns whether `self > other` using `BasicValue::cmp()`.
    pub fn gt(&self, other: &Self) -> FormulaResult<bool> {
        Ok(self.cmp(other)? == std::cmp::Ordering::Greater)
    }
    /// Returns whether `self <= other` using `BasicValue::cmp()`.
    pub fn lte(&self, other: &Self) -> FormulaResult<bool> {
        Ok(matches!(
            self.cmp(other)?,
            std::cmp::Ordering::Less | std::cmp::Ordering::Equal,
        ))
    }
    /// Returns whether `self >= other` using `BasicValue::cmp()`.
    pub fn gte(&self, other: &Self) -> FormulaResult<bool> {
        Ok(matches!(
            self.cmp(other)?,
            std::cmp::Ordering::Greater | std::cmp::Ordering::Equal,
        ))
    }

    /// Replaces NaN and Inf with an error; otherwise returns the value
    /// unchanged.
    pub fn purify_float(self, span: Span) -> FormulaResult<Self> {
        match self {
            BasicValue::Number(n) if n.is_nan() => Err(FormulaErrorMsg::NotANumber.with_span(span)),
            BasicValue::Number(n) if n.is_infinite() => {
                Err(FormulaErrorMsg::Infinity.with_span(span))
            }
            other_single_value => Ok(other_single_value),
        }
    }
}

/*
 * CONVERSIONS (specific type -> Value)
 */

impl From<()> for BasicValue {
    fn from(_: ()) -> Self {
        BasicValue::Blank
    }
}
impl<T> From<Option<T>> for BasicValue
where
    T: Into<BasicValue>,
{
    fn from(value: Option<T>) -> Self {
        match value {
            Some(v) => v.into(),
            None => BasicValue::Blank,
        }
    }
}
impl From<String> for BasicValue {
    fn from(value: String) -> Self {
        BasicValue::String(value)
    }
}
impl From<&str> for BasicValue {
    fn from(value: &str) -> Self {
        BasicValue::String(value.to_string())
    }
}
impl From<f64> for BasicValue {
    fn from(value: f64) -> Self {
        BasicValue::Number(value)
    }
}
impl From<i64> for BasicValue {
    fn from(value: i64) -> Self {
        BasicValue::Number(value as f64)
    }
}
impl From<i32> for BasicValue {
    fn from(value: i32) -> Self {
        BasicValue::Number(value as f64)
    }
}
impl From<u32> for BasicValue {
    fn from(value: u32) -> Self {
        BasicValue::Number(value as f64)
    }
}
impl From<bool> for BasicValue {
    fn from(value: bool) -> Self {
        BasicValue::Bool(value)
    }
}
impl<T> From<FormulaResult<T>> for BasicValue
where
    BasicValue: From<T>,
{
    fn from(result: FormulaResult<T>) -> Self {
        match result {
            Ok(v) => v.into(),
            Err(e) => BasicValue::Err(Box::new(e)),
        }
    }
}

/*
 * CONVERSIONS (Value -> specific type)
 */

impl<'a> TryFrom<&'a BasicValue> for String {
    type Error = FormulaErrorMsg;

    fn try_from(value: &'a BasicValue) -> Result<Self, Self::Error> {
        // All types can coerce to string.
        match value {
            BasicValue::Blank => Ok(String::new()),
            BasicValue::String(s) => Ok(s.clone()),
            BasicValue::Number(n) => Ok(n.to_string()),
            BasicValue::Bool(true) => Ok("TRUE".to_string()),
            BasicValue::Bool(false) => Ok("FALSE".to_string()),
            BasicValue::Err(e) => Err(e.msg.clone()),
        }
    }
}
impl<'a> TryFrom<&'a BasicValue> for f64 {
    type Error = FormulaErrorMsg;

    fn try_from(value: &'a BasicValue) -> Result<Self, Self::Error> {
        // TODO: maybe remove string conversions once we have a stricter type system?
        match value {
            BasicValue::Blank => Ok(0.0),
            BasicValue::String(s) => {
                let mut s = s.trim();
                if s.is_empty() {
                    return Ok(0.0);
                }
                if let Some(rest) = s.strip_prefix(CURRENCY_PREFIXES) {
                    s = rest;
                }
                s.parse().map_err(|_| FormulaErrorMsg::Expected {
                    expected: "number".into(),
                    got: Some(value.type_name().into()),
                })
            }
            BasicValue::Number(n) => Ok(*n),
            BasicValue::Bool(true) => Ok(1.0),
            BasicValue::Bool(false) => Ok(0.0),
            BasicValue::Err(e) => Err(e.msg.clone()),
        }
    }
}
impl<'a> TryFrom<&'a BasicValue> for i64 {
    type Error = FormulaErrorMsg;

    fn try_from(value: &'a BasicValue) -> Result<Self, Self::Error> {
        Ok(f64::try_from(value)?.round() as i64) // TODO: should be floor for excel compat
    }
}
impl<'a> TryFrom<&'a BasicValue> for u32 {
    type Error = FormulaErrorMsg;

    fn try_from(value: &'a BasicValue) -> Result<Self, Self::Error> {
        Ok(f64::try_from(value)?.round() as u32) // TODO: should be floor for excel compat
    }
}
impl<'a> TryFrom<&'a BasicValue> for bool {
    type Error = FormulaErrorMsg;

    fn try_from(value: &'a BasicValue) -> Result<Self, Self::Error> {
        // TODO: remove string conversions once we have a stricter type system
        match value {
            BasicValue::Blank => Ok(false),
            BasicValue::String(s) if s.eq_ignore_ascii_case("TRUE") => Ok(true),
            BasicValue::String(s) if s.eq_ignore_ascii_case("FALSE") => Ok(false),
            BasicValue::Number(n) => Ok(*n != 0.0),
            BasicValue::Bool(b) => Ok(*b),
            _ => Err(FormulaErrorMsg::Expected {
                expected: "boolean".into(),
                got: Some(value.type_name().into()),
            }),
        }
    }
}

impl TryFrom<BasicValue> for String {
    type Error = FormulaErrorMsg;

    fn try_from(value: BasicValue) -> Result<Self, Self::Error> {
        // All types can coerce to string.
        match value {
            BasicValue::String(s) => Ok(s),
            other => String::try_from(&other),
        }
    }
}
macro_rules! impl_try_from_basic_value_for {
    ($type:ty) => {
        impl TryFrom<BasicValue> for $type {
            type Error = FormulaErrorMsg;

            fn try_from(value: BasicValue) -> Result<Self, Self::Error> {
                <$type>::try_from(&value)
            }
        }
    };
}
impl_try_from_basic_value_for!(f64);
impl_try_from_basic_value_for!(i64);
impl_try_from_basic_value_for!(bool);

macro_rules! impl_try_from_value_for {
    ($type:ty) => {
        impl<'a> TryFrom<&'a Value> for $type {
            type Error = FormulaErrorMsg;

            fn try_from(value: &'a Value) -> Result<Self, Self::Error> {
                value.basic_value()?.try_into()
            }
        }
        impl TryFrom<Value> for $type {
            type Error = FormulaErrorMsg;

            fn try_from(value: Value) -> Result<Self, Self::Error> {
                value.into_basic_value()?.try_into()
            }
        }
    };
}
impl_try_from_value_for!(String);
impl_try_from_value_for!(f64);
impl_try_from_value_for!(i64);
impl_try_from_value_for!(bool);

impl<'a> TryFrom<&'a Value> for &'a BasicValue {
    type Error = FormulaErrorMsg;

    fn try_from(value: &'a Value) -> Result<Self, Self::Error> {
        value.basic_value()
    }
}
impl TryFrom<Value> for BasicValue {
    type Error = FormulaErrorMsg;

    fn try_from(value: Value) -> Result<Self, Self::Error> {
        value.into_basic_value()
    }
}

/// Coercion from `Value` or `BasicValue` into a particular Rust type.
pub trait CoerceInto: Sized + Unspan
where
    for<'a> &'a Self: Into<Span>,
    Self::Unspanned: IsBlank,
{
    fn into_non_error_value(self) -> FormulaResult<Self::Unspanned>;

    /// Coerces a value, returning an error if the value has the wrong type.
    fn try_coerce<T>(self) -> FormulaResult<Spanned<T>>
    where
        Self::Unspanned: TryInto<T, Error = FormulaErrorMsg>,
    {
        let span = (&self).into();

        // If coercion fails, return an error.
        self.into_non_error_value()?.try_into().with_span(span)
    }

    /// Coerces a value, returning `None` if the value has the wrong type and
    /// `Some(Err)` only if the value is itself an error value.
    fn coerce_or_none<T>(self) -> Option<FormulaResult<Spanned<T>>>
    where
        Self::Unspanned: TryInto<T, Error = FormulaErrorMsg>,
    {
        let span = (&self).into();

        match self.into_non_error_value() {
            // Propagate errors.
            Err(e) => Some(Err(e)),
            // If coercion fails, return `None`.
            Ok(value) => value.coerce_nonblank().map(|v| Ok(v).with_span(span)),
        }
    }
}

impl<'a> CoerceInto for Spanned<&'a BasicValue> {
    fn into_non_error_value(self) -> FormulaResult<&'a BasicValue> {
        match self.inner {
            BasicValue::Err(e) => Err((**e).clone()),
            other => Ok(other),
        }
    }
}
impl CoerceInto for Spanned<BasicValue> {
    fn into_non_error_value(self) -> FormulaResult<BasicValue> {
        match self.inner {
            BasicValue::Err(e) => Err(*e),
            other => Ok(other),
        }
    }
}

impl<'a> CoerceInto for Spanned<&'a Value> {
    fn into_non_error_value(self) -> FormulaResult<&'a Value> {
        match &self.inner {
            Value::Single(BasicValue::Err(e)) => Err((**e).clone()),
            other => Ok(other),
        }
    }
}
impl CoerceInto for Spanned<Value> {
    fn into_non_error_value(self) -> FormulaResult<Value> {
        match self.inner {
            Value::Single(BasicValue::Err(e)) => Err(*e),
            other => Ok(other),
        }
    }
}

pub trait IsBlank {
    /// Returns whether the value is blank. The empty string is considered
    /// non-blank.
    fn is_blank(&self) -> bool;

    /// Coerces the value to a specific type; returns `None` if the conversion
    /// fails or the original value is blank.
    fn coerce_nonblank<'a, T>(self) -> Option<T>
    where
        Self: TryInto<T>,
    {
        match self.is_blank() {
            true => None,
            false => self.try_into().ok(),
        }
    }
}
impl<T: IsBlank> IsBlank for &'_ T {
    fn is_blank(&self) -> bool {
        (*self).is_blank()
    }
}

impl IsBlank for Value {
    fn is_blank(&self) -> bool {
        match self {
            Value::Single(v) => v.is_blank(),
            Value::Array(a) => a.values.iter().all(|v| v.is_blank()),
        }
    }
}

impl IsBlank for BasicValue {
    fn is_blank(&self) -> bool {
        matches!(self, BasicValue::Blank)
    }
}

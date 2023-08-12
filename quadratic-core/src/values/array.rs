use std::fmt;

use itertools::Itertools;
use rand::Rng;
use serde::{Deserialize, Serialize};
use smallvec::{smallvec, SmallVec};

use super::{ArraySize, Axis, CellValue, Span, Spanned, Value};
use crate::{CodeResult, ErrorMsg};

#[macro_export]
macro_rules! array {
    ($( $( $value:expr ),+ );+ $(;)?) => {{
        let values = [$( [$( $crate::CellValue::from($value) ),+] ),+];
        let height = values.len();
        let width = values[0].len(); // This will generate a compile-time error if there are no values.
        $crate::Array::new_row_major(
            width as u32,
            height as u32,
            values.into_iter().flatten().collect(),
        )
        .unwrap()
    }};
}

/// 2D array of values in the formula language. The array may be a single value
/// (1x1) but must not be degenerate (zero width or zero height).
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct Array {
    /// Number of columns, which may be any positive integer (but not zero).
    width: u32,
    /// Number of rows, which may be any positive integer (but not zero).
    height: u32,
    /// Flattened array of `width * height` many values, stored in row-major
    /// order.
    values: SmallVec<[CellValue; 1]>,
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

impl From<CellValue> for Array {
    fn from(value: CellValue) -> Self {
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
    /// Constructs an array of blank values.
    pub fn new_empty(width: u32, height: u32) -> CodeResult<Self> {
        let values = smallvec![CellValue::Blank; (width * height) as usize];
        Self::new_row_major(width, height, values)
    }
    /// Constructs an array of random float values.
    pub fn from_random_floats(width: u32, height: u32) -> CodeResult<Self> {
        let mut rng = rand::thread_rng();
        let values =
            std::iter::from_fn(|| Some(CellValue::Number(rng.gen_range(-100..=100) as f64)))
                .take((width * height) as usize)
                .collect();
        Self::new_row_major(width, height, values)
    }
    /// Constructs an array from a list of values in row-major order.
    pub fn new_row_major(
        width: u32,
        height: u32,
        values: SmallVec<[CellValue; 1]>,
    ) -> CodeResult<Self> {
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
    pub fn rows(&self) -> std::slice::Chunks<'_, CellValue> {
        self.values.chunks(self.width as usize)
    }

    /// Returns the only cell value in a 1x1 array, or an error if this is not a
    /// 1x1 array.
    pub fn into_cell_value(self) -> Result<CellValue, Self> {
        if self.values.len() == 1 {
            Ok(self.values.into_iter().next().unwrap())
        } else {
            Err(self)
        }
    }
    /// Returns a reference to the only cell value in a 1x1 array, or an error
    /// if this is not a 1x1 array.
    pub fn cell_value(&self) -> Option<&CellValue> {
        if self.values.len() == 1 {
            self.values.get(0)
        } else {
            None
        }
    }
    /// Returns the value at a given position in an array. If the width is 1,
    /// then `x` is ignored. If the height is 1, then `y` is ignored. Otherwise,
    /// returns an error if a coordinate is out of bounds.
    pub fn get(&self, x: u32, y: u32) -> Result<&CellValue, ErrorMsg> {
        let i = self.array_size().flatten_index(x, y)?;
        Ok(&self.values[i])
    }
    /// Sets the value at a given position in an array. Returns an error if `x`
    /// or `y` is out of range.
    pub fn set(&mut self, x: u32, y: u32, value: CellValue) -> Result<(), ErrorMsg> {
        let i = self.array_size().flatten_index(x, y)?;
        self.values[i] = value;
        Ok(())
    }
    /// Returns a flat slice of cell values in the array.
    pub fn cell_values_slice(&self) -> &[CellValue] {
        &self.values
    }
    /// Returns a flat `SmallVec` of cell values in the array.
    pub fn into_cell_values_vec(self) -> SmallVec<[CellValue; 1]> {
        self.values
    }

    /// Returns a human-friendly string describing the type of value.
    pub fn type_name(&self) -> &'static str {
        match self.cell_value() {
            Some(v) => v.type_name(),
            None => "array",
        }
    }

    /// Replaces NaN and Inf with errors; otherwise returns the value
    /// unchanged.
    pub fn purify_floats(mut self, span: Span) -> CodeResult<Self> {
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
    ) -> CodeResult<u32> {
        let mut common_len = 1;

        for array in arrays {
            let new_array_len = array.inner.array_size()[axis];
            match (common_len, new_array_len) {
                (a, b) if a == b => continue,
                (_, 1) => continue,
                (1, l) => common_len = l,
                _ => {
                    return Err(ErrorMsg::ArrayAxisMismatch {
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
    pub fn array_linear_axis(&self) -> CodeResult<Option<Axis>> {
        match self.inner.array_size() {
            ArraySize { w: 1, h: 1 } => Ok(None),
            ArraySize { w: _, h: 1 } => Ok(Some(Axis::X)),
            ArraySize { w: 1, h: _ } => Ok(Some(Axis::Y)),
            _ => Err(ErrorMsg::NonLinearArray.with_span(self.span)),
        }
    }
    /// Checks that an array is linear along a particular axis, then returns the
    /// length along that axis.
    pub fn array_linear_length(&self, axis: Axis) -> CodeResult<u32> {
        self.check_array_size_on(axis.other_axis(), 1)?;
        Ok(self.inner.array_size()[axis])
    }

    /// Checks the size of the array on one axis, returning an error if it does
    /// not match exactly.
    pub fn check_array_size_on(&self, axis: Axis, len: u32) -> CodeResult<()> {
        let expected = len;
        let got = self.inner.array_size()[axis];
        if expected == got {
            Ok(())
        } else {
            Err(ErrorMsg::ExactArrayAxisMismatch {
                axis,
                expected,
                got,
            }
            .with_span(self.span))
        }
    }

    /// Checks the size of the array, returning an error if it does not match
    /// exactly.
    pub fn check_array_size_exact(&self, size: ArraySize) -> CodeResult<()> {
        let expected = size;
        let got = self.inner.array_size();
        if expected == got {
            Ok(())
        } else {
            Err(ErrorMsg::ExactArraySizeMismatch { expected, got }.with_span(self.span))
        }
    }
}

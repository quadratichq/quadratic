use std::{fmt, num::NonZeroU32};

use bigdecimal::BigDecimal;
use itertools::Itertools;
use rand::Rng;
use serde::{Deserialize, Serialize};
use smallvec::{smallvec, SmallVec};

use super::{ArraySize, Axis, CellValue, Spanned, Value};
use crate::{
    controller::operations::operation::Operation, grid::Sheet, CodeResult, Pos, RunErrorMsg,
};

#[macro_export]
macro_rules! array {
    ($( $( $value:expr ),+ );+ $(;)?) => {{
        let values = [$( [$( $crate::CellValue::from($value) ),+] ),+];
        let height = values.len();
        let width = values[0].len(); // This will generate a compile-time error if there are no values.
        let size = $crate::ArraySize::new(width as u32, height as u32)
            .expect("empty array is not allowed");
        $crate::Array::new_row_major(size, values.into_iter().flatten().collect()).unwrap()
    }};
}

/// 2D array of values in the formula language. The array may be a single value
/// (1x1) but must not be degenerate (zero width or zero height).
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Array {
    /// Width and height.
    size: ArraySize,
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
            size: ArraySize::_1X1,
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

impl From<Vec<Vec<String>>> for Array {
    fn from(v: Vec<Vec<String>>) -> Self {
        let w = v[0].len();
        let h = v.len();
        Array {
            size: ArraySize::new(w as u32, h as u32).unwrap(),
            values: v
                .iter()
                .flatten()
                .map(|s| CellValue::from(s.as_ref()))
                .collect(),
        }
    }
}

impl From<Vec<Vec<&str>>> for Array {
    fn from(v: Vec<Vec<&str>>) -> Self {
        let w = v[0].len();
        let h = v.len();
        Array {
            size: ArraySize::new(w as u32, h as u32).unwrap(),
            values: v.iter().flatten().map(|s| (*s).into()).collect(),
        }
    }
}

impl From<Vec<Vec<CellValue>>> for Array {
    fn from(v: Vec<Vec<CellValue>>) -> Self {
        let w = v[0].len();
        let h = v.len();
        Array {
            size: ArraySize::new(w as u32, h as u32).unwrap(),
            values: v.into_iter().flatten().collect(),
        }
    }
}

impl Array {
    /// Constructs an array of blank values.
    pub fn new_empty(size: ArraySize) -> Self {
        let values = smallvec![CellValue::Blank; size.len() ];
        Self::new_row_major(size, values).expect("error constructing empty array")
    }
    /// Constructs an array of random float values.
    pub fn from_random_floats(size: ArraySize) -> Self {
        let mut rng = rand::thread_rng();
        let values = std::iter::from_fn(|| {
            Some(CellValue::Number(BigDecimal::from(
                &rng.gen_range(-100..=100),
            )))
        })
        .take(size.len())
        .collect();
        Self::new_row_major(size, values).expect("error constructing random float array")
    }
    /// Constructs an array from a list of values in row-major order.
    pub fn new_row_major(size: ArraySize, values: SmallVec<[CellValue; 1]>) -> CodeResult<Self> {
        if values.len() == size.len() {
            Ok(Self { size, values })
        } else {
            internal_error!(
                "bad array dimensions: {size} needs {} values, but got {}",
                size.len(),
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
        let new_size = self.size.transpose();
        let values = new_size
            .iter()
            .map(|(x, y)| self.get(y, x).unwrap().clone())
            .collect();
        Self::new_row_major(new_size, values).unwrap()
    }
    /// Flips an array horizontally. This is an expensive operation for large
    /// arrays.
    pub fn flip_horizontally(&self) -> Array {
        Self::new_row_major(
            self.size(),
            self.rows()
                .flat_map(|row| row.iter().rev().cloned())
                .collect(),
        )
        .unwrap()
    }
    /// Flips an array vertically. This is an expensive operation for large
    /// arrays.
    pub fn flip_vertically(&self) -> Array {
        Self::new_row_major(self.size, self.rows().rev().flatten().cloned().collect()).unwrap()
    }

    /// Returns the width of an array.
    pub fn width(&self) -> u32 {
        self.size.w.get()
    }
    /// Returns the height of an array.
    pub fn height(&self) -> u32 {
        self.size.h.get()
    }
    /// Returns the width and height of an array.
    pub fn size(&self) -> ArraySize {
        self.size
    }
    /// Returns an iterator over the rows of the array.
    pub fn rows(&self) -> std::slice::Chunks<'_, CellValue> {
        self.values.chunks(self.width() as usize)
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
            self.values.first()
        } else {
            None
        }
    }
    /// Returns the value at a given position in an array. If the width is 1,
    /// then `x` is ignored. If the height is 1, then `y` is ignored. Otherwise,
    /// returns an error if a coordinate is out of bounds.
    pub fn get(&self, x: u32, y: u32) -> Result<&CellValue, RunErrorMsg> {
        let i = self.size().flatten_index(x, y)?;
        Ok(&self.values[i])
    }
    /// Sets the value at a given position in an array. Returns an error if `x`
    /// or `y` is out of range.
    pub fn set(&mut self, x: u32, y: u32, value: CellValue) -> Result<(), RunErrorMsg> {
        let i = self.size().flatten_index(x, y)?;
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
    /// Returns the unique length that fits all `values` along `axis`. See
    /// `common_array_size()` for more.
    pub fn common_len<'a>(
        axis: Axis,
        arrays: impl IntoIterator<Item = Spanned<&'a Array>>,
    ) -> CodeResult<NonZeroU32> {
        let mut common_len = 1;

        for array in arrays {
            let new_array_len = array.inner.size()[axis].get();
            match (common_len, new_array_len) {
                (a, b) if a == b => continue,
                (_, 1) => continue,
                (1, l) => common_len = l,
                _ => {
                    return Err(RunErrorMsg::ArrayAxisMismatch {
                        axis,
                        expected: common_len,
                        got: new_array_len,
                    }
                    .with_span(array.span))
                }
            }
        }

        Ok(NonZeroU32::new(common_len).expect("bad array size"))
    }

    pub fn from_string_list(
        start: Pos,
        sheet: &mut Sheet,
        v: Vec<Vec<String>>,
    ) -> (Option<Array>, Vec<Operation>) {
        let size = ArraySize::new(v[0].len() as u32, v.len() as u32).unwrap();
        let values;
        let mut ops = vec![];
        let Pos { mut x, mut y } = start;
        values = v
            .iter()
            .flatten()
            .map(|s| {
                x += 1;
                if x == v[0].len() as i64 + start.x {
                    x = start.x;
                    y += 1;
                }
                let (value, updated_ops) = CellValue::from_string(s, start, sheet);
                ops.extend(updated_ops);
                value
            })
            .collect();
        (Some(Array { size, values }), ops)
    }
}

impl Spanned<Array> {
    /// Checks that an array is linear (width=1 or height=1), then returns which
    /// is the long axis. Returns `None` in the case of a 1x1 array.
    pub fn array_linear_axis(&self) -> CodeResult<Option<Axis>> {
        match (self.inner.width(), self.inner.height()) {
            (1, 1) => Ok(None),
            (_, 1) => Ok(Some(Axis::X)), // height = 1
            (1, _) => Ok(Some(Axis::Y)), // width = 1
            _ => Err(RunErrorMsg::NonLinearArray.with_span(self.span)),
        }
    }
    /// Checks that an array is linear along a particular axis, then returns the
    /// length along that axis.
    pub fn array_linear_length(&self, axis: Axis) -> CodeResult<NonZeroU32> {
        self.check_array_size_on(axis.other_axis(), 1)?;
        Ok(self.inner.size()[axis])
    }

    /// Checks the size of the array on one axis, returning an error if it does
    /// not match exactly.
    pub fn check_array_size_on(&self, axis: Axis, len: u32) -> CodeResult<()> {
        let expected = len;
        let got = self.inner.size()[axis].get();
        if expected == got {
            Ok(())
        } else {
            Err(RunErrorMsg::ExactArrayAxisMismatch {
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
        let got = self.inner.size();
        if expected == got {
            Ok(())
        } else {
            Err(RunErrorMsg::ExactArraySizeMismatch { expected, got }.with_span(self.span))
        }
    }
}

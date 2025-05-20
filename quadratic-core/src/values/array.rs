use std::fmt;
use std::iter::Skip;
use std::iter::StepBy;
use std::num::NonZeroU32;
use std::slice::Iter;

use anyhow::{Result, bail};
use bigdecimal::BigDecimal;
use itertools::Itertools;
use rand::Rng;
use serde::{Deserialize, Serialize};
use smallvec::{SmallVec, smallvec};

use super::cell_values::CellValues;
use super::{ArraySize, Axis, CellValue, Spanned, Value};
use crate::controller::operations::operation::Operation;
use crate::controller::transaction_types::JsCellValueResult;
use crate::grid::Sheet;
use crate::{CodeResult, Pos, RunError, RunErrorMsg, Span};

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
                write!(f, "{value}")?; // TODO: consider replacing this with `value.repr()`
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
impl TryFrom<Value> for Array {
    type Error = RunErrorMsg;

    fn try_from(value: Value) -> Result<Self, Self::Error> {
        value.into_array()
    }
}
impl TryFrom<Value> for Vec<Array> {
    type Error = RunErrorMsg;

    fn try_from(value: Value) -> Result<Self, Self::Error> {
        Ok(value.into_arrays())
    }
}

impl From<Vec<Vec<String>>> for Array {
    fn from(v: Vec<Vec<String>>) -> Self {
        let w = v[0].len();
        let h = v.len();
        Array {
            size: ArraySize::new(w as u32, h as u32).unwrap(),
            values: v.into_iter().flatten().map(CellValue::from).collect(),
        }
    }
}

impl From<Vec<Vec<&str>>> for Array {
    fn from(v: Vec<Vec<&str>>) -> Self {
        let w = v[0].len();
        let h = v.len();
        Array {
            size: ArraySize::new(w as u32, h as u32).unwrap(),
            values: v.into_iter().flatten().map(CellValue::from).collect(),
        }
    }
}

impl From<Vec<Vec<CellValue>>> for Array {
    fn from(v: Vec<Vec<CellValue>>) -> Self {
        if v.is_empty() {
            return Array::new_empty(ArraySize::_1X1);
        }

        let w = v[0].len();
        let h = v.len();
        Array {
            size: ArraySize::new(w as u32, h as u32).unwrap_or(ArraySize::_1X1),
            values: v.into_iter().flatten().collect(),
        }
    }
}

impl From<CellValues> for Array {
    fn from(cell_values: CellValues) -> Self {
        Array {
            size: ArraySize::new(cell_values.w, cell_values.h).unwrap(),
            values: cell_values
                .into_owned_vec()
                .into_iter()
                .flatten()
                .collect::<Vec<_>>()
                .into(),
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
        let mut rng = rand::rng();
        let values = std::iter::from_fn(|| {
            Some(CellValue::Number(BigDecimal::from(
                &rng.random_range(-100..=100),
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

    /// Iterates over rows (if `axis` is `Axis::Y`) or columns (if `axis` is
    /// `Axis::X`).
    pub fn slices(&self, axis: Axis) -> impl Iterator<Item = Vec<&CellValue>> {
        (0..self.size()[axis].get()).map(move |i| {
            (0..self.size()[axis.other_axis()].get())
                .filter_map(|j| match axis {
                    Axis::X => self.get(i, j).ok(),
                    Axis::Y => self.get(j, i).ok(),
                })
                .collect()
        })
    }
    /// Constructs an array from rows (if `axis` is `Axis::Y`) or columns (if
    /// `axis` is `Axis::X`). All rows/columns must have the same length, or
    /// else the result is undefined. Returns `None` if `slices` is empty or if
    /// each slice is empty.
    pub fn from_slices<'a>(
        span: Span,
        axis: Axis,
        slices: impl IntoIterator<Item = Vec<&'a CellValue>>,
    ) -> CodeResult<Self> {
        Self::try_from_slices(axis, slices).ok_or(RunErrorMsg::EmptyArray.with_span(span))
    }
    fn try_from_slices<'a>(
        axis: Axis,
        slices: impl IntoIterator<Item = Vec<&'a CellValue>>,
    ) -> Option<Self> {
        let slices = slices.into_iter().collect_vec();
        let main_len = slices.len() as u32;
        let other_len = slices.first()?.len() as u32;
        let size = ArraySize::new(other_len, main_len)?;
        let a = Self::new_row_major(size, slices.into_iter().flatten().cloned().collect()).ok();
        match axis {
            Axis::X => a.map(|a| a.transpose()),
            Axis::Y => a,
        }
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
    pub fn into_rows(self) -> Vec<Vec<CellValue>> {
        let width = self.width() as usize;
        let mut rows = Vec::new();
        let mut current_row = Vec::with_capacity(width);

        for value in self.values {
            current_row.push(value);
            if current_row.len() == width {
                rows.push(current_row);
                current_row = Vec::with_capacity(width);
            }
        }

        rows
    }
    /// Returns an iterator over a single col of the array.
    pub fn col(&self, index: usize) -> StepBy<Skip<Iter<'_, CellValue>>> {
        self.values
            .iter()
            .skip(index)
            .step_by(self.width() as usize)
    }
    /// Remove the first row of the array and return it.
    pub fn shift(&mut self) -> Result<Vec<CellValue>> {
        let width = (self.width() as usize).min(self.values.len());
        let height = NonZeroU32::new(self.height() - 1);

        match height {
            Some(h) => {
                let first_row = self.values.drain(0..width).collect();
                self.size.h = h;
                Ok(first_row)
            }
            None => bail!("Cannot shift a single row array"),
        }
    }
    /// Insert a new column at the given index.
    pub fn insert_column(
        &mut self,
        insert_at_index: usize,
        values: Option<Vec<CellValue>>,
    ) -> Result<()> {
        let width = self.width();
        let new_width = width + 1;
        let new_size = ArraySize::new_or_err(new_width, self.height())?;
        self.size = new_size;
        let mut array = Array::new_empty(new_size);

        let mut col_index: u32 = 0;
        let insert_at_end = insert_at_index as u32 == width;

        // reverse the values so that we can efficiently pop them off the end
        let mut reversed = values.map(|values| values.into_iter().rev().collect::<Vec<_>>());

        // pop the next value from the insert array
        let mut next_insert_value = || {
            reversed
                .as_mut()
                .map_or(CellValue::Blank, |r| r.pop().unwrap_or(CellValue::Blank))
        };

        for (i, value) in self.values.iter().enumerate() {
            let col = i % width as usize;
            let row = ((i / width as usize) as f32).floor() as usize;
            let last = col as u32 == width - 1;

            if col == insert_at_index {
                array.set(col_index, row as u32, next_insert_value())?;
                col_index += 1;
            }

            // TODO(ddimaria): this clone is expensive, we should be able to modify
            // the array in-place
            array.set(col_index, row as u32, value.to_owned())?;

            if insert_at_end && last {
                array.set(width, row as u32, next_insert_value())?;
            }

            col_index = if last { 0 } else { col_index + 1 };
        }

        self.size = new_size;
        self.values = array.values;

        Ok(())
    }
    /// Delete a column at the given index.
    pub fn delete_column(&mut self, remove_at_index: usize) -> Result<()> {
        let width = self.width();
        let new_width = width - 1;
        let new_size = ArraySize::new_or_err(new_width, self.height())?;
        let mut array = Array::new_empty(new_size);
        let mut col_index: u32 = 0;

        // loop through the values and skip the remove_at_index column,
        // adding the rest to the new array
        for (i, value) in self.values.iter().enumerate() {
            let col = i % width as usize;
            let row = ((i / width as usize) as f32).floor() as usize;
            let last = col as u32 == width - 1;

            if col == remove_at_index {
                if last {
                    col_index = 0;
                }

                continue;
            }

            // TODO(ddimaria): this clone is expensive, we should be able to modify
            // the array in-place
            array.set(col_index, row as u32, value.to_owned())?;
            col_index = if last { 0 } else { col_index + 1 };
        }

        self.size = new_size;
        self.values = array.values;

        Ok(())
    }
    /// Insert a new row at the given index.
    pub fn insert_row(
        &mut self,
        insert_at_index: usize,
        values: Option<Vec<CellValue>>,
    ) -> Result<()> {
        let width = self.width();
        let height = self.height();
        let new_height = height + 1;
        let new_size = ArraySize::new_or_err(width, new_height)?;
        let mut array = Array::new_empty(new_size);
        let values = values.unwrap_or_default();

        let mut row_index: u32 = 0;
        let insert_at_end = insert_at_index as u32 == height;

        for (i, row) in self.rows().enumerate() {
            let last = row_index == height - 1;

            if i == insert_at_index {
                array.set_row(row_index as usize, &values)?;
                row_index += 1;
            }

            array.set_row(row_index as usize, row)?;

            if insert_at_end && last {
                array.set_row(height as usize, &values)?;
            }

            // row_index = if last { 0 } else { row_index + 1 };
            row_index += 1;
        }

        self.size = new_size;
        self.values = array.values;

        Ok(())
    }

    /// Delete a row at the given index.
    pub fn delete_row(&mut self, remove_at_index: usize) -> Result<Vec<CellValue>> {
        let values_len = self.values.len();
        let width = (self.width() as usize).min(values_len);
        let height = NonZeroU32::new(self.height() - 1);

        let mut values: Vec<CellValue> = Vec::new();
        match height {
            Some(h) => {
                let start = remove_at_index * width;
                let end = std::cmp::min(start + width, values_len);

                if start <= end {
                    values = self.values.drain(start..end).collect();
                    self.size.h = h;
                }
            }
            None => bail!("Cannot remove a row from a single row array"),
        }

        Ok(values)
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
    /// Returns the value at a given 0-indexed position in an array. If the
    /// width is 1, then `x` is ignored. If the height is 1, then `y` is
    /// ignored. Otherwise, returns an error if a coordinate is out of bounds.
    pub fn get(&self, x: u32, y: u32) -> Result<&CellValue, RunErrorMsg> {
        let i = self.size().flatten_index(x, y)?;
        Ok(&self.values[i])
    }
    pub fn get_row(&self, index: usize) -> Result<&[CellValue], RunErrorMsg> {
        let width = self.width() as usize;
        let start = index * width;
        let end = start + width;

        Ok(&self.values[start..end])
    }
    /// Sets the value at a given 0-indexed position in an array. Returns an
    /// error if `x` or `y` is out of range.
    pub fn set(&mut self, x: u32, y: u32, value: CellValue) -> Result<(), RunErrorMsg> {
        let i = self.size().flatten_index(x, y)?;
        self.values[i] = value;
        Ok(())
    }
    pub fn set_row(&mut self, index: usize, values: &[CellValue]) -> Result<(), RunErrorMsg> {
        let width = self.width() as usize;
        let start = index * width;

        for (i, value) in values.iter().enumerate() {
            if let Some(cell) = self.values.get_mut(start + i) {
                *cell = value.to_owned();
            }
        }

        Ok(())
    }
    /// Returns a flat slice of cell values in the array.
    pub fn cell_values_slice(&self) -> &[CellValue] {
        &self.values
    }
    pub fn cell_values_slice_mut(&mut self) -> &mut [CellValue] {
        &mut self.values
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
                    .with_span(array.span));
                }
            }
        }

        Ok(NonZeroU32::new(common_len).expect("bad array size"))
    }

    /// Returns the first error in the array if there is one.
    pub fn first_error(&self) -> Option<&RunError> {
        self.values.iter().find_map(|v| v.error())
    }
    /// Iterates over errors in the array.
    pub fn errors(&self) -> impl Iterator<Item = &RunError> {
        self.values.iter().filter_map(|v| v.error())
    }
    /// Returns the first error in the array if there is one; otherwise returns
    /// the original array.
    pub fn into_non_error_array(self) -> CodeResult<Self> {
        match self.first_error() {
            Some(e) => Err(e.clone()),
            None => Ok(self),
        }
    }

    // convert from a Vec<Vec<&str>> to an Array, auto-picking the type if selected
    pub fn from_str_vec(array: Vec<Vec<&str>>, auto_pick_type: bool) -> anyhow::Result<Self> {
        let w = array[0].len();
        let h = array.len();
        let size = ArraySize::new_or_err(w as u32, h as u32)?;
        let values = array
            .into_iter()
            .flatten()
            .map(|s| match auto_pick_type {
                true => CellValue::parse_from_str(s),
                false => CellValue::from(s),
            })
            .collect();

        Ok(Array { size, values })
    }

    pub fn from_string_list(
        start: Pos,
        sheet: &mut Sheet,
        v: Vec<Vec<JsCellValueResult>>,
    ) -> (Option<Array>, Vec<Operation>) {
        // catch the unlikely case where we receive an array of empty arrays
        if v[0].is_empty() {
            return (None, vec![]);
        }
        let size = ArraySize::new(v[0].len() as u32, v.len() as u32).unwrap();
        let mut ops = vec![];
        let Pos { mut x, mut y } = start;
        let x_end = v[0].len() as i64 + start.x;
        let values = v
            .into_iter()
            .flatten()
            .map(|cell_value| {
                x += 1;
                if x == x_end {
                    x = start.x;
                    y += 1;
                }
                match CellValue::from_js(cell_value, start, sheet) {
                    Ok(value) => value,
                    Err(_) => (CellValue::Blank, vec![]),
                }
            })
            .map(|(value, updated_ops)| {
                ops.extend(updated_ops);
                value
            })
            .collect::<SmallVec<[CellValue; 1]>>();

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
    /// Checks that an array is linear (width=1 or height=1), then returns it if
    /// it is.
    pub fn try_as_linear_array(&self) -> CodeResult<&[CellValue]> {
        self.array_linear_axis()?; // Check that the array is linear.
        Ok(&self.inner.values)
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

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn from_string_list_empty() {
        let mut sheet = Sheet::test();
        assert_eq!(
            Array::from_string_list(Pos { x: 0, y: 0 }, &mut sheet, vec![vec![], vec![]]),
            (None, vec![])
        );
    }

    #[test]
    fn test_insert_column() {
        let mut array = array!["a", "b"; "c", "d"];
        let values = vec![CellValue::from("e"), CellValue::from("f")];
        array.insert_column(0, Some(values)).unwrap();
        assert_eq!(array, array!["e", "a", "b"; "f", "c", "d"]);

        let mut array = array!["a", "b"; "c", "d"];
        let values = vec![CellValue::from("e"), CellValue::from("f")];
        array.insert_column(1, Some(values)).unwrap();
        assert_eq!(array, array!["a", "e", "b"; "c", "f", "d"]);

        let mut array = array!["a", "b"; "c", "d"];
        let values = vec![CellValue::from("e"), CellValue::from("f")];
        array.insert_column(2, Some(values)).unwrap();
        assert_eq!(array, array!["a", "b", "e"; "c", "d", "f"]);

        let mut array = array!["a", "b"; "c", "d"];
        array.insert_column(2, None).unwrap();
        assert_eq!(
            array,
            array!["a", "b", CellValue::Blank; "c", "d", CellValue::Blank]
        );
    }

    #[test]
    fn test_delete_column() {
        let mut array = array!["a", "b", "c"; "d", "e", "f"; ];
        array.delete_column(0).unwrap();
        assert_eq!(array, array!["b", "c"; "e", "f";]);

        let mut array = array!["a", "b", "c"; "d", "e", "f"; ];
        array.delete_column(1).unwrap();
        assert_eq!(array, array!["a", "c"; "d", "f";]);

        let mut array = array!["a", "b", "c"; "d", "e", "f"; ];
        array.delete_column(2).unwrap();
        assert_eq!(array, array!["a", "b"; "d", "e";]);
    }

    #[test]
    fn test_insert_row() {
        let mut array = array!["a", "b"; "c", "d"];
        let values = vec![CellValue::from("e"), CellValue::from("f")];
        array.insert_row(0, Some(values)).unwrap();
        assert_eq!(array, array!["e", "f"; "a", "b"; "c", "d"]);

        let mut array = array!["a", "b"; "c", "d"];
        let values = vec![CellValue::from("e"), CellValue::from("f")];
        array.insert_row(1, Some(values)).unwrap();
        assert_eq!(array, array!["a", "b"; "e", "f"; "c", "d"]);

        let mut array = array!["a", "b"; "c", "d"];
        let values = vec![CellValue::from("e"), CellValue::from("f")];
        array.insert_row(2, Some(values)).unwrap();
        assert_eq!(array, array!["a", "b"; "c", "d"; "e", "f"]);

        let mut array = array!["a", "b"; "c", "d"];
        array.insert_row(2, None).unwrap();
        assert_eq!(
            array,
            array!["a", "b"; "c", "d"; CellValue::Blank, CellValue::Blank]
        );
    }
}

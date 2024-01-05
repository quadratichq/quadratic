use std::collections::HashSet;

use smallvec::SmallVec;

use super::*;
use crate::{
    grid::Grid, Array, CellValue, CodeResult, RunErrorMsg, SheetPos, SheetRect, Span, Spanned,
    Value,
};

/// Formula execution context.
pub struct Ctx<'ctx> {
    /// Grid file to access cells from.
    pub grid: &'ctx Grid,
    /// Position in the grid from which the formula is being evaluated.
    pub sheet_pos: SheetPos,
    /// Cells that have been accessed in evaluating the formula.
    pub cells_accessed: HashSet<SheetRect>,
}
impl<'ctx> Ctx<'ctx> {
    /// Constructs a context for evaluating a formula at `pos` in `grid`.
    pub fn new(grid: &'ctx Grid, sheet_pos: SheetPos) -> Self {
        Ctx {
            grid,
            sheet_pos,
            cells_accessed: HashSet::new(),
        }
    }

    /// Fetches the contents of the cell at `ref_pos` evaluated at `base_pos`,
    /// or returns an error in the case of a circular reference.
    pub fn get_cell(&mut self, ref_pos: &CellRef, span: Span) -> CodeResult<Spanned<CellValue>> {
        let sheet = match &ref_pos.sheet {
            Some(sheet_name) => self
                .grid
                .try_sheet_from_name(sheet_name.clone())
                .ok_or(RunErrorMsg::BadCellReference.with_span(span))?,
            None => self
                .grid
                .try_sheet(self.sheet_pos.sheet_id)
                .ok_or(RunErrorMsg::BadCellReference.with_span(span))?,
        };
        let ref_pos = ref_pos.resolve_from(self.sheet_pos.into());
        let ref_pos_with_sheet = ref_pos.to_sheet_pos(sheet.id);
        if ref_pos_with_sheet == self.sheet_pos {
            return Err(RunErrorMsg::CircularReference.with_span(span));
        }

        self.cells_accessed.insert(ref_pos_with_sheet.into());

        let value = sheet.display_value(ref_pos).unwrap_or(CellValue::Blank);
        Ok(Spanned { inner: value, span })
    }

    /// Evaluates a function once for each corresponding set of values from
    /// `arrays`.
    ///
    /// Many functions, including basic operators such as `+`, work on arrays by
    /// zipping the arrays and then mapping the function across corresponding
    /// sets of inputs. For example `{1,2,3} + {10,20,30}` results in
    /// `{11,22,33}`. If any argument is not an array, it is expanded into an
    /// array with the same size as other arguments. This also works
    /// 2-dimensionally: if one argument is a 1x3 array and the other argument
    /// is a 3x1 array, then both arguments are first expanded to 3x3 arrays. If
    /// arrays cannot be expanded like this, then an error is returned.
    pub fn zip_map<'a, I: Copy + IntoIterator<Item = &'a Spanned<Value>>>(
        &mut self,
        arrays: I,
        f: impl for<'b> Fn(&'b mut Ctx<'_>, &[Spanned<&CellValue>]) -> CodeResult<CellValue>,
    ) -> CodeResult<Value>
    where
        I::IntoIter: ExactSizeIterator,
    {
        let size = Value::common_array_size(arrays)?;

        let mut args_buffer = Vec::with_capacity(arrays.into_iter().len());

        // If the result is a single value, return that value instead of a 1x1
        // array. This isn't just an optimization; it's important for Excel
        // compatibility.
        if size.len() == 1 {
            for array in arrays {
                args_buffer.push(array.cell_value()?);
            }
            return Ok(Value::Single(f(self, &args_buffer)?));
        }

        let mut values = SmallVec::with_capacity(size.len());
        for (x, y) in size.iter() {
            args_buffer.clear();
            for array in arrays {
                args_buffer.push(array.get(x, y)?);
            }

            values.push(f(self, &args_buffer)?);
        }

        let result = Array::new_row_major(size, values)?;
        Ok(Value::Array(result))
    }
}

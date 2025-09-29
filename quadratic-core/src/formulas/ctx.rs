use itertools::Itertools;
use smallvec::{SmallVec, smallvec};

use super::*;
use crate::{
    Array, CellValue, CodeResult, CodeResultExt, Pos, RunErrorMsg, SheetPos, SheetRect, Span,
    Spanned, Value,
    a1::{CellRefRange, SheetCellRefRange, UNBOUNDED},
    controller::GridController,
    grid::CellsAccessed,
};

/// Formula execution context.
#[derive(Debug)]
pub struct Ctx<'ctx> {
    /// GridController to access file data.
    pub grid_controller: &'ctx GridController,
    /// Position in the grid from which the formula is being evaluated.
    pub sheet_pos: SheetPos,
    /// Cells that have been accessed in evaluating the formula.
    pub cells_accessed: CellsAccessed,

    /// Whether to only parse, skipping expensive computations.
    pub skip_computation: bool,
}
impl<'ctx> Ctx<'ctx> {
    /// Constructs a context for evaluating a formula at `pos` in `grid`.
    pub(crate) fn new(grid_controller: &'ctx GridController, sheet_pos: SheetPos) -> Self {
        Ctx {
            grid_controller,
            sheet_pos,
            cells_accessed: Default::default(),
            skip_computation: false,
        }
    }

    /// Constructs a context for checking the syntax and some basic types of a
    /// formula in `grid`. Expensive computations are skipped, so the value
    /// returned by "evaluating" the formula will be nonsense (probably blank).
    pub(crate) fn new_for_syntax_check(grid_controller: &'ctx GridController) -> Self {
        Ctx {
            grid_controller,
            sheet_pos: Pos::ORIGIN.to_sheet_pos(grid_controller.grid().sheets()[0].id),
            cells_accessed: Default::default(),
            skip_computation: true,
        }
    }

    /// Resolves a cell range reference relative to `self.sheet_pos`.
    pub(crate) fn resolve_range_ref(
        &self,
        range: &SheetCellRefRange,
        span: Span,
        ignore_formatting: bool,
    ) -> CodeResult<Spanned<SheetRect>> {
        let sheet = self
            .grid_controller
            .try_sheet(range.sheet_id)
            .ok_or(RunErrorMsg::BadCellReference.with_span(span))?;

        let a1_context = self.grid_controller.a1_context();

        let rect = match &range.cells {
            CellRefRange::Sheet { range } => {
                sheet.ref_range_bounds_to_rect(range, ignore_formatting)
            }
            CellRefRange::Table { range } => sheet
                .table_ref_to_rect(range, false, false, a1_context)
                .ok_or(RunErrorMsg::BadCellReference.with_span(span))?,
        };

        Ok(Spanned {
            span,
            inner: rect.to_sheet_rect(sheet.id),
        })
    }

    /// Fetches the contents of the cell at `pos` evaluated at `self.sheet_pos`,
    /// or returns an error in the case of a circular reference. If
    /// add_cells_accessed is true, it will add the cell reference to
    /// cells_accessed. Otherwise, it needs to be added manually.
    pub(crate) fn get_cell(
        &mut self,
        pos: SheetPos,
        span: Span,
        add_cells_accessed: bool,
    ) -> Spanned<CellValue> {
        if self.skip_computation {
            let value = CellValue::Blank;
            return Spanned { span, inner: value };
        }

        let error_value = |e: RunErrorMsg| {
            let value = CellValue::Error(Box::new(e.with_span(span)));
            Spanned { inner: value, span }
        };

        let Some(sheet) = self.grid_controller.try_sheet(pos.sheet_id) else {
            return error_value(RunErrorMsg::BadCellReference);
        };
        if pos == self.sheet_pos {
            return error_value(RunErrorMsg::CircularReference);
        }

        if add_cells_accessed {
            self.cells_accessed.add_sheet_pos(pos);
        }

        let value = sheet.get_cell_for_formula(pos.into());
        Spanned { inner: value, span }
    }

    /// Fetches the contents of the cell array at `rect`, or returns an error in
    /// the case of a circular reference.
    pub(crate) fn get_cell_array(&mut self, rect: SheetRect, span: Span) -> CodeResult<Spanned<Array>> {
        if self.skip_computation {
            return Ok(CellValue::Blank.into()).with_span(span);
        }

        let Some(sheet) = self.grid_controller.try_sheet(rect.sheet_id) else {
            return Err(RunErrorMsg::BadCellReference.with_span(span));
        };
        let bounds = sheet.bounds(true);

        self.cells_accessed.add_sheet_rect(rect);

        let mut bounded_rect = rect;

        // convert unbounded values to the data bounds of the sheet
        if bounded_rect.min.x == UNBOUNDED && bounded_rect.min.y == UNBOUNDED {
            bounded_rect.min.x = bounds.first_column().unwrap_or(1);
            bounded_rect.min.y = bounds.first_row().unwrap_or(1);
        } else if bounded_rect.min.x == UNBOUNDED {
            bounded_rect.min.x = sheet
                .row_bounds(bounded_rect.min.y, true)
                .unwrap_or((1, 1))
                .0;
        } else if bounded_rect.min.y == UNBOUNDED {
            bounded_rect.min.y = sheet
                .column_bounds(bounded_rect.min.x, true)
                .unwrap_or((1, 1))
                .0;
        }

        if bounded_rect.max.x == UNBOUNDED && bounded_rect.max.y == UNBOUNDED {
            bounded_rect.max.x = bounds.last_column().unwrap_or(1);
            bounded_rect.max.y = bounds.last_row().unwrap_or(1);
        } else if bounded_rect.max.x == UNBOUNDED {
            bounded_rect.max.x = sheet
                .row_bounds(bounded_rect.max.y, true)
                .unwrap_or((1, 1))
                .1;
        } else if bounded_rect.max.y == UNBOUNDED {
            bounded_rect.max.y = sheet
                .column_bounds(bounded_rect.max.x, true)
                .unwrap_or((1, 1))
                .1;
        }

        let sheet_id = bounded_rect.sheet_id;
        let array_size = bounded_rect.size();

        // TODO(ddimaria): removed b/c this should be enforced across all languages
        // remove this comment and the code below once implemented elsewhere
        //
        // if std::cmp::max(array_size.w, array_size.h).get() > crate::limits::CELL_RANGE_LIMIT {
        //     return Err(RunErrorMsg::ArrayTooBig.with_span(span));
        // }

        let mut flat_array = smallvec![];
        // Reuse the same `CellRef` object so that we don't have to
        // clone `sheet_name.`
        for y in bounded_rect.y_range() {
            for x in bounded_rect.x_range() {
                // TODO: record array dependency instead of many individual cell dependencies
                flat_array.push(
                    self.get_cell(SheetPos { x, y, sheet_id }, span, false)
                        .inner,
                );
            }
        }

        Ok(Array::new_row_major(array_size, flat_array)?).with_span(span)
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
    pub(crate) fn zip_map<'a, I: Copy + IntoIterator<Item = &'a Spanned<Value>>>(
        &mut self,
        arrays: I,
        f: impl for<'b> Fn(&'b mut Ctx<'_>, &[Spanned<&CellValue>]) -> CodeResult<CellValue>,
    ) -> CodeResult<Value>
    where
        I::IntoIter: ExactSizeIterator,
    {
        if self.skip_computation {
            return Ok(CellValue::Blank.into());
        }

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
        Ok(result.into())
    }

    /// Parses a sequence of `eval_range` and `criteria` arguments from `args`,
    /// then runs [`Ctx::zip_map()`] over the criteria arrays.
    ///
    /// This is useful for implementing functions that take multiple criteria,
    /// like `SUMIFS`, `COUNTIFS`, etc.
    pub(crate) fn zip_map_eval_ranges_and_criteria_from_args(
        &mut self,
        eval_range1: Spanned<Array>,
        criteria1: Spanned<Value>,
        mut remaining_args: FormulaFnArgs,
        f: impl for<'b> Fn(
            &'b mut Ctx<'_>,
            Vec<(&'b Spanned<Array>, Criterion)>,
        ) -> CodeResult<CellValue>,
    ) -> CodeResult<Value> {
        // Handle arguments.
        let mut i = 1;
        let mut eval_ranges = vec![eval_range1];
        let mut criteria = vec![criteria1];
        while let Some(eval_range) = remaining_args.take_next_optional() {
            i += 1;
            eval_ranges.push(eval_range.into_array()?);
            criteria.push(remaining_args.take_next_required(format!("criteria{i}"))?);
        }

        // Evaluate.
        self.zip_map(&criteria, |ctx, criteria| {
            let eval_ranges_and_criteria: Vec<(&Spanned<Array>, Criterion)> = eval_ranges
                .iter()
                .zip(criteria)
                .map(|(eval_range, &criterion_value)| {
                    CodeResult::Ok((eval_range, Criterion::try_from(criterion_value)?))
                })
                .try_collect()?;
            f(ctx, eval_ranges_and_criteria)
        })
    }
}

use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::rc::Rc;

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
    /// Shared between parent and child contexts via Rc<RefCell<>> so that
    /// cells accessed in child contexts (e.g., LAMBDA bodies, LET calculations)
    /// are automatically tracked in the parent for proper dependency tracking.
    cells_accessed: Rc<RefCell<CellsAccessed>>,

    /// Whether to only parse, skipping expensive computations.
    pub skip_computation: bool,

    /// Variable bindings for LAMBDA parameters.
    /// Maps variable names (case-insensitive, stored uppercase) to their values.
    pub variables: HashMap<String, Value>,

    /// Set of omitted variable names (case-insensitive, stored uppercase).
    /// Used by ISOMITTED to check if a LAMBDA parameter was not provided.
    pub omitted_variables: HashSet<String>,

    /// Whether to allow self-references (reading the cell at `sheet_pos`).
    /// This is used for conditional formatting where formulas like `=A1>5`
    /// are evaluated at position A1 and need to read A1's value.
    pub allow_self_reference: bool,
}
impl<'ctx> Ctx<'ctx> {
    /// Constructs a context for evaluating a formula at `pos` in `grid`.
    pub fn new(grid_controller: &'ctx GridController, sheet_pos: SheetPos) -> Self {
        Ctx {
            grid_controller,
            sheet_pos,
            cells_accessed: Rc::new(RefCell::new(CellsAccessed::default())),
            skip_computation: false,
            variables: HashMap::new(),
            omitted_variables: HashSet::new(),
            allow_self_reference: false,
        }
    }

    /// Constructs a context for evaluating a conditional formatting formula.
    /// Unlike regular formulas, conditional formatting formulas can reference
    /// the cell they're being evaluated at (e.g., `=A1>5` evaluated at A1).
    pub fn new_for_conditional_format(
        grid_controller: &'ctx GridController,
        sheet_pos: SheetPos,
    ) -> Self {
        Ctx {
            grid_controller,
            sheet_pos,
            cells_accessed: Rc::new(RefCell::new(CellsAccessed::default())),
            skip_computation: false,
            variables: HashMap::new(),
            omitted_variables: HashSet::new(),
            allow_self_reference: true,
        }
    }

    /// Constructs a context for checking the syntax and some basic types of a
    /// formula in `grid`. Expensive computations are skipped, so the value
    /// returned by "evaluating" the formula will be nonsense (probably blank).
    pub fn new_for_syntax_check(grid_controller: &'ctx GridController) -> Self {
        Ctx {
            grid_controller,
            sheet_pos: Pos::ORIGIN.to_sheet_pos(grid_controller.grid().sheets()[0].id),
            cells_accessed: Rc::new(RefCell::new(CellsAccessed::default())),
            skip_computation: true,
            variables: HashMap::new(),
            omitted_variables: HashSet::new(),
            allow_self_reference: false,
        }
    }

    /// Returns the cells accessed during formula evaluation.
    /// This consumes the shared reference and returns the owned CellsAccessed.
    pub fn take_cells_accessed(self) -> CellsAccessed {
        Rc::try_unwrap(self.cells_accessed)
            .map(|cell| cell.into_inner())
            .unwrap_or_else(|rc| (*rc.borrow()).clone())
    }

    /// Returns a reference to the cells accessed for reading.
    pub fn cells_accessed(&self) -> std::cell::Ref<'_, CellsAccessed> {
        self.cells_accessed.borrow()
    }

    /// Looks up a variable by name (case-insensitive).
    /// Returns `None` if the variable is not defined.
    #[inline]
    pub fn lookup_variable(&self, name: &str) -> Option<&Value> {
        self.variables.get(&name.to_ascii_uppercase())
    }

    /// Checks if a variable was omitted (not provided) in a LAMBDA call.
    /// Returns `true` if the variable is in the omitted set.
    #[inline]
    pub fn is_variable_omitted(&self, name: &str) -> bool {
        self.omitted_variables.contains(&name.to_ascii_uppercase())
    }

    /// Creates a child context with additional variable bindings.
    /// The child context shares the same grid_controller, sheet_pos, and cells_accessed,
    /// but has its own variable scope that includes both parent variables
    /// and the new bindings.
    ///
    /// Because cells_accessed is shared via Rc<RefCell<>>, any cells accessed
    /// in the child context are automatically tracked in the parent.
    pub fn with_bindings(&self, bindings: &[(String, Value)]) -> Self {
        let mut variables = self.variables.clone();
        for (name, value) in bindings {
            variables.insert(name.to_ascii_uppercase(), value.clone());
        }
        Ctx {
            grid_controller: self.grid_controller,
            sheet_pos: self.sheet_pos,
            cells_accessed: Rc::clone(&self.cells_accessed),
            skip_computation: self.skip_computation,
            variables,
            omitted_variables: self.omitted_variables.clone(),
            allow_self_reference: self.allow_self_reference,
        }
    }

    /// Creates a child context with additional variable bindings and omitted variables.
    /// Used by LAMBDA invocation to track which parameters were not provided.
    ///
    /// Because cells_accessed is shared via Rc<RefCell<>>, any cells accessed
    /// in the child context are automatically tracked in the parent.
    pub fn with_bindings_and_omitted(
        &self,
        bindings: &[(String, Value)],
        omitted: &[String],
    ) -> Self {
        let mut variables = self.variables.clone();
        for (name, value) in bindings {
            variables.insert(name.to_ascii_uppercase(), value.clone());
        }
        let mut omitted_variables = self.omitted_variables.clone();
        for name in omitted {
            omitted_variables.insert(name.to_ascii_uppercase());
        }
        Ctx {
            grid_controller: self.grid_controller,
            sheet_pos: self.sheet_pos,
            cells_accessed: Rc::clone(&self.cells_accessed),
            skip_computation: self.skip_computation,
            variables,
            omitted_variables,
            allow_self_reference: self.allow_self_reference,
        }
    }

    /// Resolves a cell range reference relative to `self.sheet_pos`.
    #[inline]
    pub fn resolve_range_ref(
        &self,
        range: &SheetCellRefRange,
        span: Span,
        ignore_formatting: bool,
    ) -> CodeResult<Spanned<SheetRect>> {
        // Add the ORIGINAL cell reference (with unbounded coordinates preserved)
        // to cells_accessed for proper dependency tracking
        self.cells_accessed
            .borrow_mut()
            .add(range.sheet_id, range.cells.clone());

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
    #[inline]
    pub fn get_cell(
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
        if pos == self.sheet_pos && !self.allow_self_reference {
            return error_value(RunErrorMsg::CircularReference);
        }

        if add_cells_accessed {
            self.cells_accessed.borrow_mut().add_sheet_pos(pos);
        }

        let value = sheet.get_cell_for_formula(pos.into());
        Spanned { inner: value, span }
    }

    /// Fetches the contents of the cell array at `rect`, or returns an error in
    /// the case of a circular reference.
    pub fn get_cell_array(&mut self, rect: SheetRect, span: Span) -> CodeResult<Spanned<Array>> {
        if self.skip_computation {
            return Ok(CellValue::Blank.into()).with_span(span);
        }

        let Some(sheet) = self.grid_controller.try_sheet(rect.sheet_id) else {
            return Err(RunErrorMsg::BadCellReference.with_span(span));
        };
        let bounds = sheet.bounds(true);

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
    pub fn zip_map<'a, I: Copy + IntoIterator<Item = &'a Spanned<Value>>>(
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
    pub fn zip_map_eval_ranges_and_criteria_from_args(
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::a1::A1Context;
    use crate::formulas::parse_formula;

    /// Helper to evaluate a formula and return the cells_accessed and result
    fn eval_and_get_cells_accessed_with_result(
        gc: &GridController,
        formula: &str,
    ) -> (CellsAccessed, crate::Value) {
        let sheet_id = gc.sheet_ids()[0];
        let pos = Pos::ORIGIN.to_sheet_pos(sheet_id);
        let mut ctx = Ctx::new(gc, pos);
        let parsed = parse_formula(formula, gc.a1_context(), pos).unwrap();
        let result = parsed.eval(&mut ctx);
        (ctx.take_cells_accessed(), result.inner)
    }

    /// Helper to evaluate a formula and return the cells_accessed
    fn eval_and_get_cells_accessed(gc: &GridController, formula: &str) -> CellsAccessed {
        eval_and_get_cells_accessed_with_result(gc, formula).0
    }

    /// Helper to check if cells_accessed contains a specific cell reference
    fn cells_accessed_contains(
        cells_accessed: &CellsAccessed,
        sheet_id: crate::grid::SheetId,
        x: i64,
        y: i64,
        a1_context: &A1Context,
    ) -> bool {
        cells_accessed.contains(SheetPos::new(sheet_id, x, y), a1_context)
    }

    #[test]
    fn test_cells_accessed_simple_reference() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(pos![sheet_id!A1], "10".into(), None, false);

        let cells_accessed = eval_and_get_cells_accessed(&gc, "A1 + 5");
        let a1_context = gc.a1_context();

        assert!(cells_accessed_contains(
            &cells_accessed,
            sheet_id,
            1,
            1,
            a1_context
        ));
    }

    #[test]
    fn test_cells_accessed_in_lambda_body() {
        // Verify that cell references inside a LAMBDA body are tracked
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(pos![sheet_id!A1], "10".into(), None, false);
        gc.set_cell_value(pos![sheet_id!B1], "20".into(), None, false);

        // Define and immediately invoke a LAMBDA that references A1
        let cells_accessed = eval_and_get_cells_accessed(&gc, "LAMBDA(x, x + A1)(B1)");
        let a1_context = gc.a1_context();

        // Both A1 (inside lambda body) and B1 (passed as argument) should be tracked
        assert!(
            cells_accessed_contains(&cells_accessed, sheet_id, 1, 1, a1_context),
            "A1 inside LAMBDA body should be tracked"
        );
        assert!(
            cells_accessed_contains(&cells_accessed, sheet_id, 2, 1, a1_context),
            "B1 passed as argument should be tracked"
        );
    }

    #[test]
    fn test_cells_accessed_in_let_variable() {
        // Verify that cell references in LET variable values are tracked
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(pos![sheet_id!A1], "10".into(), None, false);
        gc.set_cell_value(pos![sheet_id!B1], "20".into(), None, false);

        let cells_accessed = eval_and_get_cells_accessed(&gc, "LET(x, A1, y, B1, x + y)");
        let a1_context = gc.a1_context();

        assert!(
            cells_accessed_contains(&cells_accessed, sheet_id, 1, 1, a1_context),
            "A1 in LET variable should be tracked"
        );
        assert!(
            cells_accessed_contains(&cells_accessed, sheet_id, 2, 1, a1_context),
            "B1 in LET variable should be tracked"
        );
    }

    #[test]
    fn test_cells_accessed_in_let_calculation() {
        // Verify that cell references in LET calculation expression are tracked
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(pos![sheet_id!A1], "10".into(), None, false);
        gc.set_cell_value(pos![sheet_id!B1], "20".into(), None, false);
        gc.set_cell_value(pos![sheet_id!C1], "30".into(), None, false);

        // C1 is referenced in the calculation, not in variables
        let cells_accessed = eval_and_get_cells_accessed(&gc, "LET(x, A1, x + C1)");
        let a1_context = gc.a1_context();

        assert!(
            cells_accessed_contains(&cells_accessed, sheet_id, 1, 1, a1_context),
            "A1 in LET variable should be tracked"
        );
        assert!(
            cells_accessed_contains(&cells_accessed, sheet_id, 3, 1, a1_context),
            "C1 in LET calculation should be tracked"
        );
    }

    #[test]
    fn test_cells_accessed_in_map() {
        // Verify that cell references inside MAP lambda are tracked
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(pos![sheet_id!A1], "10".into(), None, false);
        gc.set_cell_value(pos![sheet_id!B1], "1".into(), None, false);
        gc.set_cell_value(pos![sheet_id!B2], "2".into(), None, false);
        gc.set_cell_value(pos![sheet_id!B3], "3".into(), None, false);

        // A1 is referenced inside the MAP lambda body
        let cells_accessed = eval_and_get_cells_accessed(&gc, "MAP(B1:B3, LAMBDA(x, x + A1))");
        let a1_context = gc.a1_context();

        assert!(
            cells_accessed_contains(&cells_accessed, sheet_id, 1, 1, a1_context),
            "A1 inside MAP lambda should be tracked"
        );
        // The range B1:B3 should also be tracked
        assert!(
            cells_accessed_contains(&cells_accessed, sheet_id, 2, 1, a1_context),
            "B1 in MAP range should be tracked"
        );
    }

    #[test]
    fn test_cells_accessed_in_reduce() {
        // Verify that cell references inside REDUCE lambda are tracked
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(pos![sheet_id!A1], "100".into(), None, false);
        gc.set_cell_value(pos![sheet_id!B1], "1".into(), None, false);
        gc.set_cell_value(pos![sheet_id!B2], "2".into(), None, false);
        gc.set_cell_value(pos![sheet_id!B3], "3".into(), None, false);

        // A1 is referenced inside the REDUCE lambda body
        let cells_accessed =
            eval_and_get_cells_accessed(&gc, "REDUCE(0, B1:B3, LAMBDA(acc, x, acc + x + A1))");
        let a1_context = gc.a1_context();

        assert!(
            cells_accessed_contains(&cells_accessed, sheet_id, 1, 1, a1_context),
            "A1 inside REDUCE lambda should be tracked"
        );
    }

    #[test]
    fn test_cells_accessed_nested_lambda() {
        // Verify that cell references in deeply nested LAMBDA/LET are tracked
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(pos![sheet_id!A1], "10".into(), None, false);
        gc.set_cell_value(pos![sheet_id!B1], "20".into(), None, false);
        gc.set_cell_value(pos![sheet_id!C1], "30".into(), None, false);

        // First, test a simpler case: direct lambda invocation with cell ref arg
        let cells_accessed_simple = eval_and_get_cells_accessed(&gc, "LAMBDA(y, y + C1)(B1)");
        let a1_context = gc.a1_context();

        assert!(
            cells_accessed_contains(&cells_accessed_simple, sheet_id, 2, 1, a1_context),
            "B1 passed to LAMBDA should be tracked (simple case)"
        );
        assert!(
            cells_accessed_contains(&cells_accessed_simple, sheet_id, 3, 1, a1_context),
            "C1 in LAMBDA body should be tracked (simple case)"
        );

        // Nested: LET contains a LAMBDA that references C1
        let (cells_accessed, _result) = eval_and_get_cells_accessed_with_result(
            &gc,
            "LET(x, A1, f, LAMBDA(y, y + C1), f(B1) + x)",
        );

        assert!(
            cells_accessed_contains(&cells_accessed, sheet_id, 1, 1, a1_context),
            "A1 in outer LET should be tracked"
        );
        // B1 is evaluated as an argument to f(), so it should be tracked
        assert!(
            cells_accessed_contains(&cells_accessed, sheet_id, 2, 1, a1_context),
            "B1 passed to nested LAMBDA should be tracked"
        );
        assert!(
            cells_accessed_contains(&cells_accessed, sheet_id, 3, 1, a1_context),
            "C1 in nested LAMBDA body should be tracked"
        );
    }

    #[test]
    fn test_cells_accessed_in_scan() {
        // Verify that cell references inside SCAN lambda are tracked
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(pos![sheet_id!A1], "5".into(), None, false);
        gc.set_cell_value(pos![sheet_id!B1], "1".into(), None, false);
        gc.set_cell_value(pos![sheet_id!B2], "2".into(), None, false);

        let cells_accessed =
            eval_and_get_cells_accessed(&gc, "SCAN(0, B1:B2, LAMBDA(acc, x, acc + x * A1))");
        let a1_context = gc.a1_context();

        assert!(
            cells_accessed_contains(&cells_accessed, sheet_id, 1, 1, a1_context),
            "A1 inside SCAN lambda should be tracked"
        );
    }

    #[test]
    fn test_cells_accessed_in_makearray() {
        // Verify that cell references inside MAKEARRAY lambda are tracked
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(pos![sheet_id!A1], "10".into(), None, false);

        // MAKEARRAY creates a 2x2 array, each cell references A1
        let cells_accessed =
            eval_and_get_cells_accessed(&gc, "MAKEARRAY(2, 2, LAMBDA(r, c, r + c + A1))");
        let a1_context = gc.a1_context();

        assert!(
            cells_accessed_contains(&cells_accessed, sheet_id, 1, 1, a1_context),
            "A1 inside MAKEARRAY lambda should be tracked"
        );
    }
}

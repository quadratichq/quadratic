use std::collections::HashSet;

use indexmap::IndexSet;
use wasm_bindgen::JsValue;

use crate::{
    controller::update_code_cell_value::update_code_cell_value,
    grid::{CodeCellLanguage, CodeCellRunOutput, CodeCellRunResult},
    Error, ErrorMsg, Span,
};

use crate::controller::{
    operation::Operation,
    transaction_summary::TransactionSummary,
    transaction_types::JsCodeResult,
    transactions::{Transaction, TransactionType},
    GridController,
};

use super::TransactionInProgress;

impl TransactionInProgress {
    /// Creates and runs a new Transaction
    ///
    /// Description
    /// * `compute` triggers the computation cycle
    pub fn new(
        grid_controller: &mut GridController,
        operations: Vec<Operation>,
        cursor: Option<String>,
        compute: bool,
        transaction_type: TransactionType,
    ) -> Self {
        let mut transaction = Self {
            reverse_operations: vec![],
            summary: TransactionSummary::default(),
            cursor,
            transaction_type,
            cells_to_compute: IndexSet::new(),
            cells_accessed: vec![],
            sheets_with_changed_bounds: HashSet::new(),

            has_async: false,

            current_code_cell: None,
            current_cell_ref: None,
            waiting_for_async: None,

            complete: false,
        };

        // apply operations
        transaction.transact(grid_controller, operations, compute);

        // run computations
        if compute {
            transaction.loop_compute(grid_controller);
        } else {
            transaction.complete = true;
        }

        transaction
    }

    // loop compute cycle until complete or an async call is made
    pub(super) fn loop_compute(&mut self, grid_controller: &mut GridController) {
        loop {
            self.compute(grid_controller);
            if self.waiting_for_async.is_some() {
                break;
            }
            if self.cells_to_compute.is_empty() {
                self.complete = true;
                self.summary.save = true;
                if self.has_async {
                    grid_controller.finalize_transaction(self);
                }
                break;
            }
        }
    }

    /// recalculate bounds for changed sheets
    pub fn updated_bounds(&mut self, grid_controller: &mut GridController) {
        self.sheets_with_changed_bounds.iter().for_each(|sheet_id| {
            let sheet = grid_controller.grid_mut().sheet_mut_from_id(*sheet_id);
            sheet.recalculate_bounds();
        });
    }

    /// returns the TransactionSummary
    pub fn transaction_summary(&mut self) -> TransactionSummary {
        let summary = self.summary.clone();
        self.summary.clear();
        summary
    }

    /// executes a set of operations
    fn transact(
        &mut self,
        grid_controller: &mut GridController,
        operations: Vec<Operation>,
        compute: bool,
    ) {
        for op in operations.iter() {
            if cfg!(feature = "show-operations") {
                crate::util::dbgjs(&format!("[Operation] {:?}", op.to_string()));
            }

            let reverse_operation = grid_controller.execute_operation(
                op.clone(),
                &mut self.cells_to_compute,
                &mut self.summary,
                &mut self.sheets_with_changed_bounds,
                compute,
            );
            self.reverse_operations.extend(reverse_operation);
        }
    }

    pub(super) fn code_cell_sheet_error(
        &mut self,
        grid_controller: &mut GridController,
        error_msg: String,
        line_number: Option<i64>,
    ) {
        let cell_ref = if let Some(cell_ref) = self.current_cell_ref {
            cell_ref
        } else {
            // this should only happen after an internal logic error
            crate::util::dbgjs(
                "Expected current_sheet_pos to be defined in transaction::code_cell_error",
            );
            return;
        };
        let mut updated_code_cell_value =
            if let Some(code_cell_value) = self.current_code_cell.clone() {
                code_cell_value
            } else {
                // this should only happen after an internal logic error
                crate::util::dbgjs(
                    "Expected current_code_cell to be defined in transaction::code_cell_error",
                );
                return;
            };
        let msg = ErrorMsg::PythonError(error_msg.clone().into());
        let span = line_number.map(|line_number| Span {
            start: line_number as u32,
            end: line_number as u32,
        });
        let error = Error { span, msg };
        let result = CodeCellRunResult::Err { error };
        updated_code_cell_value.output = Some(CodeCellRunOutput {
            std_out: None,
            std_err: Some(error_msg),
            result,
            spill: false,
        });
        update_code_cell_value(
            grid_controller,
            cell_ref,
            Some(updated_code_cell_value),
            &mut self.cells_to_compute,
            &mut self.reverse_operations,
            &mut self.summary,
        );
        self.summary.code_cells_modified.insert(cell_ref.sheet);
        self.waiting_for_async = None;
    }

    pub fn update_deps(&mut self, grid_controller: &mut GridController) {
        let old_deps = if let Some(current_code_cell) = self.current_code_cell.as_ref() {
            current_code_cell.cells_accessed_copy()
        } else {
            None
        };
        let deps = if !self.cells_accessed.is_empty() {
            Some(self.cells_accessed.clone())
        } else {
            None
        };
        if deps != old_deps {
            grid_controller.update_dependent_cells(self.current_cell_ref.unwrap(), deps, old_deps);
        }
        self.cells_accessed.clear();
    }

    /// continues the calculate cycle after an async call
    pub fn calculation_complete(
        &mut self,
        grid_controller: &mut GridController,
        result: JsCodeResult,
    ) {
        if self.complete {
            panic!("Transaction is already complete");
        }
        let (language, code_string) =
            if let Some(old_code_cell_value) = self.current_code_cell.clone() {
                (
                    old_code_cell_value.language,
                    old_code_cell_value.code_string,
                )
            } else {
                panic!("Expected current_code_cell to be defined in transaction::complete");
            };
        match self.waiting_for_async {
            None => {
                // this should only occur after an internal logic error
                crate::util::dbgjs("Expected transaction to be waiting_for_async to be defined in transaction::complete");
                return;
            }
            Some(waiting_for_async) => {
                match waiting_for_async {
                    CodeCellLanguage::Python => {
                        let cell_ref = if let Some(sheet_pos) = self.current_cell_ref {
                            sheet_pos
                        } else {
                            panic!(
                                "Expected current_sheet_pos to be defined in transaction::complete"
                            );
                        };
                        let sheet = grid_controller.grid_mut().sheet_mut_from_id(cell_ref.sheet);
                        let updated_code_cell_value = result.into_code_cell_value(
                            sheet,
                            cell_ref,
                            language,
                            code_string,
                            &self.cells_accessed,
                            &mut self.reverse_operations,
                        );
                        if update_code_cell_value(
                            grid_controller,
                            cell_ref,
                            Some(updated_code_cell_value),
                            &mut self.cells_to_compute,
                            &mut self.reverse_operations,
                            &mut self.summary,
                        ) {
                            // updates the dependencies only if the calculation was successful
                            self.update_deps(grid_controller);
                        }
                        self.waiting_for_async = None;
                    }
                    _ => {
                        crate::util::dbgjs("Transaction.complete called for an unhandled language");
                    }
                }
            }
        }
        // continue the compute loop after a successful async call
        self.loop_compute(grid_controller);
    }

    /// checks the next cell in the cells_to_compute and computes it
    /// returns true if an async call is made or the compute cycle is completed
    fn compute(&mut self, grid_controller: &mut GridController) {
        if let Some(cell_ref) = self.cells_to_compute.shift_remove_index(0) {
            // todo: this would be a good place to check for cycles
            // add all dependent cells to the cells_to_compute
            if let Some(dependent_cells) = grid_controller.get_dependent_cells(cell_ref) {
                self.cells_to_compute.extend(dependent_cells);
                dependent_cells.iter().for_each(|cell_ref| {
                    let sheet = grid_controller.sheet(cell_ref.sheet);
                    if cfg!(feature = "show-operations") {
                        if let Some(pos) = sheet.cell_ref_to_pos(*cell_ref) {
                            crate::util::dbgjs(format!("[Adding Dependent Cell] {:?}", pos));
                        }
                    }
                });
            }

            let sheet = grid_controller.grid().sheet_from_id(cell_ref.sheet);
            if let Some(pos) = sheet.cell_ref_to_pos(cell_ref) {
                // find which cells have code. Run the code and update the cells.
                // add the updated cells to the cells_to_compute

                if let Some(code_cell) = sheet.get_code_cell(pos) {
                    if cfg!(feature = "show-operations") {
                        crate::util::dbgjs(format!(
                            "[Compute] {:?} ({} remaining)",
                            pos,
                            self.cells_to_compute.len()
                        ));
                    }
                    self.current_cell_ref = Some(cell_ref);
                    self.current_code_cell = Some(code_cell.clone());
                    let code_string = code_cell.code_string.clone();
                    let language = code_cell.language;
                    match language {
                        CodeCellLanguage::Python => {
                            // python is run async so we exit the compute cycle and wait for TS to restart the transaction
                            if !cfg!(test) {
                                let result = crate::wasm_bindings::js::runPython(code_string);

                                // run python will return false if python is not loaded (this can be generalized if we need to return a different error)
                                if result == JsValue::FALSE {
                                    self.code_cell_sheet_error(
                                        grid_controller,
                                        "Python interpreter not yet loaded (please run again)"
                                            .to_string(),
                                        None,
                                    );
                                    return;
                                }
                            }
                            self.waiting_for_async = Some(language);
                            self.has_async = true;
                        }
                        CodeCellLanguage::Formula => {
                            self.eval_formula(
                                grid_controller,
                                code_string.clone(),
                                language,
                                pos,
                                cell_ref,
                                sheet.id,
                            );
                        }
                        _ => {
                            crate::util::dbgjs(format!(
                                "Compute language {} not supported in compute.rs",
                                language
                            ));
                        }
                    }
                }
            }
        }
    }
}

impl From<&TransactionInProgress> for Transaction {
    fn from(val: &TransactionInProgress) -> Self {
        Transaction {
            ops: val.reverse_operations.clone().into_iter().rev().collect(),
            cursor: val.cursor.clone(),
        }
    }
}

impl From<Transaction> for TransactionInProgress {
    fn from(val: Transaction) -> Self {
        TransactionInProgress {
            cursor: val.cursor,
            ..Default::default()
        }
    }
}

#[cfg(test)]
mod test {
    use std::{collections::HashSet, str::FromStr};

    use bigdecimal::BigDecimal;

    use crate::{
        controller::{
            operation::Operation,
            transaction_types::{CellForArray, JsCodeResult, JsComputeGetCells},
            transactions::TransactionType,
            GridController,
        },
        grid::{CodeCellLanguage, CodeCellValue},
        CellValue, Pos,
    };

    fn setup_python(
        gc: Option<GridController>,
        code_string: String,
        cell_value: CellValue,
    ) -> GridController {
        let mut gc = gc.unwrap_or_default();
        let sheet_ids = gc.sheet_ids();
        let sheet = gc.grid_mut().sheet_mut_from_id(sheet_ids[0]);
        let cell_value_pos = Pos { x: 0, y: 0 };
        let code_cell_pos = Pos { x: 1, y: 0 };
        sheet.set_cell_value(cell_value_pos, cell_value.clone());
        let cell_ref = sheet.get_or_create_cell_ref(code_cell_pos);

        gc.set_in_progress_transaction(
            vec![Operation::SetCellCode {
                cell_ref,
                code_cell_value: Some(CodeCellValue {
                    language: CodeCellLanguage::Python,
                    code_string: code_string.clone(),
                    formatted_code_string: None,
                    output: None,
                    last_modified: String::new(),
                }),
            }],
            None,
            true,
            crate::controller::transactions::TransactionType::Normal,
        );

        // code should be at (1, 0)
        let code_cell = gc
            .js_get_code_string(sheet_ids[0].to_string(), &code_cell_pos.clone())
            .unwrap();
        assert_eq!(code_cell.code_string(), code_string);
        assert_eq!(code_cell.language(), CodeCellLanguage::Python);

        // pending transaction
        let transaction = gc.get_transaction_in_progress().unwrap();
        assert!(!transaction.complete);
        assert_eq!(transaction.cells_to_compute.len(), 0);

        // pull out the code cell
        let cells_for_array = gc.calculation_get_cells(JsComputeGetCells::new(
            crate::Rect::single_pos(cell_value_pos),
            None,
            None,
        ));

        // inspect the cell_value cell at (0, 0)
        assert_eq!(cells_for_array.as_ref().unwrap().get_cells().len(), 1);
        assert_eq!(
            *cells_for_array.as_ref().unwrap().get_cells(),
            vec![CellForArray::new(
                cell_value_pos.x,
                cell_value_pos.y,
                Some(cell_value.to_string())
            )]
        );

        gc
    }

    fn test_python(
        gc: Option<GridController>,
        code_string: String,
        cell_value: CellValue,
        expected: String,
        array_output: Option<String>,
    ) -> (GridController, CodeCellValue) {
        let mut gc = setup_python(gc, code_string, cell_value);
        let sheet_id = gc.sheet_ids()[0];

        // mock the python result
        let result = JsCodeResult::new(
            true,
            None,
            None,
            None,
            Some(expected.clone()),
            array_output,
            None,
        );

        // complete the transaction and verify the result
        let summary = gc.calculation_complete(result);
        assert!(summary.save);
        assert_eq!(summary.code_cells_modified, HashSet::from([sheet_id]));

        let code_cell_value = gc
            .sheet(sheet_id)
            .get_code_cell(Pos { x: 1, y: 0 })
            .unwrap()
            .to_owned();

        (gc, code_cell_value)
    }

    fn python_array(
        gc: GridController,
        array: Vec<i32>,
        start_x: u32,
    ) -> (GridController, CodeCellValue) {
        let cell_value = CellValue::Blank;
        let numbers = array
            .iter()
            .map(|x| x.to_string())
            .collect::<Vec<String>>()
            .join(",");
        let strings = numbers.replace(',', r#"",""#);
        let code_string = format!("[{}]", numbers);
        let expected = code_string.clone();
        let array_output = format!(r#"[["{}"]]"#, strings);

        // maintain ownership of gc so that we can reuse for smaller array
        let (gc, code_cell_value) = test_python(
            Some(gc),
            code_string,
            cell_value.clone(),
            expected.clone(),
            Some(array_output),
        );
        let assert_at_pos = |x: u32, y: u32, value: u32| {
            assert_eq!(
                code_cell_value.get_output_value(x, y),
                Some(CellValue::Number(BigDecimal::from(value)))
            );
        };

        for (x, number) in array.iter().enumerate() {
            assert_at_pos(x as u32 + start_x, 0, *number as u32);
        }

        (gc, code_cell_value)
    }

    #[test]
    fn test_python_hello_world() {
        let code_string = "print('hello world')".to_string();
        let cell_value = CellValue::Blank;
        let expected = "hello world".to_string();
        let (_, code_cell_value) =
            test_python(None, code_string, cell_value, expected.clone(), None);

        // check that the value at (1,0) contains the expected output
        assert_eq!(
            code_cell_value.get_output_value(1, 0),
            Some(CellValue::Text(expected))
        );
    }

    #[test]
    fn test_python_addition_with_cell_reference() {
        let cell_value = CellValue::Number(BigDecimal::from(10));
        let code_string = "c(0, 0) + 1".to_string();
        let expected = "11".to_string();
        let (_, code_cell_value) =
            test_python(None, code_string, cell_value, expected.clone(), None);

        // check that the value at (1,0) contains the expected output
        assert_eq!(
            code_cell_value.get_output_value(1, 0),
            Some(CellValue::Number(BigDecimal::from_str(&expected).unwrap()))
        );
    }

    #[test]
    fn test_python_array_output_variable_length() {
        let gc = GridController::new();
        let (gc, _) = python_array(gc, vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0);

        // now shorten the array to make sure the old values are cleared properly
        let (_, code_cell_value) = python_array(gc, vec![11, 12, 13, 14, 15], 0);
        let assert_at_pos_none = |x: u32, y: u32| {
            assert_eq!(code_cell_value.get_output_value(x, y), None);
        };

        // check that the value at (5,0) -> (9,0) contains None
        assert_at_pos_none(5, 0);
        assert_at_pos_none(6, 0);
        assert_at_pos_none(7, 0);
        assert_at_pos_none(8, 0);
        assert_at_pos_none(9, 0);
    }

    #[test]
    fn test_python_error() {
        let gc = GridController::new();

        // first generate cell values from 0 -> 9 in the x-axis
        let (gc, code_cell_value) = python_array(gc, vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0);

        // cell values at (1,0) should now be 2
        assert_eq!(
            code_cell_value.get_output_value(1, 0),
            Some(CellValue::Number(BigDecimal::from(2)))
        );

        // now overwrite the cell at (1,0) with an invalid python expression
        let code_string = "asdf".to_string();
        let error = "NameError on line 1: name 'asdf' is not defined".to_string();
        let cell_value = CellValue::Blank;
        let mut gc = setup_python(Some(gc), code_string.clone(), cell_value);
        let sheet_id = gc.sheet_ids()[0];

        // mock the python error result
        let result = JsCodeResult::new(
            false,
            Some(code_string),
            Some(error),
            None,
            None,
            None,
            None,
        );

        // complete the transaction and verify the result
        let summary = gc.calculation_complete(result);
        assert!(summary.save);
        assert_eq!(summary.code_cells_modified, HashSet::from([sheet_id]));

        let code_cell_value = gc
            .sheet(sheet_id)
            .get_code_cell(Pos { x: 1, y: 0 })
            .unwrap()
            .to_owned();

        // cell values at (1,0) should now be none
        assert!(code_cell_value.get_output_value(1, 0).is_none());
    }

    #[test]
    fn test_execute_operation_set_cell_values_formula() {
        let mut gc = GridController::new();
        let sheet_ids = gc.sheet_ids();
        let sheet = gc.grid_mut().sheet_mut_from_id(sheet_ids[0]);

        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Number(BigDecimal::from(10)));
        let cell_ref = sheet.get_or_create_cell_ref(Pos { x: 1, y: 0 });
        gc.set_in_progress_transaction(
            vec![Operation::SetCellCode {
                cell_ref,
                code_cell_value: Some(CodeCellValue {
                    language: CodeCellLanguage::Formula,
                    code_string: "A0 + 1".to_string(),
                    formatted_code_string: None,
                    output: None,
                    last_modified: String::new(),
                }),
            }],
            None,
            true,
            crate::controller::transactions::TransactionType::Normal,
        );
        assert!(gc.get_transaction_in_progress().is_none());

        let sheet = gc.grid_mut().sheet_mut_from_id(sheet_ids[0]);
        assert!(sheet.get_code_cell(Pos { x: 1, y: 0 }).is_some());
        let code_cell = sheet.get_code_cell(Pos { x: 1, y: 0 }).unwrap();
        assert_eq!(code_cell.code_string, "A0 + 1".to_string());
        assert_eq!(
            code_cell.get_output_value(0, 0),
            Some(CellValue::Number(11.into()))
        );

        let cell_ref = sheet.get_or_create_cell_ref(Pos { x: 0, y: 0 });
        let dependencies = gc.get_dependent_cells(cell_ref).unwrap().clone();
        assert_eq!(dependencies.len(), 1);
    }

    #[test]
    fn test_multiple_formula() {
        let mut gc = GridController::new();
        let sheet_ids = gc.sheet_ids();
        let sheet = gc.grid_mut().sheet_mut_from_id(sheet_ids[0]);

        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Number(BigDecimal::from(10)));
        let cell_ref = sheet.get_or_create_cell_ref(Pos { x: 1, y: 0 });
        gc.set_in_progress_transaction(
            vec![Operation::SetCellCode {
                cell_ref,
                code_cell_value: Some(CodeCellValue {
                    language: CodeCellLanguage::Formula,
                    code_string: "A0 + 1".to_string(),
                    formatted_code_string: None,
                    output: None,
                    last_modified: String::new(),
                }),
            }],
            None,
            true,
            crate::controller::transactions::TransactionType::Normal,
        );

        let sheet = gc.grid_mut().sheet_mut_from_id(sheet_ids[0]);
        let cell_ref = sheet.get_or_create_cell_ref(Pos { x: 2, y: 0 });
        gc.set_in_progress_transaction(
            vec![Operation::SetCellCode {
                cell_ref,
                code_cell_value: Some(CodeCellValue {
                    language: CodeCellLanguage::Formula,
                    code_string: "B0 + 1".to_string(),
                    formatted_code_string: None,
                    output: None,
                    last_modified: String::new(),
                }),
            }],
            None,
            true,
            TransactionType::Normal,
        );

        let sheet = gc.grid_mut().sheet_mut_from_id(sheet_ids[0]);
        assert!(sheet.get_code_cell(Pos { x: 2, y: 0 }).is_some());
        let code_cell = sheet.get_code_cell(Pos { x: 2, y: 0 }).unwrap();
        assert_eq!(code_cell.code_string, "B0 + 1".to_string());
        assert_eq!(
            code_cell.get_output_value(0, 0),
            Some(CellValue::Number(12.into()))
        );
        assert_eq!(
            sheet.get_cell_value(Pos { x: 2, y: 0 }),
            Some(CellValue::Number(12.into()))
        );

        let sheet = gc.grid_mut().sheet_mut_from_id(sheet_ids[0]);
        let cell_ref = sheet.get_or_create_cell_ref(Pos { x: 0, y: 0 });
        gc.set_in_progress_transaction(
            vec![Operation::SetCellValues {
                region: cell_ref.into(),
                values: CellValue::Number(1.into()).into(),
            }],
            None,
            true,
            TransactionType::Normal,
        );

        let sheet = gc.grid_mut().sheet_mut_from_id(sheet_ids[0]);
        assert_eq!(
            sheet.get_cell_value(Pos { x: 1, y: 0 }),
            Some(CellValue::Number(2.into()))
        );
        assert_eq!(
            sheet.get_cell_value(Pos { x: 2, y: 0 }),
            Some(CellValue::Number(3.into()))
        );
    }
}

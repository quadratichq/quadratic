#[cfg(test)]
use crate::{
    Array, ArraySize, CellValue, Pos, SheetPos, Value,
    controller::{
        GridController, active_transactions::transaction_name::TransactionName,
        operations::operation::Operation,
    },
    grid::{CodeCellLanguage, CodeRun, DataTable, DataTableKind, SheetId},
};

/// Creates a Python code table with output of w x h cells with values 0, 1, ..., w * h - 1.
/// Forces show_name=true to ensure storage as DataTable (not CellValue::Code).
#[cfg(test)]
pub fn test_create_code_table(
    gc: &mut GridController,
    sheet_id: SheetId,
    pos: Pos,
    w: u32,
    h: u32,
) -> DataTable {
    let values: Vec<String> = (0..w * h).map(|i| i.to_string()).collect();
    let values: Vec<&str> = values.iter().map(|s| s.as_str()).collect();
    test_create_code_table_with_values(gc, sheet_id, pos, w, h, &values)
}

/// Creates a Python code table with output of w x h cells with values.
/// Forces show_name=true to ensure storage as DataTable (not CellValue::Code).
#[cfg(test)]
pub fn test_create_code_table_with_values(
    gc: &mut GridController,
    sheet_id: SheetId,
    pos: Pos,
    w: u32,
    h: u32,
    values: &[&str],
) -> DataTable {
    use crate::number::decimal_from_str;
    let array_size = ArraySize::new(w, h).unwrap();
    let mut array = Array::new_empty(array_size);
    for (i, s) in values.iter().enumerate() {
        if !s.is_empty() {
            let value = if let Ok(bd) = decimal_from_str(s) {
                CellValue::Number(bd)
            } else {
                CellValue::Text(s.to_string())
            };
            array.set(i as u32 % w, i as u32 / w, value, false).unwrap();
        }
    }

    let code_run = CodeRun {
        language: CodeCellLanguage::Python,
        code: "code".to_string(),
        formula_ast: None,
        std_out: None,
        std_err: None,
        cells_accessed: Default::default(),
        error: None,
        return_type: Some("number".into()),
        line_number: None,
        output_type: None,
    };

    // For 1x1 tables, use show_name=true to force storage as DataTable (prevents CellValue::Code)
    // For larger tables, show_name=false is fine since they won't be stored as CellValue::Code
    let show_name = if w == 1 && h == 1 { Some(true) } else { Some(false) };
    let data_table = DataTable::new(
        DataTableKind::CodeRun(code_run),
        "Table1",
        array.into(),
        false,
        show_name,
        Some(false),
        None,
    );

    test_create_raw_data_table(gc, pos.to_sheet_pos(sheet_id), data_table)
}

#[cfg(test)]
pub fn test_create_raw_data_table(
    gc: &mut GridController,
    sheet_pos: SheetPos,
    data_table: DataTable,
) -> DataTable {
    let op = Operation::SetDataTable {
        sheet_pos,
        data_table: Some(data_table),
        index: usize::MAX,
        ignore_old_data_table: true,
    };
    gc.start_user_ai_transaction(vec![op], None, TransactionName::Unknown, false);
    gc.data_table_at(sheet_pos).unwrap().clone()
}

#[cfg(test)]
pub fn test_create_formula(
    gc: &mut GridController,
    sheet_pos: SheetPos,
    formula: &str,
) -> DataTable {
    gc.set_code_cell(
        sheet_pos,
        CodeCellLanguage::Formula,
        formula.to_string(),
        None,
        None,
        false,
    );
    gc.data_table_at(sheet_pos).unwrap().clone()
}

#[cfg(test)]
mod tests {
    use crate::{number::decimal_from_str, test_util::*};

    use super::*;

    #[test]
    fn test_basic_code_table_creation() {
        let mut gc = GridController::test();
        let pos = pos![A1];
        let sheet_id = SheetId::TEST;

        // Test 2x2 table with numbers
        test_create_code_table_with_values(&mut gc, sheet_id, pos, 2, 2, &["1", "2", "3", "4"]);

        let sheet = sheet(&gc, sheet_id);

        let table = sheet.data_table_at(&pos).unwrap();
        if let Value::Array(array) = &table.value {
            assert_eq!(array.width(), 2);
            assert_eq!(array.height(), 2);
            assert_eq!(
                array.get(0, 0).unwrap(),
                &CellValue::Number(decimal_from_str("1").unwrap())
            );
        } else {
            panic!("Expected array value");
        }
    }

    #[test]
    fn test_mixed_content_code_table() {
        let mut gc = GridController::test();
        let sheet_id = SheetId::TEST;
        let pos = pos![A1];

        // Test 2x2 table with mixed content (numbers and text)
        test_create_code_table_with_values(
            &mut gc,
            sheet_id,
            pos,
            2,
            2,
            &["1", "text", "3.14", ""],
        );

        let sheet = sheet(&gc, sheet_id);
        let table = sheet.data_table_at(&pos).unwrap();

        if let Value::Array(array) = &table.value {
            assert_eq!(array.get(0, 0).unwrap(), &CellValue::Number(1.into()));
            assert_eq!(
                array.get(1, 0).unwrap(),
                &CellValue::Text("text".to_string())
            );
            assert_eq!(
                array.get(0, 1).unwrap(),
                &CellValue::Number(decimal_from_str("3.14").unwrap())
            );
            // Fourth cell should be empty
            assert_eq!(array.get(1, 1).unwrap(), &CellValue::Blank);
        } else {
            panic!("Expected array value");
        }
    }
}

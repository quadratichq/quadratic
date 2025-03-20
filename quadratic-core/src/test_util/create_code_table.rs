#[cfg(test)]
use std::str::FromStr;

#[cfg(test)]
use bigdecimal::BigDecimal;

#[cfg(test)]
use crate::{
    Array, ArraySize, CellValue, Pos, Value,
    controller::{
        GridController, active_transactions::transaction_name::TransactionName,
        operations::operation::Operation,
    },
    grid::{CodeCellLanguage, CodeCellValue, CodeRun, DataTable, DataTableKind, SheetId},
};

#[cfg(test)]
pub fn test_create_code_table_first_sheet(
    gc: &mut GridController,
    pos: Pos,
    w: u32,
    h: u32,
    values: Vec<&str>,
) {
    test_create_code_table(gc, gc.sheet_ids()[0], pos, w, h, values);
}

/// Creates a Python code table with output of w x h cells with values.
#[cfg(test)]
pub fn test_create_code_table(
    gc: &mut GridController,
    sheet_id: SheetId,
    pos: Pos,
    w: u32,
    h: u32,
    values: Vec<&str>,
) {
    let cell_value = CellValue::Code(CodeCellValue {
        language: CodeCellLanguage::Python,
        code: "code".to_string(),
    });

    let array_size = ArraySize::new(w, h).unwrap();
    let mut array = Array::new_empty(array_size);
    for (i, s) in values.iter().enumerate() {
        if !s.is_empty() {
            let value = if let Ok(bd) = BigDecimal::from_str(s) {
                CellValue::Number(bd)
            } else {
                CellValue::Text(s.to_string())
            };
            array.set(i as u32 % w, i as u32 / w, value).unwrap();
        }
    }

    let code_run = CodeRun {
        std_out: None,
        std_err: None,
        cells_accessed: Default::default(),
        error: None,
        return_type: Some("number".into()),
        line_number: None,
        output_type: None,
    };

    let data_table = DataTable::new(
        DataTableKind::CodeRun(code_run),
        "Table1",
        Value::Array(array),
        false,
        false,
        false,
        None,
    );

    let op = Operation::AddDataTable {
        sheet_pos: pos.to_sheet_pos(sheet_id),
        data_table,
        cell_value,
    };
    gc.start_user_transaction(vec![op], None, TransactionName::Unknown);
}

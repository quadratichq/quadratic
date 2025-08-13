#[cfg(test)]
use crate::{
    CellValue, Pos,
    controller::{
        GridController, transaction_types::JsCellValueResult, transaction_types::JsCodeResult,
    },
    grid::{CodeCellLanguage, CodeCellValue, DataTable, SheetId},
};

#[cfg(test)]
use super::sheet;

/// Creates a JS chart at the given position with the given width and height (in cells).
#[cfg(test)]
pub fn test_create_js_chart(gc: &mut GridController, sheet_id: SheetId, pos: Pos, w: u32, h: u32) {
    use crate::controller::transaction_types::JsCellValueResult;

    gc.set_code_cell(
        pos.to_sheet_pos(sheet_id),
        CodeCellLanguage::Javascript,
        "code".to_string(),
        None,
        None,
        false,
    );
    let sheet = sheet(gc, sheet_id);
    let (cell_width, cell_height) = sheet.offsets.defaults();

    let transaction = gc.last_transaction().unwrap();
    gc.calculation_complete(JsCodeResult {
        transaction_id: transaction.id.to_string(),
        success: true,
        std_out: None,
        std_err: None,
        line_number: None,
        output_value: Some(JsCellValueResult("image".to_string(), 8)),
        output_array: None,
        output_display_type: None,
        chart_pixel_output: Some((
            (w - 1) as f32 * cell_width as f32,
            (h - 1) as f32 * cell_height as f32,
        )),
        has_headers: false,
    })
    .unwrap();
}

/// Creates a JS chart at the given position with the given width and height (in cells).
#[cfg(test)]
pub fn test_create_html_chart(
    gc: &mut GridController,
    sheet_id: SheetId,
    pos: Pos,
    w: u32,
    h: u32,
) -> DataTable {
    gc.set_code_cell(
        pos.to_sheet_pos(sheet_id),
        CodeCellLanguage::Python,
        "<html></html>".to_string(),
        None,
        None,
        false,
    );
    let s = sheet(gc, sheet_id);
    let (cell_width, cell_height) = s.offsets.defaults();

    let transaction = gc.last_transaction().unwrap();
    gc.calculation_complete(JsCodeResult {
        transaction_id: transaction.id.to_string(),
        success: true,
        std_out: None,
        std_err: None,
        line_number: None,
        output_value: Some(JsCellValueResult("<html></html>".to_string(), 1)),
        output_array: None,
        output_display_type: None,
        chart_pixel_output: Some((
            (w - 1) as f32 * cell_width as f32,
            (h - 1) as f32 * cell_height as f32,
        )),
        has_headers: false,
    })
    .unwrap();

    let s = sheet(gc, sheet_id);
    s.data_table_at(&pos.into()).unwrap().clone()
}

#[cfg(test)]
mod tests {
    use crate::test_util::{assert_data_table_size, sheet};

    use super::*;

    #[test]
    fn test_js_chart_creation() {
        let mut gc = GridController::test();
        let sheet_id = SheetId::TEST;
        let pos = Pos::new(1, 1);

        let width = 2;
        let height = 3;

        test_create_js_chart(&mut gc, sheet_id, pos, width, height);

        // Verify code cell was created
        let sheet = sheet(&gc, sheet_id);
        let cell_value = sheet.cell_value(pos).unwrap();
        assert!(matches!(
            cell_value,
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Javascript,
                code: ref c,
            }) if c == "code"
        ));
        assert!(sheet.data_table_at(&pos.into()).unwrap().is_image());
        assert_data_table_size(&gc, sheet_id, pos, width as usize, height as usize, false);
    }

    #[test]
    fn test_html_chart_creation() {
        let mut gc = GridController::test();
        let sheet_id = SheetId::TEST;
        let pos = Pos::new(1, 1);

        let width = 2;
        let height = 3;

        test_create_html_chart(&mut gc, sheet_id, pos, width, height);

        // Verify code cell was created
        let sheet = sheet(&gc, sheet_id);
        let cell_value = sheet.cell_value(pos).unwrap();
        assert!(matches!(
            cell_value,
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: ref c,
            }) if c == "<html></html>"
        ));
        assert!(sheet.data_table_at(&pos.into()).unwrap().is_html());
        assert_data_table_size(&gc, sheet_id, pos, width as usize, height as usize, false);
    }
}

use crate::grid::{sheet::borders::JsBordersSheet, Sheet, SheetId};

impl Sheet {
    /// Gets packaged borders to send to the client.
    pub fn borders_in_sheet(&self) -> Option<JsBordersSheet> {
        let mut horizontal = vec![];
        let mut vertical = vec![];

        // get sheet borders
        if let Some(h) = self.borders.horizontal_borders(None) {
            horizontal.extend(h);
        }
        if let Some(v) = self.borders.vertical_borders(None) {
            vertical.extend(v);
        }

        // get table borders and translate them to sheet coordinates
        self.data_tables.iter().for_each(|(pos, table)| {
            if let Some(h) = table.borders.horizontal_borders(Some((*pos, table))) {
                horizontal.extend(h);
            }
            if let Some(v) = table.borders.vertical_borders(Some((*pos, table))) {
                vertical.extend(v);
            }
        });

        Some(JsBordersSheet {
            horizontal: if horizontal.is_empty() {
                None
            } else {
                Some(horizontal)
            },
            vertical: if vertical.is_empty() {
                None
            } else {
                Some(vertical)
            },
        })
    }

    /// Sends the borders for the sheet to the client.
    pub fn send_sheet_borders(&self, sheet_id: SheetId) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        match self.borders_in_sheet() {
            Some(b) => {
                if let Ok(borders) = serde_json::to_string(&b) {
                    crate::wasm_bindings::js::jsBordersSheet(sheet_id.to_string(), borders);
                } else {
                    dbgjs!("Unable to serialize borders in send_sheet_borders");
                }
            }
            None => crate::wasm_bindings::js::jsBordersSheet(sheet_id.to_string(), String::new()),
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        a1::A1Selection,
        controller::GridController,
        grid::sheet::borders::{BorderSelection, BorderStyle},
    };

    #[test]
    fn test_render_borders_table_1x1() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_data_table(pos![A1], 1, 1, false, false);

        let context = gc.grid().a1_context();
        gc.set_borders(
            A1Selection::test_a1_context("Table1", &context),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let borders = sheet.borders_in_sheet().unwrap();

        assert_eq!(borders.horizontal.unwrap().len(), 2);
        assert_eq!(borders.vertical.unwrap().len(), 2);
    }

    #[test]
    fn test_render_borders_table_3x3() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_data_table(pos![A1], 3, 3, false, false);

        let context = gc.grid().a1_context();
        gc.set_borders(
            A1Selection::test_a1_context("Table1", &context),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let borders = sheet.borders_in_sheet().unwrap();

        assert_eq!(borders.horizontal.unwrap().len(), 4);
        assert_eq!(borders.vertical.unwrap().len(), 4);
    }

    #[test]
    fn test_render_borders_table_3x3_two_columns() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_data_table(pos![A1], 3, 3, false, false);

        let context = gc.grid().a1_context();
        gc.set_borders(
            A1Selection::test_a1_context("Table1[[Column 1]:[Column 2]]", &context),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let borders = sheet.borders_in_sheet().unwrap();

        assert_eq!(borders.horizontal.unwrap().len(), 4);
        assert_eq!(borders.vertical.unwrap().len(), 3);
    }

    #[test]
    fn test_render_borders_table_3x3_outer() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_data_table(pos![A1], 3, 3, false, false);

        let context = gc.grid().a1_context();
        gc.set_borders(
            A1Selection::test_a1_context("Table1[#All]", &context),
            BorderSelection::Outer,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let borders = sheet.borders_in_sheet().unwrap();
        assert_eq!(borders.horizontal.unwrap().len(), 2);
        assert_eq!(borders.vertical.unwrap().len(), 2);
    }
}

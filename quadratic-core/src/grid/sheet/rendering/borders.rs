use crate::{
    grid::{sheet::borders::JsBordersSheet, Sheet, SheetId},
    wasm_bindings::js::jsBordersSheet,
};

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
            if let Some(h) = table
                .borders
                .horizontal_borders(Some(table.output_rect(*pos, true, true)))
            {
                horizontal.extend(h);
            }
            if let Some(v) = table
                .borders
                .vertical_borders(Some(table.output_rect(*pos, true, true)))
            {
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
        match self.borders_in_sheet() {
            Some(b) => {
                if let Ok(borders) = serde_json::to_string(&b) {
                    jsBordersSheet(sheet_id.to_string(), borders);
                } else {
                    dbgjs!("Unable to serialize borders in send_sheet_borders");
                }
            }
            None => jsBordersSheet(sheet_id.to_string(), String::new()),
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::{
        a1::A1Selection,
        controller::GridController,
        grid::sheet::borders::{BorderSelection, BorderStyle},
    };

    #[test]
    fn test_render_borders_table() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_code_run_array_2d(2, 3, 2, 2, vec!["1", "2", "3", "4"]);

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
    }
}

use crate::grid::{Sheet, sheet::borders::JsBordersSheet};

impl Sheet {
    /// Gets packaged borders to send to the client.
    pub fn borders_in_sheet(&self) -> JsBordersSheet {
        let mut horizontal = vec![];
        let mut vertical = vec![];

        // get sheet borders with merged cell handling
        if let Some(h) = self
            .borders
            .horizontal_borders(None, Some(&self.merge_cells))
        {
            horizontal.extend(h);
        }
        if let Some(v) = self.borders.vertical_borders(None, Some(&self.merge_cells)) {
            vertical.extend(v);
        }

        // get table borders and translate them to sheet coordinates
        // Tables cannot overlap merged cells, so we don't need to check merge_cells for table borders
        self.data_tables.expensive_iter().for_each(|(pos, table)| {
            if let Some(borders) = table.borders.as_ref() {
                if let Some(h) = borders.horizontal_borders(Some((*pos, table)), None) {
                    horizontal.extend(h);
                }
                if let Some(v) = borders.vertical_borders(Some((*pos, table)), None) {
                    vertical.extend(v);
                }
            }
        });

        JsBordersSheet {
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
        }
    }

    /// Sends the borders for the sheet to the client.
    pub fn send_sheet_borders(&self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        match serde_json::to_vec(&self.borders_in_sheet()) {
            Ok(borders) => {
                crate::wasm_bindings::js::jsBordersSheet(self.id_to_string(), borders);
            }
            Err(e) => {
                dbgjs!(format!(
                    "[send_sheet_borders] Error serializing sheet borders {:?}",
                    e
                ));
            }
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
        gc.test_set_data_table(
            pos![A1].to_sheet_pos(sheet_id),
            1,
            1,
            false,
            Some(false),
            Some(false),
        );

        let context = gc.a1_context();
        gc.set_borders(
            A1Selection::test_a1_context("Table1", context),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let borders = sheet.borders_in_sheet();

        assert_eq!(borders.horizontal.unwrap().len(), 2);
        assert_eq!(borders.vertical.unwrap().len(), 2);
    }

    #[test]
    fn test_render_borders_table_3x3() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.test_set_data_table(
            pos![A1].to_sheet_pos(sheet_id),
            3,
            3,
            false,
            Some(false),
            Some(false),
        );

        let context = gc.a1_context();
        gc.set_borders(
            A1Selection::test_a1_context("Table1", context),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let borders = sheet.borders_in_sheet();

        assert_eq!(borders.horizontal.unwrap().len(), 4);
        assert_eq!(borders.vertical.unwrap().len(), 4);
    }

    #[test]
    fn test_render_borders_table_3x3_two_columns() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.test_set_data_table(
            pos![A1].to_sheet_pos(sheet_id),
            3,
            3,
            false,
            Some(false),
            Some(false),
        );

        let context = gc.a1_context();
        gc.set_borders(
            A1Selection::test_a1_context("Table1[[Column 1]:[Column 2]]", context),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let borders = sheet.borders_in_sheet();

        assert_eq!(borders.horizontal.unwrap().len(), 4);
        assert_eq!(borders.vertical.unwrap().len(), 3);
    }

    #[test]
    fn test_render_borders_table_3x3_outer() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.test_set_data_table(
            pos![A1].to_sheet_pos(sheet_id),
            3,
            3,
            false,
            Some(false),
            Some(false),
        );

        let context = gc.a1_context();
        gc.set_borders(
            A1Selection::test_a1_context("Table1[#All]", context),
            BorderSelection::Outer,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let borders = sheet.borders_in_sheet();
        assert_eq!(borders.horizontal.unwrap().len(), 2);
        assert_eq!(borders.vertical.unwrap().len(), 2);
    }
}

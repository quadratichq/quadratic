//! Sending conditional formats to the client.

use crate::{a1::A1Context, grid::Sheet};

impl Sheet {
    /// Sends all conditional formats for this sheet to the client.
    /// Converts the formulas to parsed rules for easy display/editing.
    pub fn send_all_conditional_formats(&self, a1_context: &A1Context) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        // Convert to client-friendly format with parsed rules
        let formats: Vec<_> = self
            .conditional_formats
            .iter()
            .map(|cf| cf.to_client(self.id, a1_context))
            .collect();

        match serde_json::to_vec(&formats) {
            Ok(data) => {
                crate::wasm_bindings::js::jsSheetConditionalFormats(self.id.to_string(), data);
            }
            Err(e) => {
                dbgjs!(format!("Failed to serialize conditional formats: {}", e));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use crate::{
        a1::A1Selection,
        controller::GridController,
        formulas::parse_formula,
        grid::sheet::conditional_format::{ConditionalFormat, ConditionalFormatStyle},
        wasm_bindings::js::expect_js_call,
    };

    #[test]
    fn send_all_conditional_formats() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let selection = A1Selection::test_a1_sheet_id("A1:B2", sheet_id);
        let pos = selection.cursor.to_sheet_pos(sheet_id);
        let formula = parse_formula("=A1>5", gc.a1_context(), pos).unwrap();

        let format = ConditionalFormat {
            id: Uuid::new_v4(),
            selection,
            config: crate::grid::sheet::conditional_format::ConditionalFormatConfig::Formula {
                rule: formula,
                style: ConditionalFormatStyle {
                    bold: Some(true),
                    ..Default::default()
                },
            },
            apply_to_blank: None,
        };

        {
            let sheet = gc.sheet_mut(sheet_id);
            sheet.conditional_formats.set(format.clone(), sheet_id);
        }

        let a1_context = gc.a1_context();
        let sheet = gc.sheet(sheet_id);
        sheet.send_all_conditional_formats(a1_context);

        // The formats are converted to client format with parsed rules
        let formats: Vec<_> = sheet
            .conditional_formats
            .iter()
            .map(|cf| cf.to_client(sheet_id, a1_context))
            .collect();
        expect_js_call(
            "jsSheetConditionalFormats",
            format!(
                "{},{:?}",
                sheet.id,
                serde_json::to_vec(&formats).unwrap()
            ),
            true,
        );
    }
}

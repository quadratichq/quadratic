use std::collections::HashSet;

use crate::grid::formats::format::Format;
use crate::grid::formats::format_update::FormatUpdate;
use crate::grid::Sheet;
use crate::Pos;

impl Sheet {
    // gets decimal_places for a cell, including checking sheet format
    pub fn decimal_places(&self, x: i64, y: i64) -> Option<i16> {
        if let Some(decimals) = self
            .get_column(x)
            .and_then(|column| column.numeric_decimals.get(y))
        {
            Some(decimals)
        } else {
            let column = self.try_format_column(x);
            let row = self.try_format_row(y);
            let sheet = self.format_all.as_ref();
            let format = Format::combine(None, column.as_ref(), row.as_ref(), sheet);
            if format.numeric_decimals.is_some() {
                format.numeric_decimals
            } else {
                None
            }
        }
    }

    /// Gets a format for a cell, returning Format::default if not set.
    pub fn format_cell(&self, x: i64, y: i64, include_sheet: bool) -> Format {
        let format = self.get_column(x).map(|column| Format {
            align: column.align.get(y),
            vertical_align: column.vertical_align.get(y),
            wrap: column.wrap.get(y),
            numeric_format: column.numeric_format.get(y),
            numeric_decimals: column.numeric_decimals.get(y),
            numeric_commas: column.numeric_commas.get(y),
            bold: column.bold.get(y),
            italic: column.italic.get(y),
            text_color: column.text_color.get(y),
            fill_color: column.fill_color.get(y),
            render_size: column.render_size.get(y),
            date_time: column.date_time.get(y),
            underline: column.underline.get(y),
            strike_through: column.strike_through.get(y),
        });
        if include_sheet {
            let column = self.try_format_column(x);
            let row = self.try_format_row(y);
            let sheet = self.format_all.as_ref();
            Format::combine(format.as_ref(), column.as_ref(), row.as_ref(), sheet)
        } else {
            format.unwrap_or_default()
        }
    }

    /// Gets a format for a cell, returning Format::default if not set.
    pub fn try_format_cell(&self, x: i64, y: i64) -> Option<Format> {
        self.get_column(x)
            .map(|column| Format {
                align: column.align.get(y),
                vertical_align: column.vertical_align.get(y),
                wrap: column.wrap.get(y),
                numeric_format: column.numeric_format.get(y),
                numeric_decimals: column.numeric_decimals.get(y),
                numeric_commas: column.numeric_commas.get(y),
                bold: column.bold.get(y),
                italic: column.italic.get(y),
                text_color: column.text_color.get(y),
                fill_color: column.fill_color.get(y),
                render_size: column.render_size.get(y),
                date_time: column.date_time.get(y),
                underline: column.underline.get(y),
                strike_through: column.strike_through.get(y),
            })
            .filter(|format| !format.is_default())
    }

    /// Sets a cell's format based on a FormatUpdate. Returns FormatUpdate, which is
    /// used to undo the change.
    /// * send_client - if true, send the changes to the client
    ///
    /// TODO: this will be replaced by the new column.format.
    pub fn set_format_cell(
        &mut self,
        pos: Pos,
        update: &FormatUpdate,
        send_client: bool,
    ) -> FormatUpdate {
        let mut old_format = FormatUpdate::default();
        let column = self.get_or_create_column(pos.x);
        let y = pos.y;
        if let Some(align) = update.align {
            old_format.align = Some(column.align.get(y));
            column.align.set(y, align);
        }
        if let Some(vertical_align) = update.vertical_align {
            old_format.vertical_align = Some(column.vertical_align.get(y));
            column.vertical_align.set(y, vertical_align);
        }
        if let Some(wrap) = update.wrap {
            old_format.wrap = Some(column.wrap.get(y));
            column.wrap.set(y, wrap);
        }
        if let Some(numeric_format) = update.numeric_format.as_ref() {
            old_format.numeric_format = Some(column.numeric_format.get(y));
            column.numeric_format.set(y, numeric_format.clone());
        }
        if let Some(numeric_decimals) = update.numeric_decimals {
            old_format.numeric_decimals = Some(column.numeric_decimals.get(y));
            column.numeric_decimals.set(y, numeric_decimals);
        }
        if let Some(numeric_commas) = update.numeric_commas {
            old_format.numeric_commas = Some(column.numeric_commas.get(y));
            column.numeric_commas.set(y, numeric_commas);
        }
        if let Some(bold) = update.bold {
            old_format.bold = Some(column.bold.get(y));
            column.bold.set(y, bold);
        }
        if let Some(italic) = update.italic {
            old_format.italic = Some(column.italic.get(y));
            column.italic.set(y, italic);
        }
        if let Some(text_color) = update.text_color.as_ref() {
            old_format.text_color = Some(column.text_color.get(y));
            column.text_color.set(y, text_color.clone());
        }
        if let Some(fill_color) = update.fill_color.as_ref() {
            old_format.fill_color = Some(column.fill_color.get(y));
            column.fill_color.set(y, fill_color.clone());
        }
        if let Some(render_size) = update.render_size.as_ref() {
            old_format.render_size = Some(column.render_size.get(y));
            column.render_size.set(y, render_size.clone());
        }

        if let Some(dt) = update.date_time.as_ref() {
            old_format.date_time = Some(column.date_time.get(y));
            column.date_time.set(y, dt.clone());
        }

        if let Some(underline) = update.underline {
            old_format.underline = Some(column.underline.get(y));
            column.underline.set(y, underline);
        }

        if let Some(strike_through) = update.strike_through {
            old_format.strike_through = Some(column.strike_through.get(y));
            column.strike_through.set(y, strike_through);
        }

        if send_client {
            let mut positions = HashSet::new();
            positions.insert(pos);
            if update.render_cells_changed() {
                self.send_render_cells(&positions);
            }
            if update.html_changed() {
                self.send_html_output(&positions);
            }
            if update.fill_changed() {
                self.send_fills(&positions);
            }
        }

        old_format
    }
}

#[cfg(test)]
mod tests {
    use serial_test::{parallel, serial};

    use super::*;
    use crate::grid::formats::Formats;
    use crate::grid::js_types::{JsNumber, JsRenderCell};
    use crate::grid::CellAlign;
    use crate::wasm_bindings::js::{expect_js_call, hash_test};

    #[test]
    #[parallel]
    fn format_cell() {
        let mut sheet = Sheet::test();
        assert_eq!(sheet.format_cell(0, 0, false), Format::default());
        sheet.set_format_cell(
            Pos { x: 0, y: 0 },
            &FormatUpdate {
                bold: Some(Some(true)),
                ..Default::default()
            },
            false,
        );
        assert_eq!(
            sheet.format_cell(0, 0, false),
            Format {
                bold: Some(true),
                ..Default::default()
            }
        );

        sheet.set_formats_columns(
            &[0],
            &Formats::repeat(
                FormatUpdate {
                    text_color: Some(Some("red".to_string())),
                    ..Default::default()
                },
                1,
            ),
        );
        sheet.set_formats_rows(
            &[0],
            &Formats::repeat(
                FormatUpdate {
                    italic: Some(Some(false)),
                    ..Default::default()
                },
                1,
            ),
        );
        assert_eq!(
            sheet.format_cell(0, 0, true),
            Format {
                bold: Some(true),
                italic: Some(false),
                text_color: Some("red".to_string()),
                ..Default::default()
            },
        );
    }

    #[test]
    #[serial]
    fn set_format_cell() {
        let mut sheet = Sheet::test();
        let update = FormatUpdate {
            bold: Some(Some(true)),
            ..FormatUpdate::default()
        };
        sheet.test_set_value_number(0, 0, "5");
        let pos = Pos { x: 0, y: 0 };
        let old_format = sheet.set_format_cell(pos, &update, true);
        assert_eq!(
            sheet.format_cell(0, 0, false),
            Format {
                bold: Some(true),
                ..Default::default()
            }
        );
        assert_eq!(
            old_format,
            FormatUpdate {
                bold: Some(None),
                ..Default::default()
            }
        );

        let cells = serde_json::to_string(&vec![JsRenderCell {
            x: pos.x,
            y: pos.y,
            value: "5".to_string(),
            align: Some(CellAlign::Right),
            bold: Some(true),
            number: Some(JsNumber::default()),
            ..Default::default()
        }])
        .unwrap();
        let args = format!("{},{},{},{}", sheet.id, 0, 0, hash_test(&cells));
        expect_js_call("jsRenderCellSheets", args, true);

        sheet.set_format_cell(pos, &old_format, true);
        assert_eq!(sheet.format_cell(0, 0, false), Format::default());
        let cells = serde_json::to_string(&vec![JsRenderCell {
            x: pos.x,
            y: pos.y,
            value: "5".to_string(),
            align: Some(CellAlign::Right),
            number: Some(JsNumber::default()),
            ..Default::default()
        }])
        .unwrap();
        let args = format!("{},{},{},{}", sheet.id, 0, 0, hash_test(&cells));
        expect_js_call("jsRenderCellSheets", args, true);
    }

    #[test]
    #[parallel]
    fn decimal_places() {
        let mut sheet = Sheet::test();
        assert_eq!(sheet.decimal_places(0, 0), None);

        sheet.set_formats_rows(
            &[0],
            &Formats::repeat(
                FormatUpdate {
                    numeric_decimals: Some(Some(3)),
                    ..Default::default()
                },
                1,
            ),
        );
        assert_eq!(sheet.decimal_places(0, 0), Some(3));

        sheet.set_formats_columns(
            &[0],
            &Formats::repeat(
                FormatUpdate {
                    numeric_decimals: Some(Some(2)),
                    ..Default::default()
                },
                1,
            ),
        );
        assert_eq!(sheet.decimal_places(0, 0), Some(2));

        sheet.set_format_cell(
            (0, 0).into(),
            &FormatUpdate {
                numeric_decimals: Some(Some(5)),
                ..Default::default()
            },
            false,
        );
        assert_eq!(sheet.decimal_places(0, 0), Some(5));
    }
}

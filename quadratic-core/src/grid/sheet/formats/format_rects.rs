use std::collections::HashSet;

use crate::{
    controller::operations::operation::Operation,
    grid::{
        formats::{format_update::FormatUpdate, Formats},
        CellWrap, Sheet,
    },
    selection::Selection,
    Pos, Rect,
};

impl Sheet {
    /// Sets the Formats for Vec<Rect> and returns operations to reverse the change.
    // (crate)
    pub fn set_formats_rects(
        &mut self,
        rects: &[Rect],
        formats: &Formats,
    ) -> (Vec<Operation>, Vec<i64>) {
        let mut formats_iter = formats.iter_values();

        // tracks client changes
        let mut renders = HashSet::new();
        let mut html = HashSet::new();
        let mut fills = HashSet::new();
        let mut resize_rows = HashSet::new();

        let mut old_formats = Formats::default();
        rects.iter().for_each(|rect| {
            for x in rect.min.x..=rect.max.x {
                for y in rect.min.y..=rect.max.y {
                    let pos = Pos { x, y };
                    if let Some(format_update) = formats_iter.next() {
                        let old = self.set_format_cell(pos, format_update, false);
                        let old_wrap = old.wrap;
                        old_formats.push(old);

                        if format_update.render_cells_changed() {
                            renders.insert(pos);
                        }
                        if format_update.html_changed() {
                            html.insert(pos);
                        }
                        if format_update.fill_changed() {
                            fills.insert(pos);
                        }
                        dbgjs!(format!(
                            "old_wrap: {:?}, new_wrap: {:?}",
                            old_wrap, format_update.wrap
                        ));
                        if matches!(old_wrap, Some(Some(CellWrap::Wrap)))
                            || matches!(format_update.wrap, Some(Some(CellWrap::Wrap)))
                        {
                            resize_rows.insert(pos.y);
                        }
                    } else {
                        old_formats.push(FormatUpdate::default());
                    }
                }
            }
        });

        self.send_render_cells(&renders);
        self.send_html_output(&html);
        self.send_fills(&fills);

        (
            vec![Operation::SetCellFormatsSelection {
                selection: Selection {
                    sheet_id: self.id,
                    rects: Some(rects.to_vec()),
                    ..Default::default()
                },
                formats: old_formats,
            }],
            resize_rows.into_iter().collect(),
        )
    }
}

#[cfg(test)]
mod test {
    use serial_test::{parallel, serial};

    use super::*;
    use crate::{
        grid::{formats::format::Format, RenderSize},
        wasm_bindings::js::{expect_js_call, hash_test},
        CellValue,
    };

    #[test]
    #[serial]
    fn set_formats_rects() {
        let mut sheet = Sheet::test();
        let formats = Formats::repeat(
            FormatUpdate {
                bold: Some(Some(true)),
                ..Default::default()
            },
            4,
        );
        let rect = Rect::from_numbers(0, 0, 2, 2);
        let reverse = sheet.set_formats_rects(&[rect], &formats).0;
        assert_eq!(sheet.format_cell(0, 0, false).bold, Some(true));
        assert_eq!(sheet.format_cell(1, 1, false).bold, Some(true));
        assert_eq!(sheet.format_cell(2, 2, false).bold, None);

        assert_eq!(reverse.len(), 1);
        assert_eq!(
            reverse[0],
            Operation::SetCellFormatsSelection {
                selection: Selection {
                    sheet_id: sheet.id,
                    rects: Some(vec![rect]),
                    ..Default::default()
                },
                formats: Formats::repeat(
                    FormatUpdate {
                        bold: Some(None),
                        ..Default::default()
                    },
                    4,
                ),
            }
        );

        let cells =
            serde_json::to_string(&sheet.get_render_cells(Rect::from_numbers(0, 0, 2, 2))).unwrap();
        let args = format!("{},{},{},{}", sheet.id, 0, 0, hash_test(&cells));
        expect_js_call("jsRenderCellSheets", args, true);
    }

    #[test]
    #[serial]
    fn set_formats_selection_rect_html() {
        let mut sheet = Sheet::test();
        let pos = Pos { x: 1, y: 1 };
        sheet.test_set_code_run_single(1, 1, CellValue::Html("test".to_string()));
        let formats = Formats::repeat(
            FormatUpdate {
                render_size: Some(Some(RenderSize {
                    w: "1".to_string(),
                    h: "2".to_string(),
                })),
                ..Default::default()
            },
            1,
        );
        sheet.set_formats_rects(&[Rect::single_pos(pos)], &formats);
        let expected = sheet.get_single_html_output(pos).unwrap();
        expect_js_call(
            "jsUpdateHtml",
            serde_json::to_string(&expected).unwrap(),
            true,
        );
    }

    #[test]
    #[parallel]
    fn set_format_rects_none() {
        let mut sheet = Sheet::test();
        let formats = Formats::repeat(
            FormatUpdate {
                fill_color: Some(Some("red".to_string())),
                ..Default::default()
            },
            4,
        );
        let rect = Rect::from_numbers(0, 0, 2, 2);
        let reverse = sheet.set_formats_rects(&[rect], &formats).0;
        assert_eq!(
            sheet.format_cell(0, 0, false),
            Format {
                fill_color: Some("red".to_string()),
                ..Default::default()
            }
        );
        assert_eq!(
            sheet.format_cell(1, 1, false),
            Format {
                fill_color: Some("red".to_string()),
                ..Default::default()
            }
        );
        assert_eq!(
            sheet.format_cell(2, 2, false),
            Format {
                fill_color: None,
                ..Default::default()
            }
        );

        assert_eq!(reverse.len(), 1);
        assert_eq!(
            reverse[0],
            Operation::SetCellFormatsSelection {
                selection: Selection {
                    sheet_id: sheet.id,
                    rects: Some(vec![rect]),
                    ..Default::default()
                },
                formats: Formats::repeat(
                    FormatUpdate {
                        fill_color: Some(None),
                        ..Default::default()
                    },
                    4
                ),
            }
        );

        let formats = Formats::repeat(
            FormatUpdate {
                fill_color: Some(None),
                ..Default::default()
            },
            4,
        );
        sheet.set_formats_rects(&[rect], &formats);
        assert_eq!(sheet.format_cell(0, 0, false), Format::default());
        assert_eq!(sheet.format_cell(1, 1, false), Format::default());
    }
}

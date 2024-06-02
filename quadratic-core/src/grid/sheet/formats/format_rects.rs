use std::collections::HashSet;

use crate::{controller::operations::operation::Operation, grid::{formats::{format_update::FormatUpdate, formats::Formats}, Sheet}, selection::Selection, Pos, Rect};

impl Sheet {
    /// Sets the Formats for Vec<Rect> and returns operations to reverse the change.
    // (crate)
    pub fn set_formats_rects(&mut self, rects: &Vec<Rect>, formats: &Formats) -> Vec<Operation> {
        let mut formats_iter = formats.iter_values();

        // tracks client changes
        let mut renders = HashSet::new();
        let mut html = HashSet::new();
        let mut fills = HashSet::new();

        let mut old_formats = Formats::default();
        rects.iter().for_each(|rect| {
            for x in rect.min.x..=rect.max.x {
                for y in rect.min.y..=rect.max.y {
                    let pos = Pos { x, y };
                    if let Some(format_update) = formats_iter.next() {
                        let old = self.set_format_cell(pos, format_update, false);
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
                    } else {
                        old_formats.push(FormatUpdate::default());
                    }
                }
            }
        });

        self.send_render_cells(&renders);
        self.send_html_output(&html);
        self.send_fills(&fills);

        vec![Operation::SetCellFormatsSelection { selection: Selection { rects: Some(rects.clone()), ..Default::default()}, formats: old_formats }]
    }
}

#[cfg(test)]
mod test {
    use crate::wasm_bindings::js::{expect_js_call, hash_test};
    use super::*;

    #[test]
    fn set_formats_selection_rect() {
        let mut sheet = Sheet::test();
        let formats = Formats::repeat(
            FormatUpdate {
                bold: Some(Some(true)),
                ..Default::default()
            },
            4,
        );
        let rect = Rect::from_numbers(0, 0, 2, 2);
        let old_formats = sheet.set_formats_rects(&vec![rect], &formats);
        assert_eq!(old_formats.len(), 1);
        assert_eq!(
            sheet.format_cell(0,0).bold,
            Some(true)
        );
        assert_eq!(
            sheet.format_cell(1, 1).bold,
            Some(true)
        );
        assert_eq!(
            sheet.format_cell(2, 2).bold,
            None
        );

        let cells =
            serde_json::to_string(&sheet.get_render_cells(Rect::from_numbers(0, 0, 2, 2))).unwrap();
        let args = format!("{},{},{},{}", sheet.id, 0, 0, hash_test(&cells));
        expect_js_call("jsRenderCellSheets", args, true);

        // let old_formats = sheet.set_formats_rects(&vec![rect], &old_formats);
        // assert!(sheet
        //     .get_formatting_value::<Bold>(Pos { x: 0, y: 0 })
        //     .is_none());
        // assert!(sheet
        //     .get_formatting_value::<Bold>(Pos { x: 1, y: 1 })
        //     .is_none());
        // assert_eq!(old_formats, formats);
    }

    #[test]
    fn set_formats_selection_rect_html() {
        todo!();

        // let mut sheet = Sheet::test();
        // let pos = Pos { x: 1, y: 1 };
        // sheet.set_cell_value(
        //     pos,
        //     CellValue::Code(CodeCellValue {
        //         language: CodeCellLanguage::Formula,
        //         code: "test".to_string(),
        //     }),
        // );

        // let code_run = CodeRun {
        //     std_err: None,
        //     std_out: None,
        //     formatted_code_string: None,
        //     cells_accessed: HashSet::new(),
        //     result: CodeRunResult::Ok(Value::Single(CellValue::Html("test".to_string()))),
        //     return_type: Some("number".into()),
        //     line_number: None,
        //     output_type: None,
        //     spill_error: false,
        //     last_modified: Utc::now(),
        // };

        // sheet.test_set_code_run_single(pos.x, pos.y, CellValue::Text("text".to_string()));
        // let formats = Formats::repeat(
        //     FormatUpdate {
        //         render_size: Some(Some(RenderSize {
        //             w: "1".to_string(),
        //             h: "2".to_string(),
        //         })),
        //         ..Default::default()
        //     },
        //     1,
        // );
        // sheet.set_formats_rects(&vec![Rect::single_pos(pos)], &formats);
        // let expected = sheet.get_single_html_output(pos).unwrap();
        // expect_js_call(
        //     "jsUpdateHtml",
        //     serde_json::to_string(&expected).unwrap(),
        //     true,
        // );
    }

    #[test]
    fn set_formats_rects() {
        todo!();
        // let mut sheet = Sheet::test();
        // let mut formats = Formats::repeat(
        //     FormatUpdate {
        //         bold: Some(Some(true)),
        //         ..Default::default()
        //     },
        //     4,
        // );
        // let rect1 = Rect::from_numbers(0, 0, 2, 2);
        // formats.push(FormatUpdate {
        //     italic: Some(Some(true)),
        //     ..Default::default()
        // });
        // let rect2 = Rect::from_numbers(2, 2, 1, 1);
        // let old_formats = sheet.set_formats_rects(&vec![rect1, rect2], &formats);
        // assert_eq!(
        //     sheet.get_formatting_value::<Italic>(Pos { x: 2, y: 2 }),
        //     Some(true)
        // );
        // assert_eq!(
        //     sheet.get_formatting_value::<Italic>(Pos { x: 3, y: 3 }),
        //     None
        // );
        // assert_eq!(
        //     sheet.get_formatting_value::<Bold>(Pos { x: 0, y: 0 }),
        //     Some(true)
        // );
        // assert_eq!(
        //     sheet.get_formatting_value::<Bold>(Pos { x: 1, y: 1 }),
        //     Some(true)
        // );
        // assert_eq!(sheet.get_formatting_value::<Bold>(Pos { x: 2, y: 2 }), None);

        // let old_formats = sheet.set_formats_rects(&vec![rect1, rect2], &old_formats);
        // assert!(sheet
        //     .get_formatting_value::<Italic>((2, 2).into())
        //     .is_none());
        // assert!(sheet
        //     .get_formatting_value::<Italic>((3, 3).into())
        //     .is_none());
        // assert!(sheet.get_formatting_value::<Bold>((0, 0).into()).is_none());
        // assert!(sheet.get_formatting_value::<Bold>((1, 1).into()).is_none());

        // assert_eq!(old_formats, formats);
    }
}
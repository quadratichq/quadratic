// // todo: this should probably be deleted.

// use crate::grid::formats::{Format, FormatUpdate};
// use crate::grid::Sheet;
// use crate::Pos;

// impl Sheet {
//     /// Gets a format for a cell, returning Format::default if not set.
//     pub fn format_cell(&self, _x: i64, _y: i64, _include_sheet: bool) -> Format {
//         dbgjs!("todo: format_cell - isn't this implemented elsewhere?");
//         // it is not

//         Format::default()

//         // let format = self.get_column(x).map(|column| Format {
//         //     align: column.align.get(y),
//         //     vertical_align: column.vertical_align.get(y),
//         //     wrap: column.wrap.get(y),
//         //     numeric_format: column.numeric_format.get(y),
//         //     numeric_decimals: column.numeric_decimals.get(y),
//         //     numeric_commas: column.numeric_commas.get(y),
//         //     bold: column.bold.get(y),
//         //     italic: column.italic.get(y),
//         //     text_color: column.text_color.get(y),
//         //     fill_color: column.fill_color.get(y),
//         //     render_size: column.render_size.get(y),
//         //     date_time: column.date_time.get(y),
//         //     underline: column.underline.get(y),
//         //     strike_through: column.strike_through.get(y),
//         // });
//         // if include_sheet {
//         //     let column = self.try_format_column(x);
//         //     let row = self.try_format_row(y);
//         //     let sheet = self.format_all.as_ref();
//         //     Format::combine(format.as_ref(), column.as_ref(), row.as_ref(), sheet)
//         // } else {
//         //     format.unwrap_or_default()
//         // }
//     }

//     /// Tries to get a format for a cell, returning None if no formatting is set, or the A1 is invalid.
//     pub fn format_cell_a1(&self, _a1: &str, _include_sheet: bool) -> Option<Format> {
//         todo!("wrong level of abstraction. parse A1 elsewhere, then call some lower-level function. or make this #[cfg(test)]")

//         // if let Some(pos) = Pos::try_a1_string(a1) {
//         //     let format = self.format_cell(pos.x, pos.y, include_sheet);
//         //     if format.is_default() {
//         //         None
//         //     } else {
//         //         Some(format)
//         //     }
//         // } else {
//         //     dbgjs!(format!("Invalid A1 string: {}", a1));
//         //     None
//         // }
//     }

//     /// Gets a format for a cell, returning None if not set.
//     pub fn try_format_cell(&self, _x: i64, _y: i64) -> Option<Format> {
//         todo!("don't we have another function that does this?")
//         // self.get_column(x)
//         //     .map(|column| Format {
//         //         align: column.align.get(y),
//         //         vertical_align: column.vertical_align.get(y),
//         //         wrap: column.wrap.get(y),
//         //         numeric_format: column.numeric_format.get(y),
//         //         numeric_decimals: column.numeric_decimals.get(y),
//         //         numeric_commas: column.numeric_commas.get(y),
//         //         bold: column.bold.get(y),
//         //         italic: column.italic.get(y),
//         //         text_color: column.text_color.get(y),
//         //         fill_color: column.fill_color.get(y),
//         //         render_size: column.render_size.get(y),
//         //         date_time: column.date_time.get(y),
//         //         underline: column.underline.get(y),
//         //         strike_through: column.strike_through.get(y),
//         //     })
//         //     .filter(|format| !format.is_default())
//     }
// }

// #[cfg(test)]
// mod tests {
//     use serial_test::{parallel, serial};

//     use super::*;
//     use crate::grid::formats::Formats;
//     use crate::grid::js_types::{JsNumber, JsRenderCell};
//     use crate::grid::CellAlign;
//     use crate::wasm_bindings::js::{expect_js_call, hash_test};

//     #[test]
//     #[parallel]
//     fn format_cell() {
//         let mut sheet = Sheet::test();
//         assert_eq!(sheet.format_cell(0, 0, false), Format::default());
//         sheet.set_format_cell(
//             Pos { x: 0, y: 0 },
//             &FormatUpdate {
//                 bold: Some(Some(true)),
//                 ..Default::default()
//             },
//             false,
//         );
//         assert_eq!(
//             sheet.format_cell(0, 0, false),
//             Format {
//                 bold: Some(true),
//                 ..Default::default()
//             }
//         );

//         sheet.set_formats_columns(
//             &[0],
//             &Formats::repeat(
//                 FormatUpdate {
//                     text_color: Some(Some("red".to_string())),
//                     ..Default::default()
//                 },
//                 1,
//             ),
//         );
//         sheet.set_formats_rows(
//             &[0],
//             &Formats::repeat(
//                 FormatUpdate {
//                     italic: Some(Some(false)),
//                     ..Default::default()
//                 },
//                 1,
//             ),
//         );
//         assert_eq!(
//             sheet.format_cell(0, 0, true),
//             Format {
//                 bold: Some(true),
//                 italic: Some(false),
//                 text_color: Some("red".to_string()),
//                 ..Default::default()
//             },
//         );
//     }

//     #[test]
//     #[serial]
//     fn set_format_cell() {
//         let mut sheet = Sheet::test();
//         let update = FormatUpdate {
//             bold: Some(Some(true)),
//             ..FormatUpdate::default()
//         };
//         sheet.test_set_value_number(0, 0, "5");
//         let pos = Pos { x: 0, y: 0 };
//         let old_format = sheet.set_format_cell(pos, &update, true);
//         assert_eq!(
//             sheet.format_cell(0, 0, false),
//             Format {
//                 bold: Some(true),
//                 ..Default::default()
//             }
//         );
//         assert_eq!(
//             old_format,
//             FormatUpdate {
//                 bold: Some(None),
//                 ..Default::default()
//             }
//         );

//         let cells = serde_json::to_string(&vec![JsRenderCell {
//             x: pos.x,
//             y: pos.y,
//             value: "5".to_string(),
//             align: Some(CellAlign::Right),
//             bold: Some(true),
//             number: Some(JsNumber::default()),
//             ..Default::default()
//         }])
//         .unwrap();
//         let args = format!("{},{},{},{}", sheet.id, 0, 0, hash_test(&cells));
//         expect_js_call("jsRenderCellSheets", args, true);

//         sheet.set_format_cell(pos, &old_format, true);
//         assert_eq!(sheet.format_cell(0, 0, false), Format::default());
//         let cells = serde_json::to_string(&vec![JsRenderCell {
//             x: pos.x,
//             y: pos.y,
//             value: "5".to_string(),
//             align: Some(CellAlign::Right),
//             number: Some(JsNumber::default()),
//             ..Default::default()
//         }])
//         .unwrap();
//         let args = format!("{},{},{},{}", sheet.id, 0, 0, hash_test(&cells));
//         expect_js_call("jsRenderCellSheets", args, true);
//     }
// }

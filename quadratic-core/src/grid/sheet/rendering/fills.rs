//! Cell fill color for client rendering. There are two types of fills:
//! JsRenderFill, which are finite rects, and JsSheetFill, which are infinite
//! rects. All data_table fills are sent as JsRenderFill since they are finite
//! (even if defined as infinite).

use crate::{
    grid::{
        js_types::{JsRenderFill, JsSheetFill},
        Sheet,
    },
    Pos,
};

impl Sheet {
    /// Returns true if the table has any fills.
    pub fn table_has_fills(&self, pos: Pos) -> bool {
        self.data_tables
            .iter()
            .any(|(p, dt)| p == &pos && !dt.formats.fill_color.is_all_default())
    }

    /// Returns all data for rendering cell fill color.
    pub fn get_all_render_fills(&self) -> Vec<JsRenderFill> {
        self.formats
            .fill_color
            .to_rects()
            .filter_map(|(x0, y0, x1, y1, color)| {
                if let (Some(x1), Some(y1)) = (x1, y1) {
                    Some(JsRenderFill {
                        x: x0,
                        y: y0,
                        w: (x1 - x0 + 1) as u32,
                        h: (y1 - y0 + 1) as u32,
                        color,
                    })
                } else {
                    None
                }
            })
            .chain(self.data_tables.iter().flat_map(|(pos, dt)| {
                dt.formats
                    .fill_color
                    .to_rects()
                    .flat_map(|(mut x0, mut y0, x1, y1, color)| {
                        let mut fills = vec![];

                        if dt.spill_error || dt.has_error() {
                            return fills;
                        }

                        let mut rect = dt.output_rect(*pos, false);
                        // use table data bounds for fills, exclude table name and column headers
                        rect.min.y += dt.y_adjustment(true);

                        // convert unbounded to bounded
                        let mut x1 = x1.unwrap_or(rect.width() as i64);
                        let mut y1 = y1.unwrap_or(rect.height() as i64);

                        // adjust for hidden columns, and convert to 0 based
                        x0 = dt.get_display_index_from_column_index(x0 as u32 - 1, false);
                        x1 = dt.get_display_index_from_column_index(x1 as u32 - 1, true);

                        // convert to 0 based
                        y0 -= 1;
                        y1 -= 1;

                        let fills_min_y = (pos.y + dt.y_adjustment(false)).max(pos.y);

                        if let Some(display_buffer) = &dt.display_buffer {
                            for y in y0..=y1 {
                                let x = rect.min.x + x0;
                                let x1 = rect.min.x + x1;

                                // formats is 1 based, display_buffer is 0 based
                                let mut y = y;
                                if y >= 0 && y < display_buffer.len() as i64 {
                                    y = display_buffer
                                        .iter()
                                        .position(|&display_y| y == display_y as i64)
                                        .unwrap_or(y as usize)
                                        as i64;
                                }
                                y += rect.min.y;

                                // check if the fill is within the table bounds and size is non zero
                                if x1 >= x && y >= fills_min_y {
                                    fills.push(JsRenderFill {
                                        x,
                                        y,
                                        w: (x1 - x + 1) as u32,
                                        h: 1,
                                        color: color.clone(),
                                    });
                                }
                            }
                        } else {
                            let x = rect.min.x + x0;
                            let y = (rect.min.y + y0).max(fills_min_y);
                            let x1 = rect.min.x + x1;
                            let y1 = rect.min.y + y1;
                            // check if size is non zero
                            if x1 >= x && y1 >= y {
                                fills.push(JsRenderFill {
                                    x,
                                    y,
                                    w: (x1 - x + 1) as u32,
                                    h: (y1 - y + 1) as u32,
                                    color,
                                });
                            };
                        }

                        fills
                    })
            }))
            .collect()
    }

    /// Returns all fills for the rows, columns, and sheet. This does not return
    /// individual cell formats.
    pub fn get_all_sheet_fills(&self) -> Vec<JsSheetFill> {
        self.formats
            .fill_color
            .to_rects()
            .filter_map(|(x0, y0, x1, y1, color)| {
                if x1.is_some() && y1.is_some() {
                    None
                } else {
                    Some(JsSheetFill {
                        x: x0 as u32,
                        y: y0 as u32,
                        w: x1.map(|x1| (x1 - x0 + 1) as u32),
                        h: y1.map(|y1| (y1 - y0 + 1) as u32),
                        color,
                    })
                }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        a1::A1Selection,
        controller::{user_actions::import::tests::simple_csv_at, GridController},
        grid::sort::SortDirection,
        CellValue, Pos,
    };

    use super::*;

    #[track_caller]
    fn assert_fill_eq(fill: &JsRenderFill, x: i64, y: i64, w: u32, h: u32, color: &str) {
        assert_eq!(
            fill,
            &JsRenderFill {
                x,
                y,
                w,
                h,
                color: color.to_string()
            }
        );
    }

    #[test]
    fn test_get_all_render_fills() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.get_all_sheet_fills(), vec![]);

        gc.set_fill_color(&A1Selection::test_a1("B:D"), Some("red".to_string()), None)
            .unwrap();
        gc.set_fill_color(&A1Selection::test_a1("2"), Some("blue".to_string()), None)
            .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.get_all_sheet_fills(),
            vec![
                JsSheetFill {
                    x: 2,
                    y: 3,
                    w: Some(3),
                    h: None,
                    color: "red".to_string(),
                },
                JsSheetFill {
                    x: 5,
                    y: 2,
                    w: None,
                    h: Some(1),
                    color: "blue".to_string(),
                }
            ]
        );

        gc.set_fill_color(&A1Selection::test_a1("*"), Some("green".to_string()), None)
            .unwrap();
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.get_all_sheet_fills(),
            vec![JsSheetFill {
                x: 1,
                y: 1,
                w: None,
                h: None,
                color: "green".to_string()
            }]
        );
    }

    #[test]
    fn test_get_all_render_fills_table() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);

        // set a data table at E2 that's 3x3 and show_header is true
        sheet.test_set_data_table(pos!(E2), 3, 3, false, true);
        let context = gc.grid().a1_context();
        gc.set_fill_color(
            &A1Selection::test_a1_context("Table1[Column 2]", &context),
            Some("red".to_string()),
            None,
        )
        .unwrap();
        gc.set_fill_color(
            &A1Selection::test_a1_context("Table1[Column 3]", &context),
            Some("blue".to_string()),
            None,
        )
        .unwrap();
        let sheet = gc.sheet_mut(sheet_id);
        sheet.data_table_mut(Pos { x: 5, y: 2 }).unwrap().show_ui = true;
        let fills = sheet.get_all_render_fills();
        assert_eq!(fills.len(), 2);
        assert_fill_eq(&fills[0], 6, 4, 1, 3, "red");
        assert_fill_eq(&fills[1], 7, 4, 1, 3, "blue");
    }

    #[test]
    fn test_table_has_fills() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_code_run_array_2d(
            5,
            2,
            3,
            3,
            vec!["1", "2", "3", "4", "5", "6", "7", "8", "9"],
        );
        assert!(!sheet.table_has_fills(Pos { x: 5, y: 2 }));
        let context = gc.grid().a1_context();
        gc.set_fill_color(
            &A1Selection::test_a1_context("Table1[Column 2]", &context),
            Some("red".to_string()),
            None,
        )
        .unwrap();
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.table_has_fills(Pos { x: 5, y: 2 }));
    }

    #[test]
    fn test_get_all_render_fills_table_show_ui_options_first_row_header() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);

        // set a data table at E2 that's 3x3 and show_header is true
        sheet.test_set_data_table(pos!(E2), 3, 3, false, true);
        let context = gc.grid().a1_context();
        gc.set_fill_color(
            &A1Selection::test_a1_sheet_id("E5:I5", &sheet_id),
            Some("red".to_string()),
            None,
        )
        .unwrap();
        gc.set_fill_color(
            &A1Selection::test_a1_context("Table1[Column 2]", &context),
            Some("blue".to_string()),
            None,
        )
        .unwrap();

        let sheet = gc.sheet_mut(sheet_id);
        sheet.data_table_mut(Pos { x: 5, y: 2 }).unwrap().show_ui = false;
        let fills = sheet.get_all_render_fills();
        assert_fill_eq(&fills[0], 8, 5, 2, 1, "red");
        assert_fill_eq(&fills[1], 5, 3, 1, 1, "red");
        assert_fill_eq(&fills[2], 6, 2, 1, 3, "blue");
        assert_fill_eq(&fills[3], 7, 3, 1, 1, "red");

        let sheet = gc.sheet_mut(sheet_id);
        sheet.data_table_mut(Pos { x: 5, y: 2 }).unwrap().show_ui = true;
        let fills = sheet.get_all_render_fills();
        assert_fill_eq(&fills[0], 8, 5, 2, 1, "red");
        assert_fill_eq(&fills[1], 5, 5, 1, 1, "red");
        assert_fill_eq(&fills[2], 6, 4, 1, 3, "blue");
        assert_fill_eq(&fills[3], 7, 5, 1, 1, "red");

        let sheet = gc.sheet_mut(sheet_id);
        sheet.data_table_mut(Pos { x: 5, y: 2 }).unwrap().show_name = false;
        let fills = sheet.get_all_render_fills();
        assert_fill_eq(&fills[0], 8, 5, 2, 1, "red");
        assert_fill_eq(&fills[1], 5, 4, 1, 1, "red");
        assert_fill_eq(&fills[2], 6, 3, 1, 3, "blue");
        assert_fill_eq(&fills[3], 7, 4, 1, 1, "red");

        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .data_table_mut(Pos { x: 5, y: 2 })
            .unwrap()
            .show_columns = false;
        let fills = sheet.get_all_render_fills();
        assert_fill_eq(&fills[0], 8, 5, 2, 1, "red");
        assert_fill_eq(&fills[1], 5, 3, 1, 1, "red");
        assert_fill_eq(&fills[2], 6, 2, 1, 3, "blue");
        assert_fill_eq(&fills[3], 7, 3, 1, 1, "red");

        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .data_table_mut(Pos { x: 5, y: 2 })
            .unwrap()
            .header_is_first_row = true;
        let fills = sheet.get_all_render_fills();
        assert_fill_eq(&fills[0], 8, 5, 2, 1, "red");
        assert_fill_eq(&fills[1], 5, 2, 1, 1, "red");
        assert_fill_eq(&fills[2], 6, 2, 1, 2, "blue");
        assert_fill_eq(&fills[3], 7, 2, 1, 1, "red");

        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .data_table_mut(Pos { x: 5, y: 2 })
            .unwrap()
            .show_columns = true;
        let fills = sheet.get_all_render_fills();
        assert_fill_eq(&fills[0], 8, 5, 2, 1, "red");
        assert_fill_eq(&fills[1], 5, 3, 1, 1, "red");
        assert_fill_eq(&fills[2], 6, 3, 1, 2, "blue");
        assert_fill_eq(&fills[3], 7, 3, 1, 1, "red");
    }

    #[test]
    fn test_get_all_render_fills_table_with_sort() {
        let (mut gc, sheet_id, pos, file_name) = simple_csv_at(pos!(E2));
        let context = gc.grid().a1_context();
        gc.set_fill_color(
            &A1Selection::test_a1_sheet_id("E4:I4", &sheet_id),
            Some("red".to_string()),
            None,
        )
        .unwrap();
        gc.set_fill_color(
            &A1Selection::test_a1_context(&format!("{}[region]", file_name), &context),
            Some("blue".to_string()),
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table(pos).unwrap();
        assert_eq!(
            data_table.cell_value_at(0, 2),
            Some(CellValue::Text("Southborough".to_string()))
        );
        assert_eq!(
            data_table.cell_value_at(0, 4),
            Some(CellValue::Text("Westborough".to_string()))
        );
        let fills = sheet.get_all_render_fills();
        assert_fill_eq(&fills[0], 9, 4, 1, 1, "red");
        assert_fill_eq(&fills[1], 5, 4, 1, 1, "red");
        assert_fill_eq(&fills[2], 6, 4, 1, 10, "blue");
        assert_fill_eq(&fills[3], 7, 4, 2, 1, "red");

        let sheet = gc.sheet_mut(sheet_id);
        let data_table = sheet.data_table_mut(pos).unwrap();
        data_table
            .sort_column(0, SortDirection::Descending)
            .unwrap();

        let data_table = data_table.clone();
        let sheet: &mut Sheet = gc.sheet_mut(sheet_id);
        assert_eq!(
            data_table.cell_value_at(0, 8),
            Some(CellValue::Text("Southborough".to_string()))
        );
        let fills = sheet.get_all_render_fills();
        assert_eq!(fills.len(), 13);
        assert_fill_eq(&fills[0], 9, 4, 1, 1, "red");
        assert_fill_eq(&fills[1], 5, 10, 1, 1, "red");
        assert_fill_eq(&fills[12], 7, 10, 2, 1, "red");
    }

    #[test]
    fn test_get_all_render_fills_table_with_hidden_columns() {
        let (mut gc, sheet_id, pos, file_name) = simple_csv_at(pos!(E2));

        let context = gc.grid().a1_context();

        gc.set_fill_color(
            &A1Selection::test_a1_sheet_id("E4:I4", &sheet_id),
            Some("red".to_string()),
            None,
        )
        .unwrap();
        gc.set_fill_color(
            &A1Selection::test_a1_context(&format!("{}[region]", file_name), &context),
            Some("blue".to_string()),
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table(pos).unwrap();
        assert_eq!(
            data_table.cell_value_at(0, 2),
            Some(CellValue::Text("Southborough".to_string()))
        );
        let fills = sheet.get_all_render_fills();
        assert_fill_eq(&fills[0], 9, 4, 1, 1, "red");
        assert_fill_eq(&fills[1], 5, 4, 1, 1, "red");
        assert_fill_eq(&fills[2], 6, 4, 1, 10, "blue");
        assert_fill_eq(&fills[3], 7, 4, 2, 1, "red");

        let data_table = gc.sheet_mut(sheet_id).data_table_mut(pos).unwrap();
        let column_headers = data_table.column_headers.as_mut().unwrap();
        column_headers[0].display = false;

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table(pos).unwrap();
        assert_eq!(
            data_table.cell_value_at(0, 2),
            Some(CellValue::Text("MA".to_string()))
        );
        let fills = sheet.get_all_render_fills();
        assert_fill_eq(&fills[0], 9, 4, 1, 1, "red");
        assert_fill_eq(&fills[1], 5, 4, 1, 10, "blue");
        assert_fill_eq(&fills[2], 6, 4, 2, 1, "red");

        gc.set_fill_color(
            &A1Selection::test_a1_sheet_id("E10:I10", &sheet_id),
            Some("green".to_string()),
            None,
        )
        .unwrap();
        gc.set_fill_color(
            &A1Selection::test_a1_context(&format!("{}[country]", file_name), &context),
            Some("yellow".to_string()),
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        let fills = sheet.get_all_render_fills();
        assert_fill_eq(&fills[0], 8, 10, 1, 1, "green");
        assert_fill_eq(&fills[1], 9, 4, 1, 1, "red");
        assert_fill_eq(&fills[2], 9, 10, 1, 1, "green");
        assert_fill_eq(&fills[3], 5, 4, 1, 6, "blue");
        assert_fill_eq(&fills[4], 5, 10, 1, 1, "green");
        assert_fill_eq(&fills[5], 5, 11, 1, 3, "blue");
        assert_fill_eq(&fills[6], 6, 4, 1, 10, "yellow");
        assert_fill_eq(&fills[7], 7, 4, 1, 1, "red");
        assert_fill_eq(&fills[8], 7, 10, 1, 1, "green");

        let data_table = gc.sheet_mut(sheet_id).data_table_mut(pos).unwrap();
        let column_headers = data_table.column_headers.as_mut().unwrap();
        column_headers[0].display = true;

        let sheet = gc.sheet(sheet_id);
        let fills = sheet.get_all_render_fills();
        assert_fill_eq(&fills[0], 8, 10, 1, 1, "green");
        assert_fill_eq(&fills[1], 9, 4, 1, 1, "red");
        assert_fill_eq(&fills[2], 9, 10, 1, 1, "green");
        assert_fill_eq(&fills[3], 5, 4, 1, 1, "red");
        assert_fill_eq(&fills[4], 6, 4, 1, 6, "blue");
        assert_fill_eq(&fills[5], 6, 10, 1, 1, "green");
        assert_fill_eq(&fills[6], 6, 11, 1, 3, "blue");
        assert_fill_eq(&fills[7], 7, 4, 1, 10, "yellow");
        assert_fill_eq(&fills[8], 8, 4, 1, 1, "red");
        assert_fill_eq(&fills[9], 8, 10, 1, 1, "green");
    }
}

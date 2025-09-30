//! Cell fill color for client rendering. There are two types of fills:
//! JsRenderFill, which are finite rects, and JsSheetFill, which are infinite
//! rects. All data_table fills are sent as JsRenderFill since they are finite
//! (even if defined as infinite).

#[cfg(test)]
use crate::Pos;
use crate::grid::{
    Sheet,
    js_types::{JsRenderFill, JsSheetFill},
};

impl Sheet {
    /// Returns true if the table has any fills.
    #[cfg(test)]
    pub(crate) fn table_has_fills(&self, pos: Pos) -> bool {
        self.data_table_at(&pos).is_some_and(|dt| {
            !dt.formats
                .as_ref()
                .is_none_or(|formats| formats.fill_color.is_all_default())
        })
    }

    /// Returns all data for rendering cell fill color.
    pub(crate) fn get_all_render_fills(&self) -> Vec<JsRenderFill> {
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
            .chain(
                self.data_tables
                    .expensive_iter()
                    .filter_map(|(pos, dt)| {
                        let reverse_display_buffer = dt.get_reverse_display_buffer();
                        dt.formats.as_ref().map(|formats| {
                            formats.fill_color.to_rects().flat_map(
                                move |(mut x0, mut y0, x1, y1, color)| {
                                    let mut fills = vec![];
                                    if dt.has_spill() || dt.has_error() {
                                        return fills;
                                    }
                                    let mut rect = dt.output_rect(*pos, false);
                                    rect.min.y += dt.y_adjustment(true);
                                    let mut x1 = x1.unwrap_or(rect.width() as i64);
                                    let mut y1 = y1.unwrap_or(rect.height() as i64);
                                    x0 = dt
                                        .get_display_index_from_column_index(x0 as u32 - 1, false);
                                    x1 =
                                        dt.get_display_index_from_column_index(x1 as u32 - 1, true);
                                    y0 -= 1;
                                    y1 -= 1;
                                    let fills_min_y = (pos.y + dt.y_adjustment(false)).max(pos.y);
                                    if dt.display_buffer.is_some() {
                                        for y in y0..=y1 {
                                            let x = rect.min.x + x0;
                                            let x1 = rect.min.x + x1;
                                            let mut y = dt
                                                .get_display_index_from_reverse_display_buffer(
                                                    y as u64,
                                                    reverse_display_buffer.as_ref(),
                                                )
                                                as i64;
                                            y += rect.min.y;
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
                                },
                            )
                        })
                    })
                    .flatten(),
            )
            .collect()
    }

    /// Returns all fills for the rows, columns, and sheet. This does not return
    /// individual cell formats.
    pub(crate) fn get_all_sheet_fills(&self) -> Vec<JsSheetFill> {
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
        CellValue, Pos,
        a1::A1Selection,
        controller::{GridController, user_actions::import::tests::simple_csv_at},
        grid::sort::SortDirection,
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

        gc.set_fill_color(
            &A1Selection::test_a1("B:D"),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();
        gc.set_fill_color(
            &A1Selection::test_a1("2"),
            Some("blue".to_string()),
            None,
            false,
        )
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

        gc.set_fill_color(
            &A1Selection::test_a1("*"),
            Some("green".to_string()),
            None,
            false,
        )
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

        // set a data table at E2 that's 3x3 and show_header is true
        gc.test_set_data_table(
            pos!(E2).as_sheet_pos(sheet_id),
            3,
            3,
            false,
            Some(true),
            Some(true),
        );
        gc.set_fill_color(
            &A1Selection::test_a1_context("Table1[Column 2]", gc.a1_context()),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();
        gc.set_fill_color(
            &A1Selection::test_a1_context("Table1[Column 3]", gc.a1_context()),
            Some("blue".to_string()),
            None,
            false,
        )
        .unwrap();
        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .modify_data_table_at(&Pos { x: 5, y: 2 }, |dt| {
                dt.show_name = Some(true);
                dt.show_columns = Some(true);
                Ok(())
            })
            .unwrap();
        let fills = sheet.get_all_render_fills();
        assert_eq!(fills.len(), 2);
        assert_fill_eq(&fills[0], 6, 4, 1, 3, "red");
        assert_fill_eq(&fills[1], 7, 4, 1, 3, "blue");
    }

    #[test]
    fn test_table_has_fills() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.test_set_code_run_array_2d(
            sheet_id,
            5,
            2,
            3,
            3,
            vec!["1", "2", "3", "4", "5", "6", "7", "8", "9"],
        );

        assert!(!gc.sheet(sheet_id).table_has_fills(Pos { x: 5, y: 2 }));
        gc.set_fill_color(
            &A1Selection::test_a1_context("Table1[Column 2]", gc.a1_context()),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.table_has_fills(Pos { x: 5, y: 2 }));
    }

    #[test]
    fn test_get_all_render_fills_table_show_ui_options_first_row_header() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // set a data table at E2 that's 3x3 and show_header is true
        gc.test_set_data_table(
            pos!(E2).as_sheet_pos(sheet_id),
            3,
            3,
            false,
            Some(true),
            Some(true),
        );
        gc.set_fill_color(
            &A1Selection::test_a1_sheet_id("E5:I5", sheet_id),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();
        gc.set_fill_color(
            &A1Selection::test_a1_context("Table1[Column 2]", gc.a1_context()),
            Some("blue".to_string()),
            None,
            false,
        )
        .unwrap();

        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .modify_data_table_at(&Pos { x: 5, y: 2 }, |dt| {
                dt.show_name = Some(false);
                dt.show_columns = Some(false);
                Ok(())
            })
            .unwrap();

        let fills = sheet.get_all_render_fills();
        assert_fill_eq(&fills[0], 8, 5, 2, 1, "red");
        assert_fill_eq(&fills[1], 5, 3, 1, 1, "red");
        assert_fill_eq(&fills[2], 6, 2, 1, 3, "blue");
        assert_fill_eq(&fills[3], 7, 3, 1, 1, "red");

        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .modify_data_table_at(&Pos { x: 5, y: 2 }, |dt| {
                dt.show_name = Some(true);
                dt.show_columns = Some(true);
                Ok(())
            })
            .unwrap();
        let fills = sheet.get_all_render_fills();
        assert_fill_eq(&fills[0], 8, 5, 2, 1, "red");
        assert_fill_eq(&fills[1], 5, 5, 1, 1, "red");
        assert_fill_eq(&fills[2], 6, 4, 1, 3, "blue");
        assert_fill_eq(&fills[3], 7, 5, 1, 1, "red");

        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .modify_data_table_at(&Pos { x: 5, y: 2 }, |dt| {
                dt.show_name = Some(false);
                Ok(())
            })
            .unwrap();
        let fills = sheet.get_all_render_fills();
        assert_fill_eq(&fills[0], 8, 5, 2, 1, "red");
        assert_fill_eq(&fills[1], 5, 4, 1, 1, "red");
        assert_fill_eq(&fills[2], 6, 3, 1, 3, "blue");
        assert_fill_eq(&fills[3], 7, 4, 1, 1, "red");

        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .modify_data_table_at(&Pos { x: 5, y: 2 }, |dt| {
                dt.show_columns = Some(false);
                Ok(())
            })
            .unwrap();
        let fills = sheet.get_all_render_fills();
        assert_fill_eq(&fills[0], 8, 5, 2, 1, "red");
        assert_fill_eq(&fills[1], 5, 3, 1, 1, "red");
        assert_fill_eq(&fills[2], 6, 2, 1, 3, "blue");
        assert_fill_eq(&fills[3], 7, 3, 1, 1, "red");

        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .modify_data_table_at(&Pos { x: 5, y: 2 }, |dt| {
                dt.header_is_first_row = true;
                Ok(())
            })
            .unwrap();
        let fills = sheet.get_all_render_fills();
        assert_fill_eq(&fills[0], 8, 5, 2, 1, "red");
        assert_fill_eq(&fills[1], 5, 2, 1, 1, "red");
        assert_fill_eq(&fills[2], 6, 2, 1, 2, "blue");
        assert_fill_eq(&fills[3], 7, 2, 1, 1, "red");

        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .modify_data_table_at(&Pos { x: 5, y: 2 }, |dt| {
                dt.show_columns = Some(true);
                Ok(())
            })
            .unwrap();
        let fills = sheet.get_all_render_fills();
        assert_fill_eq(&fills[0], 8, 5, 2, 1, "red");
        assert_fill_eq(&fills[1], 5, 3, 1, 1, "red");
        assert_fill_eq(&fills[2], 6, 3, 1, 2, "blue");
        assert_fill_eq(&fills[3], 7, 3, 1, 1, "red");
    }

    #[test]
    fn test_get_all_render_fills_table_with_sort() {
        let (mut gc, sheet_id, pos, file_name) = simple_csv_at(pos!(E2));
        gc.set_fill_color(
            &A1Selection::test_a1_sheet_id("E4:I4", sheet_id),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();
        gc.set_fill_color(
            &A1Selection::test_a1_context(&format!("{file_name}[region]"), gc.a1_context()),
            Some("blue".to_string()),
            None,
            false,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table_at(&pos).unwrap();
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
        let data_table = sheet
            .modify_data_table_at(&pos, |dt| {
                dt.sort_column(0, SortDirection::Descending).unwrap();
                Ok(())
            })
            .unwrap()
            .0;
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

        gc.set_fill_color(
            &A1Selection::test_a1_sheet_id("E4:I4", sheet_id),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();
        gc.set_fill_color(
            &A1Selection::test_a1_context(&format!("{file_name}[region]"), gc.a1_context()),
            Some("blue".to_string()),
            None,
            false,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table_at(&pos).unwrap();
        assert_eq!(
            data_table.cell_value_at(0, 2),
            Some(CellValue::Text("Southborough".to_string()))
        );
        let fills = sheet.get_all_render_fills();
        assert_fill_eq(&fills[0], 9, 4, 1, 1, "red");
        assert_fill_eq(&fills[1], 5, 4, 1, 1, "red");
        assert_fill_eq(&fills[2], 6, 4, 1, 10, "blue");
        assert_fill_eq(&fills[3], 7, 4, 2, 1, "red");

        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();
        let mut column_headers = data_table.column_headers.to_owned().unwrap();
        column_headers[0].display = false;
        gc.test_data_table_update_meta(
            pos.as_sheet_pos(sheet_id),
            Some(column_headers),
            None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table_at(&pos).unwrap();
        assert_eq!(
            data_table.cell_value_at(0, 2),
            Some(CellValue::Text("MA".to_string()))
        );
        let fills = sheet.get_all_render_fills();
        assert_fill_eq(&fills[0], 9, 4, 1, 1, "red");
        assert_fill_eq(&fills[1], 5, 4, 1, 10, "blue");
        assert_fill_eq(&fills[2], 6, 4, 2, 1, "red");

        gc.set_fill_color(
            &A1Selection::test_a1_sheet_id("E10:I10", sheet_id),
            Some("green".to_string()),
            None,
            false,
        )
        .unwrap();

        gc.set_fill_color(
            &A1Selection::test_a1_context(&format!("{file_name}[country]"), gc.a1_context()),
            Some("yellow".to_string()),
            None,
            false,
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

        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();
        let mut column_headers = data_table.column_headers.to_owned().unwrap();
        column_headers[0].display = true;
        gc.test_data_table_update_meta(
            pos.as_sheet_pos(sheet_id),
            Some(column_headers),
            None,
            None,
        );

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

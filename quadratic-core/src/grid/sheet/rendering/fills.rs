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
                    .filter_map(|(x0, y0, x1, y1, color)| {
                        if dt.spill_error || dt.has_error() {
                            return None;
                        }
                        let rect = dt.output_rect(*pos, true);
                        let x = rect.min.x + x0 - 1;
                        let y = rect.min.y + y0 - 1 + if dt.show_header { 1 } else { 0 };
                        let x1 = x1.map_or(rect.max.x, |x1| rect.min.x + x1 - 1);
                        let y1 = y1.map_or(rect.max.y, |y1| rect.min.y + y1 - 1);
                        Some(JsRenderFill {
                            x,
                            y,
                            w: (x1 - x + 1) as u32,
                            h: (y1 - y + 1) as u32,
                            color,
                        })
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
#[serial_test::parallel]
mod tests {
    use crate::{a1::A1Selection, controller::GridController, Pos};

    use super::*;

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
        sheet.test_set_code_run_array_2d(
            5,
            2,
            3,
            3,
            vec!["1", "2", "3", "4", "5", "6", "7", "8", "9"],
        );
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
        let sheet = gc.sheet(sheet_id);
        let fills = sheet.get_all_render_fills();
        assert_eq!(fills.len(), 2);
        assert_eq!(
            fills[0],
            JsRenderFill {
                x: 6,
                y: 2,
                w: 1,
                h: 3,
                color: "red".to_string(),
            }
        );
        assert_eq!(
            fills[1],
            JsRenderFill {
                x: 7,
                y: 2,
                w: 1,
                h: 3,
                color: "blue".to_string(),
            }
        );
        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .data_table_mut(Pos { x: 5, y: 2 })
            .unwrap()
            .show_header = true;
        let fills = sheet.get_all_render_fills();
        assert_eq!(fills.len(), 2);
        assert_eq!(
            fills[0],
            JsRenderFill {
                x: 6,
                y: 3,
                w: 1,
                h: 3,
                color: "red".to_string(),
            }
        );
        assert_eq!(
            fills[1],
            JsRenderFill {
                x: 7,
                y: 3,
                w: 1,
                h: 3,
                color: "blue".to_string(),
            }
        );
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
}

//! Prepare borders for rendering.

use crate::grid::sheet::borders::{JsBorderHorizontal, JsBorderVertical};

use super::*;

impl Borders {
    /// Returns horizontal borders for rendering.
    pub(crate) fn horizontal_borders(
        &self,
        table: Option<Rect>,
    ) -> Option<Vec<JsBorderHorizontal>> {
        let mut horizontal_rects = self
            .top
            .into_iter()
            .map(|(x1, y1, x2, y2, border)| {
                if let Some(table) = table {
                    // Move the borders from table coordinates to screen
                    // coordinates, and place bounds on any infinite borders. We
                    // subtract 1 because borders are 1-based, and tables are
                    // 0-based.
                    let delta_x = table.min.x as u64;
                    let delta_y = table.min.y as u64;
                    (
                        x1.saturating_add(delta_x),
                        y1.saturating_add(delta_y + 1),
                        if let Some(x2) = x2 {
                            Some(x2.saturating_add(delta_x))
                        } else {
                            Some(table.max.x as u64)
                        },
                        if let Some(y2) = y2 {
                            Some(y2.saturating_add(delta_y + 1))
                        } else {
                            Some(table.max.y as u64)
                        },
                        border,
                    )
                } else {
                    (x1, y1, x2, y2, border)
                }
            })
            .chain(self.bottom.into_iter().map(|(x1, y1, x2, y2, border)| {
                if let Some(table) = table {
                    // Move the borders from table coordinates to screen
                    // coordinates, and place bounds on any infinite borders. We
                    // subtract 1 because borders are 1-based, and tables are
                    // 0-based.
                    let delta_x = table.min.x as u64;
                    let delta_y = table.min.y as u64;
                    (
                        x1.saturating_add(delta_x),
                        y1.saturating_add(delta_y + 1),
                        if let Some(x2) = x2 {
                            Some(x2.saturating_add(delta_x))
                        } else {
                            Some(table.max.x as u64)
                        },
                        if let Some(y2) = y2 {
                            Some(y2.saturating_add(delta_y + 1))
                        } else {
                            Some(table.max.y as u64)
                        },
                        border,
                    )
                } else {
                    (
                        x1,
                        y1.saturating_add(1),
                        x2,
                        y2.map(|y2| y2.saturating_add(1)),
                        border,
                    )
                }
            }))
            .collect::<Vec<_>>();
        horizontal_rects.sort_unstable_by(|a, b| a.4.timestamp.cmp(&b.4.timestamp));

        let mut horizontal = Contiguous2D::<Option<BorderStyleTimestamp>>::default();
        horizontal_rects
            .iter()
            .for_each(|(x1, y1, x2, y2, border)| {
                horizontal.set_rect(
                    *x1 as i64,
                    *y1 as i64,
                    x2.map(|x2| x2 as i64),
                    y2.map(|y2| y2 as i64),
                    Some(*border),
                );
            });

        let mut horizontal_vec = vec![];
        horizontal.into_iter().for_each(|(x1, y1, x2, y2, border)| {
            if y2.is_some_and(|y2| y2 == y1) {
                horizontal_vec.push(JsBorderHorizontal {
                    color: border.color,
                    line: border.line,
                    x: x1 as i64,
                    y: y1 as i64,
                    width: x2.map(|x2| x2 as i64 - x1 as i64 + 1),
                    unbounded: false,
                });
            } else if let Some(y2) = y2 {
                for y in y1..=y2 {
                    horizontal_vec.push(JsBorderHorizontal {
                        color: border.color,
                        line: border.line,
                        x: x1 as i64,
                        y: y as i64,
                        width: x2.map(|x2| x2 as i64 - x1 as i64 + 1),
                        unbounded: false,
                    });
                }
            } else {
                // handle infinite horizontal
                horizontal_vec.push(JsBorderHorizontal {
                    color: border.color,
                    line: border.line,
                    x: x1 as i64,
                    y: y1 as i64,
                    width: x2.map(|x2| x2 as i64 - x1 as i64 + 1),
                    unbounded: y2.is_none(),
                });
            }
        });
        if horizontal_vec.is_empty() {
            None
        } else {
            Some(horizontal_vec)
        }
    }

    /// Returns vertical borders for rendering.
    pub(crate) fn vertical_borders(&self, table: Option<Rect>) -> Option<Vec<JsBorderVertical>> {
        let mut vertical_rects = self
            .left
            .into_iter()
            .map(|(x1, y1, x2, y2, border)| {
                if let Some(table) = table {
                    // Move the borders from table coordinates to screen
                    // coordinates, and place bounds on any infinite borders. We
                    // subtract 1 because borders are 1-based, and tables are
                    // 0-based.
                    let delta_x = table.min.x as u64;
                    let delta_y = table.min.y as u64;
                    (
                        x1.saturating_add(delta_x),
                        y1.saturating_add(delta_y),
                        if let Some(x2) = x2 {
                            Some(x2.saturating_add(delta_x))
                        } else {
                            Some(table.max.x as u64)
                        },
                        if let Some(y2) = y2 {
                            Some(y2.saturating_add(delta_y))
                        } else {
                            Some(table.max.y as u64)
                        },
                        border,
                    )
                } else {
                    (x1, y1, x2, y2, border)
                }
            })
            .into_iter()
            .chain(self.right.into_iter().map(|(x1, y1, x2, y2, border)| {
                if let Some(table) = table {
                    // Move the borders from table coordinates to screen
                    // coordinates, and place bounds on any infinite borders. We
                    // subtract 1 because borders are 1-based, and tables are
                    // 0-based.
                    let delta_x = table.min.x as u64;
                    let delta_y = table.min.y as u64;
                    (
                        x1.saturating_add(delta_x),
                        y1.saturating_add(delta_y),
                        if let Some(x2) = x2 {
                            Some(x2.saturating_add(delta_x))
                        } else {
                            Some(table.max.x as u64)
                        },
                        if let Some(y2) = y2 {
                            Some(y2.saturating_add(delta_y))
                        } else {
                            Some(table.max.y as u64)
                        },
                        border,
                    )
                } else {
                    (
                        x1.saturating_add(1),
                        y1,
                        x2.map(|x2| x2.saturating_add(1)),
                        y2,
                        border,
                    )
                }
            }))
            .collect::<Vec<_>>();
        vertical_rects.sort_unstable_by(|a, b| a.4.timestamp.cmp(&b.4.timestamp));

        let mut vertical = Contiguous2D::<Option<BorderStyleTimestamp>>::default();
        vertical_rects.iter().for_each(|(x1, y1, x2, y2, border)| {
            vertical.set_rect(
                *x1 as i64,
                *y1 as i64,
                x2.map(|x2| x2 as i64),
                y2.map(|y2| y2 as i64),
                Some(*border),
            );
        });

        let mut vertical_vec = vec![];
        vertical.into_iter().for_each(|(x1, y1, x2, y2, border)| {
            if x2.is_some_and(|x2| x2 == x1) {
                vertical_vec.push(JsBorderVertical {
                    color: border.color,
                    line: border.line,
                    x: x1 as i64,
                    y: y1 as i64,
                    height: y2.map(|y2| y2 as i64 - y1 as i64 + 1),
                    unbounded: false,
                });
            } else if let Some(x2) = x2 {
                for x in x1..=x2 {
                    vertical_vec.push(JsBorderVertical {
                        color: border.color,
                        line: border.line,
                        x: x as i64,
                        y: y1 as i64,
                        height: y2.map(|y2| y2 as i64 - y1 as i64 + 1),
                        unbounded: false,
                    });
                }
            } else {
                // handle infinite vertical
                vertical_vec.push(JsBorderVertical {
                    color: border.color,
                    line: border.line,
                    x: x1 as i64,
                    y: y1 as i64,
                    height: y2.map(|y2| y2 as i64 - y1 as i64 + 1),
                    unbounded: x2.is_none(),
                });
            }
        });
        if vertical_vec.is_empty() {
            None
        } else {
            Some(vertical_vec)
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::{a1::A1Selection, controller::GridController, grid::SheetId, SheetPos};

    use super::*;

    #[test]
    fn test_render_borders_none() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.borders.horizontal_borders(None), None);
        assert_eq!(sheet.borders.vertical_borders(None), None);
    }

    #[test]
    fn test_render_borders_all() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:E5"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet.borders.horizontal_borders(None).unwrap();
        assert_eq!(horizontal.len(), 6);
        let vertical = sheet.borders.vertical_borders(None).unwrap();
        assert_eq!(vertical.len(), 6);
    }

    #[test]
    fn test_render_borders_top() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:E5"),
            BorderSelection::Top,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet.borders.horizontal_borders(None).unwrap();
        assert_eq!(horizontal.len(), 1);
        assert!(sheet.borders.vertical_borders(None).is_none());
    }

    #[test]
    fn test_render_borders_bottom() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:E5"),
            BorderSelection::Bottom,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet.borders.horizontal_borders(None).unwrap();
        assert_eq!(horizontal.len(), 1);
        assert!(sheet.borders.vertical_borders(None).is_none());
    }

    #[test]
    fn test_render_borders_left() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:E5"),
            BorderSelection::Left,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.horizontal_borders(None).is_none());
        let vertical = sheet.borders.vertical_borders(None).unwrap();
        assert_eq!(vertical.len(), 1);
    }

    #[test]
    fn test_render_borders_right() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:E5"),
            BorderSelection::Right,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.horizontal_borders(None).is_none());
        let vertical = sheet.borders.vertical_borders(None).unwrap();
        assert_eq!(vertical.len(), 1);
    }

    #[test]
    fn test_render_borders_outer() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:E5"),
            BorderSelection::Outer,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet.borders.horizontal_borders(None).unwrap();
        assert_eq!(horizontal.len(), 2);
        let vertical = sheet.borders.vertical_borders(None).unwrap();
        assert_eq!(vertical.len(), 2);
    }

    #[test]
    fn test_render_borders_inner() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:E5"),
            BorderSelection::Inner,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet.borders.horizontal_borders(None).unwrap();
        assert_eq!(horizontal.len(), 4);
        let vertical = sheet.borders.vertical_borders(None).unwrap();
        assert_eq!(vertical.len(), 4);
    }

    #[test]
    fn test_render_borders_horizontal() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:E5"),
            BorderSelection::Horizontal,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet.borders.horizontal_borders(None).unwrap();
        assert_eq!(horizontal.len(), 4);
        assert!(sheet.borders.vertical_borders(None).is_none());
    }

    #[test]
    fn test_render_borders_vertical() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders(
            A1Selection::test_a1("A1:E5"),
            BorderSelection::Vertical,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.horizontal_borders(None).is_none());
        let vertical = sheet.borders.vertical_borders(None).unwrap();
        assert_eq!(vertical.len(), 4);
    }

    #[test]
    fn test_render_borders_infinite_all() {
        let mut gc = GridController::test();
        gc.set_borders(
            A1Selection::test_a1("a3:b4"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(SheetId::TEST);
        let horizontal = sheet.borders.horizontal_borders(None).unwrap();
        assert_eq!(horizontal.len(), 3);
        assert!(!horizontal[0].unbounded);

        let vertical = sheet.borders.vertical_borders(None).unwrap();
        assert_eq!(vertical.len(), 3);
        assert!(!vertical[0].unbounded);

        let mut gc = GridController::test();
        gc.set_borders(
            A1Selection::test_a1("*"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(SheetId::TEST);
        let horizontal = sheet.borders.horizontal_borders(None).unwrap();
        assert_eq!(horizontal.len(), 1);
        assert!(horizontal[0].unbounded);
        let vertical = sheet.borders.vertical_borders(None).unwrap();
        assert_eq!(vertical.len(), 1);
        assert!(vertical[0].unbounded);
    }

    #[test]
    fn test_render_border_column() {
        let mut gc = GridController::test();
        gc.set_borders(
            A1Selection::test_a1("C"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(SheetId::TEST);
        assert_eq!(sheet.borders.horizontal_borders(None).unwrap().len(), 1);
        assert_eq!(sheet.borders.vertical_borders(None).unwrap().len(), 2);
    }

    #[test]
    fn test_render_borders_gap_in_all() {
        let mut gc = GridController::test();
        gc.set_borders(
            A1Selection::test_a1("*"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        gc.clear_format_borders(&A1Selection::test_a1("b5:c6"), None);

        let sheet = gc.sheet(SheetId::TEST);

        assert_eq!(sheet.borders.get_side(BorderSide::Top, pos![b5]), None);
        assert_eq!(sheet.borders.get_side(BorderSide::Bottom, pos![b5]), None);
        assert_eq!(sheet.borders.get_side(BorderSide::Left, pos![b5]), None);
        assert_eq!(sheet.borders.get_side(BorderSide::Right, pos![b5]), None);

        let horizontal = sheet.borders.horizontal_borders(None).unwrap();
        assert_eq!(horizontal.len(), 8);
    }

    #[test]
    fn test_render_borders_table() {
        todo!();
        // let mut gc = GridController::test();
        // let sheet_id = gc.sheet_ids()[0];
        // let sheet = gc.sheet_mut(sheet_id);
        // sheet.test_set_code_run_array_2d(1, 1, 2, 2, vec!["1", "2", "3", "4"]);

        // gc.set_borders(
        //     A1Selection::test_a1("Table1"),
        //     BorderSelection::All,
        //     Some(BorderStyle::default()),
        //     None,
        // );
        // let context = gc.grid().a1_context();
        // let table_ref = context
        //     .table_from_pos(SheetPos {
        //         x: 1,
        //         y: 1,
        //         sheet_id,
        //     })
        //     .unwrap();
        // let sheet = gc.sheet(sheet_id);
        // let table = sheet.data_tables.get(&Pos { x: 1, y: 1 }).unwrap();
        // let horizontal = table
        //     .borders
        //     .horizontal_borders(Some(table_ref.bounds))
        //     .unwrap();
        // assert_eq!(
        //     horizontal[0],
        //     JsBorderHorizontal {
        //         color: Default::default(),
        //         line: Default::default(),
        //         x: 1,
        //         y: 1,
        //         width: Some(2),
        //         unbounded: false,
        //     }
        // );
        // // let vertical = sheet.borders.vertical_borders(None).unwrap();
        // // assert_eq!(vertical.len(), 4);
    }
}

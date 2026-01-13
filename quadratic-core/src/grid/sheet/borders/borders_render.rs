//! Prepare borders for rendering.

use crate::{
    a1::UNBOUNDED,
    grid::{
        DataTable,
        sheet::{
            borders::{JsBorderHorizontal, JsBorderVertical},
            merge_cells::MergeCells,
        },
    },
};

use super::*;

impl Borders {
    /// Returns horizontal borders for rendering.
    pub(crate) fn horizontal_borders(
        &self,
        table: Option<(Pos, &DataTable)>,
        merge_cells: Option<&MergeCells>,
    ) -> Option<Vec<JsBorderHorizontal>> {
        let table = match table {
            Some((pos, table)) => {
                let mut table_rect = table.output_rect(pos, true);
                // use table data bounds for borders, exclude table name and column headers
                table_rect.min.y += table.y_adjustment(true);
                Some((table, table_rect))
            }
            None => None,
        };

        let mut horizontal_rects = self
            .top
            .into_iter()
            .flat_map(|(x1, y1, x2, y2, border)| {
                if let Some((_table, table_rect)) = table {
                    let adjust_x = |x: u64| x.saturating_add_signed(table_rect.min.x - 1);
                    let adjust_y = |y: u64| y.saturating_add_signed(table_rect.min.y - 1);

                    vec![(
                        adjust_x(x1),
                        adjust_y(y1),
                        if let Some(x2) = x2 {
                            Some(adjust_x(x2))
                        } else {
                            Some(table_rect.max.x as u64)
                        },
                        if let Some(y2) = y2 {
                            Some(adjust_y(y2))
                        } else {
                            Some(table_rect.max.y as u64)
                        },
                        border,
                    )]
                } else {
                    self.adjust_for_merge_cells(
                        BorderSide::Top,
                        x1,
                        y1,
                        x2,
                        y2,
                        border,
                        merge_cells,
                    )
                }
            })
            .chain(
                self.bottom
                    .into_iter()
                    .flat_map(|(x1, y1, x2, y2, border)| {
                        if let Some((_, table_rect)) = table {
                            let adjust_x = |x: u64| x.saturating_add_signed(table_rect.min.x - 1);
                            let adjust_y = |y: u64| y.saturating_add_signed(table_rect.min.y - 1);

                            // we use UNBOUNDED as a special value to indicate the last
                            // row of the table
                            if y1 == UNBOUNDED as u64 && y2 == Some(UNBOUNDED as u64) {
                                vec![(
                                    adjust_x(x1),
                                    table_rect.max.y as u64 + 1,
                                    if let Some(x2) = x2 {
                                        Some(adjust_x(x2))
                                    } else {
                                        Some(table_rect.max.x as u64)
                                    },
                                    Some(table_rect.max.y as u64 + 1),
                                    border,
                                )]
                            } else {
                                vec![(
                                    adjust_x(x1),
                                    adjust_y(y1) + 1,
                                    if let Some(x2) = x2 {
                                        Some(adjust_x(x2))
                                    } else {
                                        Some(table_rect.max.x as u64)
                                    },
                                    if let Some(y2) = y2 {
                                        Some(adjust_y(y2) + 1)
                                    } else {
                                        Some(table_rect.max.y as u64 + 1)
                                    },
                                    border,
                                )]
                            }
                        } else {
                            self.adjust_for_merge_cells(
                                BorderSide::Bottom,
                                x1,
                                y1.saturating_add_signed(1),
                                x2,
                                y2.map(|y2| y2.saturating_add_signed(1)),
                                border,
                                merge_cells,
                            )
                        }
                    }),
            )
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
    pub(crate) fn vertical_borders(
        &self,
        table: Option<(Pos, &DataTable)>,
        merge_cells: Option<&MergeCells>,
    ) -> Option<Vec<JsBorderVertical>> {
        let table = match table {
            Some((pos, table)) => {
                let mut table_rect = table.output_rect(pos, true);

                // use table data bounds for borders, exclude table name and column headers
                table_rect.min.y += table.y_adjustment(true);

                Some((table, table_rect))
            }
            None => None,
        };

        let mut vertical_rects = self
            .left
            .into_iter()
            .flat_map(|(x1, y1, x2, y2, border)| {
                if let Some((_, table_rect)) = table {
                    let adjust_x = |x: u64| x.saturating_add_signed(table_rect.min.x - 1);
                    let adjust_y = |y: u64| y.saturating_add_signed(table_rect.min.y - 1);

                    vec![(
                        adjust_x(x1),
                        adjust_y(y1),
                        if let Some(x2) = x2 {
                            Some(adjust_x(x2))
                        } else {
                            Some(table_rect.max.x as u64)
                        },
                        if let Some(y2) = y2 {
                            Some(adjust_y(y2))
                        } else {
                            Some(table_rect.max.y as u64)
                        },
                        border,
                    )]
                } else {
                    self.adjust_for_merge_cells(
                        BorderSide::Left,
                        x1,
                        y1,
                        x2,
                        y2,
                        border,
                        merge_cells,
                    )
                }
            })
            .chain(self.right.into_iter().flat_map(|(x1, y1, x2, y2, border)| {
                if let Some((_, table_rect)) = table {
                    let adjust_x = |x: u64| x.saturating_add_signed(table_rect.min.x);
                    let adjust_y = |y: u64| y.saturating_add_signed(table_rect.min.y - 1);

                    // we use UNBOUNDED as a special value to indicate the last
                    // column of the table
                    if x1 == UNBOUNDED as u64 && x2 == Some(UNBOUNDED as u64) {
                        vec![(
                            table_rect.max.x as u64 + 1,
                            adjust_y(y1),
                            Some(table_rect.max.x as u64 + 1),
                            if let Some(y2) = y2 {
                                Some(adjust_y(y2))
                            } else {
                                Some(table_rect.max.y as u64)
                            },
                            border,
                        )]
                    } else {
                        vec![(
                            adjust_x(x1),
                            adjust_y(y1),
                            if let Some(x2) = x2 {
                                Some(adjust_x(x2))
                            } else {
                                Some(table_rect.max.x as u64 + 1)
                            },
                            if let Some(y2) = y2 {
                                Some(adjust_y(y2))
                            } else {
                                Some(table_rect.max.y as u64)
                            },
                            border,
                        )]
                    }
                } else {
                    self.adjust_for_merge_cells(
                        BorderSide::Right,
                        x1.saturating_add(1),
                        y1,
                        x2.map(|x2| x2.saturating_add(1)),
                        y2,
                        border,
                        merge_cells,
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
mod tests {
    use crate::{a1::A1Selection, controller::GridController, grid::SheetId};

    use super::*;

    #[test]
    fn test_render_borders_none() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.borders.horizontal_borders(None, None), None);
        assert_eq!(sheet.borders.vertical_borders(None, None), None);
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
            false,
        );
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet.borders.horizontal_borders(None, None).unwrap();
        assert_eq!(horizontal.len(), 6);
        let vertical = sheet.borders.vertical_borders(None, None).unwrap();
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
            false,
        );
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet.borders.horizontal_borders(None, None).unwrap();
        assert_eq!(horizontal.len(), 1);
        assert!(sheet.borders.vertical_borders(None, None).is_none());
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
            false,
        );
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet.borders.horizontal_borders(None, None).unwrap();
        assert_eq!(horizontal.len(), 1);
        assert!(sheet.borders.vertical_borders(None, None).is_none());
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
            false,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.horizontal_borders(None, None).is_none());
        let vertical = sheet.borders.vertical_borders(None, None).unwrap();
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
            false,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.horizontal_borders(None, None).is_none());
        let vertical = sheet.borders.vertical_borders(None, None).unwrap();
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
            false,
        );
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet.borders.horizontal_borders(None, None).unwrap();
        assert_eq!(horizontal.len(), 2);
        let vertical = sheet.borders.vertical_borders(None, None).unwrap();
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
            false,
        );
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet.borders.horizontal_borders(None, None).unwrap();
        assert_eq!(horizontal.len(), 4);
        let vertical = sheet.borders.vertical_borders(None, None).unwrap();
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
            false,
        );
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet.borders.horizontal_borders(None, None).unwrap();
        assert_eq!(horizontal.len(), 4);
        assert!(sheet.borders.vertical_borders(None, None).is_none());
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
            false,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.horizontal_borders(None, None).is_none());
        let vertical = sheet.borders.vertical_borders(None, None).unwrap();
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
            false,
        );
        let sheet = gc.sheet(SheetId::TEST);
        let horizontal = sheet.borders.horizontal_borders(None, None).unwrap();
        assert_eq!(horizontal.len(), 3);
        assert!(!horizontal[0].unbounded);

        let vertical = sheet.borders.vertical_borders(None, None).unwrap();
        assert_eq!(vertical.len(), 3);
        assert!(!vertical[0].unbounded);

        let mut gc = GridController::test();
        gc.set_borders(
            A1Selection::test_a1("*"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );
        let sheet = gc.sheet(SheetId::TEST);
        let horizontal = sheet.borders.horizontal_borders(None, None).unwrap();
        assert_eq!(horizontal.len(), 1);
        assert!(horizontal[0].unbounded);
        let vertical = sheet.borders.vertical_borders(None, None).unwrap();
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
            false,
        );
        let sheet = gc.sheet(SheetId::TEST);
        assert_eq!(
            sheet.borders.horizontal_borders(None, None).unwrap().len(),
            1
        );
        assert_eq!(sheet.borders.vertical_borders(None, None).unwrap().len(), 2);
    }

    #[test]
    fn test_render_borders_gap_in_all() {
        let mut gc = GridController::test();
        gc.set_borders(
            A1Selection::test_a1("*"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        gc.clear_format_borders(&A1Selection::test_a1("b5:c6"), None, false);

        let sheet = gc.sheet(SheetId::TEST);

        assert_eq!(sheet.borders.get_side(BorderSide::Top, pos![b5]), None);
        assert_eq!(sheet.borders.get_side(BorderSide::Bottom, pos![b5]), None);
        assert_eq!(sheet.borders.get_side(BorderSide::Left, pos![b5]), None);
        assert_eq!(sheet.borders.get_side(BorderSide::Right, pos![b5]), None);

        let horizontal = sheet.borders.horizontal_borders(None, None).unwrap();
        assert_eq!(horizontal.len(), 8);
    }
}

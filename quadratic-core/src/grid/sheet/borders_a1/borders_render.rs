use crate::{
    grid::{sheet::borders_a1::JsBorderHorizontal, SheetId},
    wasm_bindings::js::jsBordersSheet,
    Pos, Rect,
};

use super::*;

impl BordersA1 {
    /// Returns horizontal borders in a rect
    fn horizontal_borders_in_rect(&self, rect: Rect) -> Option<Vec<JsBorderHorizontal>> {
        let mut horizontal = vec![];
        // Generate horizontal borders
        for y in rect.min.y..=rect.max.y {
            let mut x = rect.min.x;
            while x <= rect.max.x {
                let top_border = self.top.get(Pos { x, y });
                let bottom_border = self.bottom.get(Pos { x, y: y - 1 });

                let border = match (top_border, bottom_border) {
                    (Some(top), Some(bottom)) => {
                        if top.timestamp > bottom.timestamp {
                            Some(top)
                        } else {
                            Some(bottom)
                        }
                    }
                    (Some(top), None) => Some(top),
                    (None, Some(bottom)) => Some(bottom),
                    (None, None) => None,
                };

                if let Some(border) = border {
                    let mut width = 1;
                    while x + width <= rect.max.x {
                        let next_top = self.top.get(Pos { x: x + width, y });
                        let next_bottom = self.bottom.get(Pos {
                            x: x + width,
                            y: y - 1,
                        });
                        let next_border = match (next_top, next_bottom) {
                            (Some(top), Some(bottom)) => {
                                if top.timestamp > bottom.timestamp {
                                    Some(top)
                                } else {
                                    Some(bottom)
                                }
                            }
                            (Some(top), None) => Some(top),
                            (None, Some(bottom)) => Some(bottom),
                            (None, None) => None,
                        };
                        if next_border != Some(border) {
                            break;
                        }
                        width += 1;
                    }
                    horizontal.push(JsBorderHorizontal {
                        color: border.color,
                        line: border.line,
                        x,
                        y,
                        width: Some(width),
                    });
                    x += width;
                } else {
                    x += 1;
                }
            }
        }
        if horizontal.is_empty() {
            None
        } else {
            Some(horizontal)
        }
    }

    fn vertical_borders_in_rect(&self, rect: Rect) -> Option<Vec<JsBorderVertical>> {
        let mut vertical = vec![];

        // Generate vertical borders
        for x in rect.min.x..=rect.max.x {
            let mut y = rect.min.y;

            while y <= rect.max.y {
                let left_border = self.left.get(Pos { x, y });
                let right_border = self.right.get(Pos { x: x - 1, y });

                let border = match (left_border, right_border) {
                    (Some(left), Some(right)) => {
                        if left.timestamp > right.timestamp {
                            Some(left)
                        } else {
                            Some(right)
                        }
                    }
                    (Some(left), None) => Some(left),
                    (None, Some(right)) => Some(right),
                    (None, None) => None,
                };

                if let Some(border) = border {
                    let mut height = 1;
                    while y + height <= rect.max.y {
                        let next_left = self.left.get(Pos { x, y: y + height });
                        let next_right = self.right.get(Pos {
                            x: x - 1,
                            y: y + height,
                        });
                        let next_border = match (next_left, next_right) {
                            (Some(left), Some(right)) => {
                                if left.timestamp > right.timestamp {
                                    Some(left)
                                } else {
                                    Some(right)
                                }
                            }
                            (Some(left), None) => Some(left),
                            (None, Some(right)) => Some(right),
                            (None, None) => None,
                        };
                        if next_border != Some(border) {
                            break;
                        }
                        height += 1;
                    }
                    vertical.push(JsBorderVertical {
                        color: border.color,
                        line: border.line,
                        x,
                        y,
                        height: Some(height),
                    });
                    y += height;
                } else {
                    y += 1;
                }
            }
        }
        if vertical.is_empty() {
            None
        } else {
            Some(vertical)
        }
    }

    fn infinite_horizontal_borders(&self, bounds: Option<Rect>) -> Option<Vec<JsBorderHorizontal>> {
        let horizontal = self
            .top
            .to_rects()
            .filter_map(|(x1, y1, x2, y2, border)| {
                if x2.is_some() && y2.is_some() {
                    None
                } else {
                    // move the lines to the outside of the bounds (if any)
                    let x1 = bounds.map_or(x1, |bounds| x1.max(bounds.max.x));
                    Some(JsBorderHorizontal {
                        color: border.color,
                        line: border.line,
                        x: x1,
                        y: y1,
                        width: None,
                    })
                }
            })
            .collect::<Vec<_>>();

        if horizontal.is_empty() {
            None
        } else {
            Some(horizontal)
        }
    }

    fn infinite_vertical_borders(&self, bounds: Option<Rect>) -> Option<Vec<JsBorderVertical>> {
        None
    }

    /// Gets packaged borders to send to the client.
    pub(crate) fn borders_in_sheet(&self) -> Option<JsBordersSheet> {
        let bounds = self.finite_bounds();

        let horizontal = bounds
            .map(|bounds| self.horizontal_borders_in_rect(bounds))
            .flatten();
        let vertical = bounds
            .map(|bounds| self.vertical_borders_in_rect(bounds))
            .flatten();

        let horizontal_infinite = self.infinite_horizontal_borders(bounds);
        let vertical_infinite = self.infinite_vertical_borders(bounds);

        if horizontal.is_none() && vertical.is_none() {
            None
        } else {
            Some(JsBordersSheet {
                horizontal,
                vertical,
                horizontal_infinite,
                vertical_infinite,
            })
        }
    }

    /// Sends the borders for the sheet to the client.
    pub fn send_sheet_borders(&self, sheet_id: SheetId) {
        match self.borders_in_sheet() {
            Some(b) => {
                if let Ok(borders) = serde_json::to_string(&b) {
                    jsBordersSheet(sheet_id.to_string(), borders);
                } else {
                    dbgjs!("Unable to serialize borders in send_sheet_borders");
                }
            }
            None => jsBordersSheet(sheet_id.to_string(), String::new()),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use serial_test::parallel;

    use crate::{
        color::Rgba,
        controller::GridController,
        grid::sheet::borders::{BorderSelection, BorderStyle, BorderStyleCell, CellBorderLine},
        selection::OldSelection,
        SheetRect,
    };

    use super::*;

    #[test]
    #[parallel]
    fn horizontal_borders_in_rect() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet
            .borders
            .horizontal_borders_in_rect(Rect::new(0, 0, 10, 10));
        assert_eq!(horizontal, None);

        gc.set_borders_selection(
            OldSelection::sheet_rect(SheetRect::new(0, 0, 5, 5, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet
            .borders
            .horizontal_borders_in_rect(Rect::new(0, 0, 10, 10))
            .unwrap();
        assert_eq!(horizontal.len(), 7);
    }

    #[test]
    #[parallel]
    fn vertical_borders_in_rect() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet(sheet_id);
        let vertical = sheet
            .borders
            .vertical_borders_in_rect(Rect::new(0, 0, 10, 10));
        assert_eq!(vertical, None);

        gc.set_borders_selection(
            OldSelection::sheet_rect(SheetRect::new(0, 0, 5, 5, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        let vertical = sheet
            .borders
            .vertical_borders_in_rect(Rect::new(0, 0, 10, 10))
            .unwrap();
        assert_eq!(vertical.len(), 7);
    }

    #[test]
    #[parallel]
    fn horizontal_vertical() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let color = Rgba::new(255, 0, 0, 255);
        let line = CellBorderLine::Line2;
        gc.set_borders_selection(
            OldSelection::sheet_rect(SheetRect::new(0, 0, 5, 5, sheet_id)),
            BorderSelection::Outer,
            Some(BorderStyle { color, line }),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let borders = sheet.borders.borders_in_sheet().unwrap();

        let expected = JsBordersSheet {
            all: None,
            columns: None,
            rows: None,

            horizontal: Some(vec![
                JsBorderHorizontal {
                    x: 0,
                    y: 0,
                    width: 6,
                    color,
                    line,
                },
                JsBorderHorizontal {
                    x: 0,
                    y: 6,
                    width: 6,
                    color,
                    line,
                },
            ]),
            vertical: Some(vec![
                JsBorderVertical {
                    x: 0,
                    y: 0,
                    height: 6,
                    color,
                    line,
                },
                JsBorderVertical {
                    x: 6,
                    y: 0,
                    height: 6,
                    color,
                    line,
                },
            ]),
        };
        assert_eq!(borders, expected);
    }

    #[test]
    #[parallel]
    fn all_single() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            OldSelection::sheet_rect(SheetRect::single_pos((2, 2).into(), sheet_id)),
            BorderSelection::Top,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let borders = sheet.borders.borders_in_sheet().unwrap();
        let expected = JsBordersSheet {
            all: None,
            columns: None,
            rows: None,

            horizontal: Some(vec![JsBorderHorizontal {
                x: 2,
                y: 2,
                width: 1,
                color: Rgba::default(),
                line: CellBorderLine::default(),
            }]),
            vertical: None,
        };
        assert_eq!(borders, expected);
    }

    #[test]
    #[parallel]
    fn top() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            OldSelection::all(sheet_id),
            BorderSelection::Top,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let borders = sheet.borders.borders_in_sheet().unwrap();
        assert!(borders.all.unwrap().top.is_some());
        assert!(borders.all.unwrap().bottom.is_none());
        assert!(borders.all.unwrap().left.is_none());
        assert!(borders.all.unwrap().right.is_none());
        assert_eq!(borders.horizontal, None);
        assert_eq!(borders.vertical, None);
        assert_eq!(borders.columns, None);
        assert_eq!(borders.rows, None);
    }

    #[test]
    #[parallel]
    fn columns() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            OldSelection::columns(&[1, 2, 3], sheet_id),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let borders = sheet.borders.borders_in_sheet().unwrap();
        let columns = HashMap::from([
            (1i64.to_string(), BorderStyleCell::all()),
            (2i64.to_string(), BorderStyleCell::all()),
            (3i64.to_string(), BorderStyleCell::all()),
        ]);
        let expected = JsBordersSheet {
            all: None,
            columns: Some(columns),
            rows: None,

            horizontal: None,
            vertical: None,
        };
        assert_eq!(borders, expected);
    }

    #[test]
    #[parallel]
    fn rows() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            OldSelection::rows(&[1, 2, 3], sheet_id),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let borders = sheet.borders.borders_in_sheet().unwrap();
        let rows = HashMap::from([
            (1i64.to_string(), BorderStyleCell::all()),
            (2i64.to_string(), BorderStyleCell::all()),
            (3i64.to_string(), BorderStyleCell::all()),
        ]);
        let expected = JsBordersSheet {
            all: None,
            columns: None,
            rows: Some(rows),

            horizontal: None,

            vertical: None,
        };
        assert_eq!(borders, expected);
    }

    #[test]
    #[parallel]
    fn right() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            OldSelection::sheet_rect(SheetRect::new(0, 0, 5, 5, sheet_id)),
            BorderSelection::Right,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let borders = sheet.borders.borders_in_sheet().unwrap();
        let expected = JsBordersSheet {
            all: None,
            columns: None,
            rows: None,

            horizontal: None,
            vertical: Some(vec![JsBorderVertical {
                x: 6,
                y: 0,
                height: 6,
                color: Rgba::default(),
                line: CellBorderLine::default(),
            }]),
        };
        assert_eq!(borders, expected);
    }
}

//     /// Gets all borders to send to the client.
//     pub(crate) fn borders_in_sheet(&self) -> Option<Vec<JsBorder>> {
//         if self.is_default() {
//             return None;
//         }

//         let borders = self
//             .top
//             .to_rects()
//             .map(|(x1, y1, x2, y2, border)| JsBorder {
//                 x: x1,
//                 y: y1,
//                 w: x2.map(|x2| x2 - x1 + 1),
//                 h: y2.map(|y2| y2 - y1 + 1),
//                 color: border.color,
//                 line: border.line,
//                 side: BorderSide::Top,
//                 // cast to i64 so we don't lose precision on the u32
//                 time_stamp: border.timestamp.value() as i64,
//             })
//             .chain(
//                 self.bottom
//                     .to_rects()
//                     .map(|(x1, y1, x2, y2, border)| JsBorder {
//                         x: x1,

//                         // bottom of the current one is rendered in the same
//                         // place as the top of the previous one
//                         y: y1,
//                         w: x2.map(|x2| x2 - x1 + 1),
//                         h: y2.map(|y2| y2 - y1 + 1),
//                         color: border.color,
//                         line: border.line,
//                         side: BorderSide::Bottom,

//                         // cast to i64 so we don't lose precision on the u32
//                         time_stamp: border.timestamp.value() as i64,
//                     }),
//             )
//             .chain(
//                 self.left
//                     .to_rects()
//                     .map(|(x1, y1, x2, y2, border)| JsBorder {
//                         x: x1,
//                         y: y1,
//                         w: x2.map(|x2| x2 - x1 + 1),
//                         h: y2.map(|y2| y2 - y1 + 1),
//                         color: border.color,
//                         line: border.line,
//                         side: BorderSide::Left,

//                         // cast to i64 so we don't lose precision on the u32
//                         time_stamp: border.timestamp.value() as i64,
//                     }),
//             )
//             .chain(
//                 self.right
//                     .to_rects()
//                     .map(|(x1, y1, x2, y2, border)| JsBorder {
//                         // right of the current one is rendered in the same
//                         // place as the left of the next one
//                         x: x1,
//                         y: y1,
//                         w: x2.map(|x2| x2 - x1 + 1),
//                         h: y2.map(|y2| y2 - y1 + 1),
//                         color: border.color,
//                         line: border.line,
//                         side: BorderSide::Right,

//                         // cast to i64 so we don't lose precision on the u32
//                         time_stamp: border.timestamp.value() as i64,
//                     }),
//             )
//             .sorted_by(|a, b| b.time_stamp.cmp(&a.time_stamp))
//             .collect::<Vec<_>>();

//         (!borders.is_empty()).then_some(borders)
//     }

//     /// Sends the borders for the sheet to the client.
//     pub fn send_sheet_borders(&self, sheet_id: SheetId) {
//         match self.borders_in_sheet() {
//             Some(b) => {
//                 if let Ok(borders) = serde_json::to_string(&b) {
//                     jsBordersSheet(sheet_id.to_string(), borders);
//                 } else {
//                     dbgjs!("Unable to serialize borders in send_sheet_borders");
//                 }
//             }
//             None => jsBordersSheet(sheet_id.to_string(), String::new()),
//         }
//     }
// }

// #[cfg(test)]
// #[serial_test::parallel]
// mod tests {
//     use crate::{color::Rgba, controller::GridController, A1Selection};

//     use super::*;

//     #[test]
//     fn borders_rect_all() {
//         let mut gc = GridController::test();
//         let sheet_id = gc.sheet_ids()[0];
//         let sheet = gc.sheet(sheet_id);

//         let borders = sheet.borders_a1.borders_in_sheet();
//         assert_eq!(borders, None);

//         gc.set_borders(
//             A1Selection::test_a1("A1:C3"),
//             BorderSelection::All,
//             Some(BorderStyle::default()),
//             None,
//         );
//         let sheet = gc.sheet(sheet_id);
//         let borders = sheet.borders_a1.borders_in_sheet().unwrap();
//         assert_eq!(borders.len(), 4);

//         // it's possible that this order will be messed up if the timestamp ends up not being the same
//         // as the order of the borders in the sheet
//         assert!(borders[0].compare_without_timestamp(&JsBorder {
//             x: 1,
//             y: 1,
//             w: Some(3),
//             h: Some(3),
//             color: Rgba::default(),
//             line: CellBorderLine::default(),
//             side: BorderSide::Top,
//             time_stamp: 0,
//         }));
//         assert!(borders[1].compare_without_timestamp(&JsBorder {
//             x: 1,
//             y: 1,
//             w: Some(3),
//             h: Some(3),
//             color: Rgba::default(),
//             line: CellBorderLine::default(),
//             side: BorderSide::Bottom,
//             time_stamp: 0,
//         }));
//         assert!(borders[2].compare_without_timestamp(&JsBorder {
//             x: 1,
//             y: 1,
//             w: Some(3),
//             h: Some(3),
//             color: Rgba::default(),
//             line: CellBorderLine::default(),
//             side: BorderSide::Left,
//             time_stamp: 0,
//         }));
//         assert!(borders[3].compare_without_timestamp(&JsBorder {
//             x: 1,
//             y: 1,
//             w: Some(3),
//             h: Some(3),
//             color: Rgba::default(),
//             line: CellBorderLine::default(),
//             side: BorderSide::Right,
//             time_stamp: 0,
//         }));
//     }

//     #[test]
//     fn borders_rect_outer() {
//         let mut gc = GridController::test();
//         let sheet_id = gc.sheet_ids()[0];

//         gc.set_borders(
//             A1Selection::test_a1("B1:C3"),
//             BorderSelection::Outer,
//             Some(BorderStyle::default()),
//             None,
//         );
//         let sheet = gc.sheet(sheet_id);
//         let borders = sheet.borders_a1.borders_in_sheet().unwrap();
//         assert_eq!(borders.len(), 4);
//         assert!(borders[0].compare_without_timestamp(&JsBorder {
//             x: 2,
//             y: 1,
//             w: Some(2),
//             h: Some(1),
//             color: Rgba::default(),
//             line: CellBorderLine::default(),
//             side: BorderSide::Top,
//             time_stamp: 0,
//         }));
//         assert!(borders[1].compare_without_timestamp(&JsBorder {
//             x: 2,
//             y: 3,
//             w: Some(2),
//             h: Some(1),
//             color: Rgba::default(),
//             line: CellBorderLine::default(),
//             side: BorderSide::Bottom,
//             time_stamp: 0,
//         }));
//         assert!(borders[2].compare_without_timestamp(&JsBorder {
//             x: 2,
//             y: 1,
//             w: Some(1),
//             h: Some(3),
//             color: Rgba::default(),
//             line: CellBorderLine::default(),
//             side: BorderSide::Left,
//             time_stamp: 0,
//         }));
//         assert!(borders[3].compare_without_timestamp(&JsBorder {
//             x: 3,
//             y: 1,
//             w: Some(1),
//             h: Some(3),
//             color: Rgba::default(),
//             line: CellBorderLine::default(),
//             side: BorderSide::Right,
//             time_stamp: 0,
//         }));
//     }
// }

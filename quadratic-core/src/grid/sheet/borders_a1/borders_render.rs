use crate::{grid::SheetId, wasm_bindings::js::jsBordersSheet, Pos, Rect};

use super::*;

impl BordersA1 {
    /// Returns horizontal borders in a rect
    pub(crate) fn horizontal_borders_in_rect(&self, rect: Rect) -> Option<Vec<JsBorderHorizontal>> {
        let mut horizontal = vec![];
        // Generate horizontal borders
        for y in rect.min.y..=rect.max.y {
            let mut x = rect.min.x;
            while x <= rect.max.x {
                let top_border = self.top.get_finite(Pos { x, y });
                let bottom_border = self.bottom.get_finite(Pos { x, y: y - 1 });

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
                        let next_top = self.top.get_finite(Pos { x: x + width, y });
                        let next_bottom = self.bottom.get_finite(Pos {
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
                        width,
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

    pub(crate) fn vertical_borders_in_rect(&self, rect: Rect) -> Option<Vec<JsBorderVertical>> {
        let mut vertical = vec![];

        // Generate vertical borders
        for x in rect.min.x..=rect.max.x {
            let mut y = rect.min.y;

            while y <= rect.max.y {
                let left_border = self.left.get_finite(Pos { x, y });
                let right_border = self.right.get_finite(Pos { x: x - 1, y });

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
                        let next_left = self.left.get_finite(Pos { x, y: y + height });
                        let next_right = self.right.get_finite(Pos {
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
                        height,
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

    /// Gets packaged borders to send to the client.
    pub(crate) fn borders_in_sheet(&self) -> Option<JsBordersSheet> {
        if self.is_default() {
            return None;
        }
        let (_horizontal, _vertical) = if let Some(bounds) = self.finite_bounds() {
            (
                self.horizontal_borders_in_rect(bounds),
                self.vertical_borders_in_rect(bounds),
            )
        } else {
            (None, None)
        };
        None
        // if self.is_default() {
        //     None
        // } else {
        //     Some(JsBordersSheet {
        //         all: if self.all.is_default() {
        //             None
        //         } else {
        //             Some(self.all)
        //         },
        //         columns: if self.columns.is_empty() {
        //             None
        //         } else {
        //             Some(
        //                 self.columns
        //                     .iter()
        //                     .map(|(k, v)| (k.to_string(), *v))
        //                     .collect(),
        //             )
        //         },
        //         rows: if self.rows.is_empty() {
        //             None
        //         } else {
        //             Some(self.rows.iter().map(|(k, v)| (k.to_string(), *v)).collect())
        //         },

        //         horizontal,
        //         vertical,
        //     })
        // }
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

// #[cfg(test)]
// mod tests {
//     use std::collections::HashMap;

//     use serial_test::parallel;

//     use crate::{
//         color::Rgba,
//         controller::GridController,
//         grid::sheet::borders::{BorderSelection, BorderStyle, BorderStyleCell, CellBorderLine},
//         selection::OldSelection,
//         SheetRect,
//     };

//     use super::*;

//     #[test]
//     #[parallel]
//     fn horizontal_borders_in_rect() {
//         let mut gc = GridController::test();
//         let sheet_id = gc.sheet_ids()[0];
//         let sheet = gc.sheet(sheet_id);
//         let horizontal = sheet
//             .borders
//             .horizontal_borders_in_rect(Rect::new(0, 0, 10, 10));
//         assert_eq!(horizontal, None);

//         gc.set_borders_selection(
//             OldSelection::sheet_rect(SheetRect::new(0, 0, 5, 5, sheet_id)),
//             BorderSelection::All,
//             Some(BorderStyle::default()),
//             None,
//         );
//         let sheet = gc.sheet(sheet_id);
//         let horizontal = sheet
//             .borders
//             .horizontal_borders_in_rect(Rect::new(0, 0, 10, 10))
//             .unwrap();
//         assert_eq!(horizontal.len(), 7);
//     }

//     #[test]
//     #[parallel]
//     fn vertical_borders_in_rect() {
//         let mut gc = GridController::test();
//         let sheet_id = gc.sheet_ids()[0];
//         let sheet = gc.sheet(sheet_id);
//         let vertical = sheet
//             .borders
//             .vertical_borders_in_rect(Rect::new(0, 0, 10, 10));
//         assert_eq!(vertical, None);

//         gc.set_borders_selection(
//             OldSelection::sheet_rect(SheetRect::new(0, 0, 5, 5, sheet_id)),
//             BorderSelection::All,
//             Some(BorderStyle::default()),
//             None,
//         );
//         let sheet = gc.sheet(sheet_id);
//         let vertical = sheet
//             .borders
//             .vertical_borders_in_rect(Rect::new(0, 0, 10, 10))
//             .unwrap();
//         assert_eq!(vertical.len(), 7);
//     }

//     #[test]
//     #[parallel]
//     fn horizontal_vertical() {
//         let mut gc = GridController::test();
//         let sheet_id = gc.sheet_ids()[0];

//         let color = Rgba::new(255, 0, 0, 255);
//         let line = CellBorderLine::Line2;
//         gc.set_borders_selection(
//             OldSelection::sheet_rect(SheetRect::new(0, 0, 5, 5, sheet_id)),
//             BorderSelection::Outer,
//             Some(BorderStyle { color, line }),
//             None,
//         );

//         let sheet = gc.sheet(sheet_id);
//         let borders = sheet.borders.borders_in_sheet().unwrap();

//         let expected = JsBordersSheet {
//             all: None,
//             columns: None,
//             rows: None,

//             horizontal: Some(vec![
//                 JsBorderHorizontal {
//                     x: 0,
//                     y: 0,
//                     width: 6,
//                     color,
//                     line,
//                 },
//                 JsBorderHorizontal {
//                     x: 0,
//                     y: 6,
//                     width: 6,
//                     color,
//                     line,
//                 },
//             ]),
//             vertical: Some(vec![
//                 JsBorderVertical {
//                     x: 0,
//                     y: 0,
//                     height: 6,
//                     color,
//                     line,
//                 },
//                 JsBorderVertical {
//                     x: 6,
//                     y: 0,
//                     height: 6,
//                     color,
//                     line,
//                 },
//             ]),
//         };
//         assert_eq!(borders, expected);
//     }

//     #[test]
//     #[parallel]
//     fn all_single() {
//         let mut gc = GridController::test();
//         let sheet_id = gc.sheet_ids()[0];

//         gc.set_borders_selection(
//             OldSelection::sheet_rect(SheetRect::single_pos((2, 2).into(), sheet_id)),
//             BorderSelection::Top,
//             Some(BorderStyle::default()),
//             None,
//         );

//         let sheet = gc.sheet(sheet_id);
//         let borders = sheet.borders.borders_in_sheet().unwrap();
//         let expected = JsBordersSheet {
//             all: None,
//             columns: None,
//             rows: None,

//             horizontal: Some(vec![JsBorderHorizontal {
//                 x: 2,
//                 y: 2,
//                 width: 1,
//                 color: Rgba::default(),
//                 line: CellBorderLine::default(),
//             }]),
//             vertical: None,
//         };
//         assert_eq!(borders, expected);
//     }

//     #[test]
//     #[parallel]
//     fn top() {
//         let mut gc = GridController::test();
//         let sheet_id = gc.sheet_ids()[0];

//         gc.set_borders_selection(
//             OldSelection::all(sheet_id),
//             BorderSelection::Top,
//             Some(BorderStyle::default()),
//             None,
//         );

//         let sheet = gc.sheet(sheet_id);
//         let borders = sheet.borders.borders_in_sheet().unwrap();
//         assert!(borders.all.unwrap().top.is_some());
//         assert!(borders.all.unwrap().bottom.is_none());
//         assert!(borders.all.unwrap().left.is_none());
//         assert!(borders.all.unwrap().right.is_none());
//         assert_eq!(borders.horizontal, None);
//         assert_eq!(borders.vertical, None);
//         assert_eq!(borders.columns, None);
//         assert_eq!(borders.rows, None);
//     }

//     #[test]
//     #[parallel]
//     fn columns() {
//         let mut gc = GridController::test();
//         let sheet_id = gc.sheet_ids()[0];

//         gc.set_borders_selection(
//             OldSelection::columns(&[1, 2, 3], sheet_id),
//             BorderSelection::All,
//             Some(BorderStyle::default()),
//             None,
//         );

//         let sheet = gc.sheet(sheet_id);
//         let borders = sheet.borders.borders_in_sheet().unwrap();
//         let columns = HashMap::from([
//             (1i64.to_string(), BorderStyleCell::all()),
//             (2i64.to_string(), BorderStyleCell::all()),
//             (3i64.to_string(), BorderStyleCell::all()),
//         ]);
//         let expected = JsBordersSheet {
//             all: None,
//             columns: Some(columns),
//             rows: None,

//             horizontal: None,
//             vertical: None,
//         };
//         assert_eq!(borders, expected);
//     }

//     #[test]
//     #[parallel]
//     fn rows() {
//         let mut gc = GridController::test();
//         let sheet_id = gc.sheet_ids()[0];

//         gc.set_borders_selection(
//             OldSelection::rows(&[1, 2, 3], sheet_id),
//             BorderSelection::All,
//             Some(BorderStyle::default()),
//             None,
//         );

//         let sheet = gc.sheet(sheet_id);
//         let borders = sheet.borders.borders_in_sheet().unwrap();
//         let rows = HashMap::from([
//             (1i64.to_string(), BorderStyleCell::all()),
//             (2i64.to_string(), BorderStyleCell::all()),
//             (3i64.to_string(), BorderStyleCell::all()),
//         ]);
//         let expected = JsBordersSheet {
//             all: None,
//             columns: None,
//             rows: Some(rows),

//             horizontal: None,

//             vertical: None,
//         };
//         assert_eq!(borders, expected);
//     }

//     #[test]
//     #[parallel]
//     fn right() {
//         let mut gc = GridController::test();
//         let sheet_id = gc.sheet_ids()[0];

//         gc.set_borders_selection(
//             OldSelection::sheet_rect(SheetRect::new(0, 0, 5, 5, sheet_id)),
//             BorderSelection::Right,
//             Some(BorderStyle::default()),
//             None,
//         );

//         let sheet = gc.sheet(sheet_id);
//         let borders = sheet.borders.borders_in_sheet().unwrap();
//         let expected = JsBordersSheet {
//             all: None,
//             columns: None,
//             rows: None,

//             horizontal: None,
//             vertical: Some(vec![JsBorderVertical {
//                 x: 6,
//                 y: 0,
//                 height: 6,
//                 color: Rgba::default(),
//                 line: CellBorderLine::default(),
//             }]),
//         };
//         assert_eq!(borders, expected);
//     }
// }

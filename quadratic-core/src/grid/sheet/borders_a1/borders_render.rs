use crate::{
    grid::{
        sheet::borders_a1::{JsBorderHorizontal, JsBorderVertical},
        SheetId,
    },
    wasm_bindings::js::jsBordersSheet,
};

use super::*;

impl BordersA1 {
    /// Returns horizontal borders in a rect
    pub(crate) fn horizontal_borders(&self) -> Option<Vec<JsBorderHorizontal>> {
        let mut horizontal_rects = self
            .top
            .into_iter()
            .chain(self.bottom.into_iter().map(|(x1, y1, x2, y2, border)| {
                (
                    x1,
                    y1.saturating_add(1),
                    x2,
                    y2.map(|y2| {
                        if y2 < u64::MAX {
                            y2.saturating_add(1)
                        } else {
                            y2
                        }
                    }),
                    border,
                )
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
                    Some(border.clone()),
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
                });
            } else if let Some(y2) = y2 {
                for y in y1..=y2 {
                    horizontal_vec.push(JsBorderHorizontal {
                        color: border.color,
                        line: border.line,
                        x: x1 as i64,
                        y: y as i64,
                        width: x2.map(|x2| x2 as i64 - x1 as i64 + 1),
                    });
                }
            } else {
                // handle infinite horizontal
                horizontal_vec.push(JsBorderHorizontal {
                    color: border.color,
                    line: border.line,
                    x: x1 as i64,
                    y: y1 as i64,
                    width: None,
                });
            }
        });
        if horizontal_vec.is_empty() {
            None
        } else {
            Some(horizontal_vec)
        }
    }

    pub(crate) fn vertical_borders(&self) -> Option<Vec<JsBorderVertical>> {
        let mut vertical = Contiguous2D::<BorderStyleTimestamp>::default();

        let mut vertical_rects = self
            .left
            .into_iter()
            .chain(self.right.into_iter().map(|(x1, y1, x2, y2, border)| {
                (
                    x1.saturating_add(1),
                    y1,
                    x2.map(|x2| x2.saturating_add(1)),
                    y2,
                    border,
                )
            }))
            .collect::<Vec<_>>();
        vertical_rects.sort_unstable_by(|a, b| a.4.timestamp.cmp(&b.4.timestamp));

        vertical_rects.iter().for_each(|(x1, y1, x2, y2, border)| {
            vertical.set_rect(
                *x1 as i64,
                *y1 as i64,
                x2.map(|x2| x2 as i64),
                y2.map(|y2| y2 as i64),
                border.clone(),
            );
        });

        let mut vertical = vec![];
        vertical_rects
            .into_iter()
            .for_each(|(x1, y1, x2, y2, border)| {
                println!("{} {} {:?} {:?}", x1, y1, x2, y2);

                if x2.is_some_and(|x2| x2 == x1) {
                    vertical.push(JsBorderVertical {
                        color: border.color,
                        line: border.line,
                        x: x1 as i64,
                        y: y1 as i64,
                        height: y2.map(|y2| y2 as i64 - y1 as i64 + 1),
                    });
                } else if let Some(x2) = x2 {
                    for x in x1..=x2 {
                        vertical.push(JsBorderVertical {
                            color: border.color,
                            line: border.line,
                            x: x as i64,
                            y: y1 as i64,
                            height: y2.map(|y2| y2 as i64 - y1 as i64 + 1),
                        });
                    }
                } else {
                    // handle infinite vertical
                    vertical.push(JsBorderVertical {
                        color: border.color,
                        line: border.line,
                        x: x1 as i64,
                        y: y1 as i64,
                        height: None,
                    });
                }
            });
        if vertical.is_empty() {
            None
        } else {
            Some(vertical)
        }
    }

    /// Gets packaged borders to send to the client.
    pub(crate) fn borders_in_sheet(&self) -> Option<JsBordersSheet> {
        let horizontal = self.horizontal_borders();
        let vertical = self.vertical_borders();

        if horizontal.is_none() && vertical.is_none() {
            None
        } else {
            Some(JsBordersSheet {
                horizontal,
                vertical,
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
    use serial_test::parallel;

    use super::*;
    use crate::grid::sheet::borders_a1::BorderStyle;
    use crate::{controller::GridController, A1Selection};

    #[test]
    #[parallel]
    fn horizontal_borders() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.borders_a1.horizontal_borders(), None);
        assert_eq!(sheet.borders_a1.vertical_borders(), None);

        gc.set_borders(
            A1Selection::test_a1("A1:E5"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet.borders_a1.horizontal_borders().unwrap();
        assert_eq!(horizontal.len(), 7);
    }

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

    // //     /// Gets all borders to send to the client.
    // //     pub(crate) fn borders_in_sheet(&self) -> Option<Vec<JsBorder>> {
    // //         if self.is_default() {
    // //             return None;
    // //         }

    // //         let borders = self
    // //             .top
    // //             .to_rects()
    // //             .map(|(x1, y1, x2, y2, border)| JsBorder {
    // //                 x: x1,
    // //                 y: y1,
    // //                 w: x2.map(|x2| x2 - x1 + 1),
    // //                 h: y2.map(|y2| y2 - y1 + 1),
    // //                 color: border.color,
    // //                 line: border.line,
    // //                 side: BorderSide::Top,
    // //                 // cast to i64 so we don't lose precision on the u32
    // //                 time_stamp: border.timestamp.value() as i64,
    // //             })
    // //             .chain(
    // //                 self.bottom
    // //                     .to_rects()
    // //                     .map(|(x1, y1, x2, y2, border)| JsBorder {
    // //                         x: x1,

    // //                         // bottom of the current one is rendered in the same
    // //                         // place as the top of the previous one
    // //                         y: y1,
    // //                         w: x2.map(|x2| x2 - x1 + 1),
    // //                         h: y2.map(|y2| y2 - y1 + 1),
    // //                         color: border.color,
    // //                         line: border.line,
    // //                         side: BorderSide::Bottom,

    // //                         // cast to i64 so we don't lose precision on the u32
    // //                         time_stamp: border.timestamp.value() as i64,
    // //                     }),
    // //             )
    // //             .chain(
    // //                 self.left
    // //                     .to_rects()
    // //                     .map(|(x1, y1, x2, y2, border)| JsBorder {
    // //                         x: x1,
    // //                         y: y1,
    // //                         w: x2.map(|x2| x2 - x1 + 1),
    // //                         h: y2.map(|y2| y2 - y1 + 1),
    // //                         color: border.color,
    // //                         line: border.line,
    // //                         side: BorderSide::Left,

    // //                         // cast to i64 so we don't lose precision on the u32
    // //                         time_stamp: border.timestamp.value() as i64,
    // //                     }),
    // //             )
    // //             .chain(
    // //                 self.right
    // //                     .to_rects()
    // //                     .map(|(x1, y1, x2, y2, border)| JsBorder {
    // //                         // right of the current one is rendered in the same
    // //                         // place as the left of the next one
    // //                         x: x1,
    // //                         y: y1,
    // //                         w: x2.map(|x2| x2 - x1 + 1),
    // //                         h: y2.map(|y2| y2 - y1 + 1),
    // //                         color: border.color,
    // //                         line: border.line,
    // //                         side: BorderSide::Right,

    // //                         // cast to i64 so we don't lose precision on the u32
    // //                         time_stamp: border.timestamp.value() as i64,
    // //                     }),
    // //             )
    // //             .sorted_by(|a, b| b.time_stamp.cmp(&a.time_stamp))
    // //             .collect::<Vec<_>>();

    // //         (!borders.is_empty()).then_some(borders)
    // //     }

    // //     /// Sends the borders for the sheet to the client.
    // //     pub fn send_sheet_borders(&self, sheet_id: SheetId) {
    // //         match self.borders_in_sheet() {
    // //             Some(b) => {
    // //                 if let Ok(borders) = serde_json::to_string(&b) {
    // //                     jsBordersSheet(sheet_id.to_string(), borders);
    // //                 } else {
    // //                     dbgjs!("Unable to serialize borders in send_sheet_borders");
    // //                 }
    // //             }
    // //             None => jsBordersSheet(sheet_id.to_string(), String::new()),
    // //         }
    // //     }
    // // }

    // // #[cfg(test)]
    // // #[serial_test::parallel]
    // // mod tests {
    // //     use crate::{color::Rgba, controller::GridController, A1Selection};

    // //     use super::*;

    // //     #[test]
    // //     fn borders_rect_all() {
    // //         let mut gc = GridController::test();
    // //         let sheet_id = gc.sheet_ids()[0];
    // //         let sheet = gc.sheet(sheet_id);

    // //         let borders = sheet.borders_a1.borders_in_sheet();
    // //         assert_eq!(borders, None);

    // //         gc.set_borders(
    // //             A1Selection::test_a1("A1:C3"),
    // //             BorderSelection::All,
    // //             Some(BorderStyle::default()),
    // //             None,
    // //         );
    // //         let sheet = gc.sheet(sheet_id);
    // //         let borders = sheet.borders_a1.borders_in_sheet().unwrap();
    // //         assert_eq!(borders.len(), 4);

    // //         // it's possible that this order will be messed up if the timestamp ends up not being the same
    // //         // as the order of the borders in the sheet
    // //         assert!(borders[0].compare_without_timestamp(&JsBorder {
    // //             x: 1,
    // //             y: 1,
    // //             w: Some(3),
    // //             h: Some(3),
    // //             color: Rgba::default(),
    // //             line: CellBorderLine::default(),
    // //             side: BorderSide::Top,
    // //             time_stamp: 0,
    // //         }));
    // //         assert!(borders[1].compare_without_timestamp(&JsBorder {
    // //             x: 1,
    // //             y: 1,
    // //             w: Some(3),
    // //             h: Some(3),
    // //             color: Rgba::default(),
    // //             line: CellBorderLine::default(),
    // //             side: BorderSide::Bottom,
    // //             time_stamp: 0,
    // //         }));
    // //         assert!(borders[2].compare_without_timestamp(&JsBorder {
    // //             x: 1,
    // //             y: 1,
    // //             w: Some(3),
    // //             h: Some(3),
    // //             color: Rgba::default(),
    // //             line: CellBorderLine::default(),
    // //             side: BorderSide::Left,
    // //             time_stamp: 0,
    // //         }));
    // //         assert!(borders[3].compare_without_timestamp(&JsBorder {
    // //             x: 1,
    // //             y: 1,
    // //             w: Some(3),
    // //             h: Some(3),
    // //             color: Rgba::default(),
    // //             line: CellBorderLine::default(),
    // //             side: BorderSide::Right,
    // //             time_stamp: 0,
    // //         }));
    // //     }

    // //     #[test]
    // //     fn borders_rect_outer() {
    // //         let mut gc = GridController::test();
    // //         let sheet_id = gc.sheet_ids()[0];

    // //         gc.set_borders(
    // //             A1Selection::test_a1("B1:C3"),
    // //             BorderSelection::Outer,
    // //             Some(BorderStyle::default()),
    // //             None,
    // //         );
    // //         let sheet = gc.sheet(sheet_id);
    // //         let borders = sheet.borders_a1.borders_in_sheet().unwrap();
    // //         assert_eq!(borders.len(), 4);
    // //         assert!(borders[0].compare_without_timestamp(&JsBorder {
    // //             x: 2,
    // //             y: 1,
    // //             w: Some(2),
    // //             h: Some(1),
    // //             color: Rgba::default(),
    // //             line: CellBorderLine::default(),
    // //             side: BorderSide::Top,
    // //             time_stamp: 0,
    // //         }));
    // //         assert!(borders[1].compare_without_timestamp(&JsBorder {
    // //             x: 2,
    // //             y: 3,
    // //             w: Some(2),
    // //             h: Some(1),
    // //             color: Rgba::default(),
    // //             line: CellBorderLine::default(),
    // //             side: BorderSide::Bottom,
    // //             time_stamp: 0,
    // //         }));
    // //         assert!(borders[2].compare_without_timestamp(&JsBorder {
    // //             x: 2,
    // //             y: 1,
    // //             w: Some(1),
    // //             h: Some(3),
    // //             color: Rgba::default(),
    // //             line: CellBorderLine::default(),
    // //             side: BorderSide::Left,
    // //             time_stamp: 0,
    // //         }));
    // //         assert!(borders[3].compare_without_timestamp(&JsBorder {
    // //             x: 3,
    // //             y: 1,
    // //             w: Some(1),
    // //             h: Some(3),
    // //             color: Rgba::default(),
    // //             line: CellBorderLine::default(),
    // //             side: BorderSide::Right,
    // //             time_stamp: 0,
    // //         }));
    // //     }
}

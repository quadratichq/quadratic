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

        let mut vertical = Contiguous2D::<Option<BorderStyleTimestamp>>::default();
        vertical_rects.iter().for_each(|(x1, y1, x2, y2, border)| {
            vertical.set_rect(
                *x1 as i64,
                *y1 as i64,
                x2.map(|x2| x2 as i64),
                y2.map(|y2| y2 as i64),
                Some(border.clone()),
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
                });
            } else if let Some(x2) = x2 {
                for x in x1..=x2 {
                    vertical_vec.push(JsBorderVertical {
                        color: border.color,
                        line: border.line,
                        x: x as i64,
                        y: y1 as i64,
                        height: y2.map(|y2| y2 as i64 - y1 as i64 + 1),
                    });
                }
            } else {
                // handle infinite vertical
                vertical_vec.push(JsBorderVertical {
                    color: border.color,
                    line: border.line,
                    x: x1 as i64,
                    y: y1 as i64,
                    height: None,
                });
            }
        });
        if vertical_vec.is_empty() {
            None
        } else {
            Some(vertical_vec)
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
#[serial_test::parallel]
mod tests {
    use crate::{controller::GridController, A1Selection};

    use super::*;

    #[test]
    fn test_render_borders_none() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.borders_a1.horizontal_borders(), None);
        assert_eq!(sheet.borders_a1.vertical_borders(), None);
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
        let horizontal = sheet.borders_a1.horizontal_borders().unwrap();
        assert_eq!(horizontal.len(), 6);
        let vertical = sheet.borders_a1.vertical_borders().unwrap();
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
        let horizontal = sheet.borders_a1.horizontal_borders().unwrap();
        assert_eq!(horizontal.len(), 1);
        assert!(sheet.borders_a1.vertical_borders().is_none());
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
        let horizontal = sheet.borders_a1.horizontal_borders().unwrap();
        assert_eq!(horizontal.len(), 1);
        assert!(sheet.borders_a1.vertical_borders().is_none());
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
        assert!(sheet.borders_a1.horizontal_borders().is_none());
        let vertical = sheet.borders_a1.vertical_borders().unwrap();
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
        assert!(sheet.borders_a1.horizontal_borders().is_none());
        let vertical = sheet.borders_a1.vertical_borders().unwrap();
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
        let horizontal = sheet.borders_a1.horizontal_borders().unwrap();
        assert_eq!(horizontal.len(), 2);
        let vertical = sheet.borders_a1.vertical_borders().unwrap();
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
        let horizontal = sheet.borders_a1.horizontal_borders().unwrap();
        assert_eq!(horizontal.len(), 4);
        let vertical = sheet.borders_a1.vertical_borders().unwrap();
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
        let horizontal = sheet.borders_a1.horizontal_borders().unwrap();
        assert_eq!(horizontal.len(), 4);
        assert!(sheet.borders_a1.vertical_borders().is_none());
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
        assert!(sheet.borders_a1.horizontal_borders().is_none());
        let vertical = sheet.borders_a1.vertical_borders().unwrap();
        assert_eq!(vertical.len(), 4);
    }
}

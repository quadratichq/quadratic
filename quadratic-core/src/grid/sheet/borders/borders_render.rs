//! Functionality to prepare borders to send to client for rendering. All sheet
//! borders are sent in one call any time they are updated.
//!
//! Rationale: This was a design choice (in lieu of sending them via hashes) to
//! take advantage of long line rendering--ie, it's cheaper to render a very
//! long line than lots of short lines.
//!
//! This means every time the rect borders change, we need to rerender all
//! borders on the sheet. Since this is a one-time cost, (I think) it'll still
//! be performant.

use super::{
    BorderSide, BorderStyleTimestamp, Borders, JsBorderHorizontal, JsBorderVertical, JsBordersSheet,
};
use crate::{grid::SheetId, wasm_bindings::js::jsBordersSheet, Rect};

impl Borders {
    /// Checks whether the sheet border styles will override the cell's border
    /// style. If so, it returns None, otherwise it returns the border style.
    /// This is in lieu of removing all borders from the sheet when overridden
    /// by relevant all, columns, or rows.
    fn does_sheet_override(
        &self,
        x: i64,
        y: i64,
        entry: BorderStyleTimestamp,
        side: BorderSide,
    ) -> Option<BorderStyleTimestamp> {
        match side {
            BorderSide::Top => {
                if self.all.top.is_some_and(|t| t.timestamp > entry.timestamp)
                    || self
                        .all
                        .bottom
                        .is_some_and(|b| b.timestamp > entry.timestamp)
                    || self.columns.get(&x).is_some_and(|c| {
                        c.top.is_some_and(|t| t.timestamp > entry.timestamp)
                            || c.bottom.is_some_and(|b| b.timestamp > entry.timestamp)
                    })
                    || self
                        .rows
                        .get(&y)
                        .is_some_and(|r| r.top.is_some_and(|t| t.timestamp > entry.timestamp))
                    || self
                        .rows
                        .get(&(y - 1))
                        .is_some_and(|r| r.bottom.is_some_and(|b| b.timestamp > entry.timestamp))
                {
                    None
                } else {
                    Some(entry)
                }
            }
            BorderSide::Bottom => {
                if self
                    .all
                    .bottom
                    .is_some_and(|b| b.timestamp > entry.timestamp)
                    || self.all.top.is_some_and(|t| t.timestamp > entry.timestamp)
                    || self.columns.get(&x).is_some_and(|c| {
                        c.bottom.is_some_and(|b| b.timestamp > entry.timestamp)
                            || c.top.is_some_and(|t| t.timestamp > entry.timestamp)
                    })
                    || self
                        .rows
                        .get(&y)
                        .is_some_and(|r| r.bottom.is_some_and(|b| b.timestamp > entry.timestamp))
                    || self
                        .rows
                        .get(&(y + 1))
                        .is_some_and(|r| r.top.is_some_and(|t| t.timestamp > entry.timestamp))
                {
                    None
                } else {
                    Some(entry)
                }
            }
            BorderSide::Left => {
                if self.all.left.is_some_and(|t| t.timestamp > entry.timestamp)
                    || self
                        .all
                        .right
                        .is_some_and(|b| b.timestamp > entry.timestamp)
                    || self.rows.get(&y).is_some_and(|r| {
                        r.left.is_some_and(|t| t.timestamp > entry.timestamp)
                            || r.right.is_some_and(|b| b.timestamp > entry.timestamp)
                    })
                    || self
                        .columns
                        .get(&x)
                        .is_some_and(|c| c.left.is_some_and(|t| t.timestamp > entry.timestamp))
                    || self
                        .columns
                        .get(&(x - 1))
                        .is_some_and(|c| c.right.is_some_and(|b| b.timestamp > entry.timestamp))
                {
                    None
                } else {
                    Some(entry)
                }
            }
            BorderSide::Right => {
                if self
                    .all
                    .right
                    .is_some_and(|t| t.timestamp > entry.timestamp)
                    || self.all.left.is_some_and(|b| b.timestamp > entry.timestamp)
                    || self.rows.get(&y).is_some_and(|r| {
                        r.right.is_some_and(|b| b.timestamp > entry.timestamp)
                            || r.left.is_some_and(|b| b.timestamp > entry.timestamp)
                    })
                    || self
                        .columns
                        .get(&x)
                        .is_some_and(|c| c.right.is_some_and(|b| b.timestamp > entry.timestamp))
                    || self
                        .columns
                        .get(&(x + 1))
                        .is_some_and(|c| c.left.is_some_and(|b| b.timestamp > entry.timestamp))
                {
                    None
                } else {
                    Some(entry)
                }
            }
        }
    }

    /// Returns horizontal borders in a rect
    pub(crate) fn horizontal_borders_in_rect(&self, rect: Rect) -> Option<Vec<JsBorderHorizontal>> {
        let mut horizontal = vec![];
        // Generate horizontal borders
        for y in rect.min.y..=rect.max.y {
            let mut x = rect.min.x;
            while x <= rect.max.x {
                let top_border = self.top.get(&y).and_then(|row| row.get(x));
                let bottom_border = self.bottom.get(&(y - 1)).and_then(|row| row.get(x));

                let border = match (top_border, bottom_border) {
                    (Some(top), Some(bottom)) => {
                        if top.timestamp > bottom.timestamp {
                            self.does_sheet_override(x, y, top, BorderSide::Top)
                        } else {
                            self.does_sheet_override(x, y - 1, bottom, BorderSide::Bottom)
                        }
                    }
                    (Some(top), None) => self.does_sheet_override(x, y, top, BorderSide::Top),
                    (None, Some(bottom)) => {
                        self.does_sheet_override(x, y - 1, bottom, BorderSide::Bottom)
                    }
                    (None, None) => None,
                };

                if let Some(border) = border {
                    let mut width = 1;
                    while x + width < rect.max.x {
                        let next_top = self.top.get(&y).and_then(|row| row.get(x + width));
                        let next_bottom =
                            self.bottom.get(&(y - 1)).and_then(|row| row.get(x + width));
                        let next_border = match (next_top, next_bottom) {
                            (Some(top), Some(bottom)) => {
                                if top.timestamp > bottom.timestamp {
                                    self.does_sheet_override(x + width, y, top, BorderSide::Top)
                                } else {
                                    self.does_sheet_override(
                                        x + width,
                                        y - 1,
                                        bottom,
                                        BorderSide::Bottom,
                                    )
                                }
                            }
                            (Some(top), None) => {
                                self.does_sheet_override(x + width, y, top, BorderSide::Top)
                            }
                            (None, Some(bottom)) => self.does_sheet_override(
                                x + width,
                                y - 1,
                                bottom,
                                BorderSide::Bottom,
                            ),
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
                let left_border = self.left.get(&x).and_then(|row| row.get(y));
                let right_border = self.right.get(&(x - 1)).and_then(|row| row.get(y));

                let border = match (left_border, right_border) {
                    (Some(left), Some(right)) => {
                        if left.timestamp > right.timestamp {
                            self.does_sheet_override(x, y, left, BorderSide::Left)
                        } else {
                            self.does_sheet_override(x - 1, y, right, BorderSide::Right)
                        }
                    }
                    (Some(left), None) => self.does_sheet_override(x, y, left, BorderSide::Left),
                    (None, Some(right)) => {
                        self.does_sheet_override(x - 1, y, right, BorderSide::Right)
                    }
                    (None, None) => None,
                };

                if let Some(border) = border {
                    let mut height = 1;
                    while y + height < rect.max.y {
                        let next_left = self.left.get(&x).and_then(|row| row.get(y + height));
                        let next_right =
                            self.right.get(&(x - 1)).and_then(|row| row.get(y + height));
                        let next_border = match (next_left, next_right) {
                            (Some(left), Some(right)) => {
                                if left.timestamp > right.timestamp {
                                    self.does_sheet_override(x, y + height, left, BorderSide::Left)
                                } else {
                                    self.does_sheet_override(
                                        x - 1,
                                        y + height,
                                        right,
                                        BorderSide::Right,
                                    )
                                }
                            }
                            (Some(left), None) => {
                                self.does_sheet_override(x, y + height, left, BorderSide::Left)
                            }
                            (None, Some(right)) => self.does_sheet_override(
                                x - 1,
                                y + height,
                                right,
                                BorderSide::Right,
                            ),
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
        let (horizontal, vertical) = if let Some(bounds) = self.bounds() {
            (
                self.horizontal_borders_in_rect(bounds),
                self.vertical_borders_in_rect(bounds),
            )
        } else {
            (None, None)
        };
        if self.all.is_empty()
            && self.columns.is_empty()
            && self.rows.is_empty()
            && horizontal.is_none()
            && vertical.is_none()
        {
            None
        } else {
            Some(JsBordersSheet {
                all: if self.all.is_empty() {
                    None
                } else {
                    Some(self.all.clone())
                },
                columns: if self.columns.is_empty() {
                    None
                } else {
                    Some(
                        self.columns
                            .iter()
                            .map(|(k, v)| (k.to_string(), v.clone()))
                            .collect(),
                    )
                },
                rows: if self.rows.is_empty() {
                    None
                } else {
                    Some(
                        self.rows
                            .iter()
                            .map(|(k, v)| (k.to_string(), v.clone()))
                            .collect(),
                    )
                },

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
    use std::collections::HashMap;

    use serial_test::parallel;

    use crate::{
        color::Rgba,
        controller::GridController,
        grid::sheet::borders::{BorderSelection, BorderStyle, BorderStyleCell, CellBorderLine},
        selection::Selection,
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
            Selection::sheet_rect(SheetRect::new(0, 0, 5, 5, sheet_id)),
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
            Selection::sheet_rect(SheetRect::new(0, 0, 5, 5, sheet_id)),
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
            Selection::sheet_rect(SheetRect::new(0, 0, 5, 5, sheet_id)),
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
            Selection::sheet_rect(SheetRect::single_pos((2, 2).into(), sheet_id)),
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
    fn all() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::all(sheet_id),
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

            horizontal: None,
            vertical: None,
        };
        assert_eq!(borders, expected);
    }

    #[test]
    #[parallel]
    fn columns() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::columns(&[1, 2, 3], sheet_id),
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
            Selection::rows(&[1, 2, 3], sheet_id),
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
}

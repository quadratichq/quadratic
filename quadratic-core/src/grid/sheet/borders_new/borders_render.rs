use crate::{
    controller::transaction_summary::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
    grid::SheetId,
    Rect,
};

use super::{
    borders_style::{JsBorderHorizontal, JsBorderVertical, JsBorders, JsBordersSheet},
    Borders,
};

impl Borders {
    pub(crate) fn horizontal_borders_in_rect(&self, rect: Rect) -> Vec<JsBorderHorizontal> {
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
                    while x + width < rect.max.x {
                        let next_top = self.top.get(&y).and_then(|row| row.get(x + width));
                        let next_bottom =
                            self.bottom.get(&(y - 1)).and_then(|row| row.get(x + width));
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
        horizontal
    }

    pub(crate) fn vertical_borders_in_rect(&self, rect: Rect) -> Vec<JsBorderVertical> {
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
                    while y + height < rect.max.y {
                        let next_left = self.left.get(&x).and_then(|row| row.get(y + height));
                        let next_right =
                            self.right.get(&(x - 1)).and_then(|row| row.get(y + height));
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
        vertical
    }

    /// Returns borders for a rect
    pub(crate) fn borders_in_rect(&self, rect: Rect) -> JsBorders {
        JsBorders {
            hash_x: 0,
            hash_y: 0,
            horizontal: self.horizontal_borders_in_rect(rect),
            vertical: self.vertical_borders_in_rect(rect),
        }
    }

    /// Sends the borders within a hash. Note: the result does not contain
    /// borders for the right or bottom of the hash. That is rendered by the
    /// next hash.
    fn borders_in_hash(&self, hash_x: i64, hash_y: i64) -> JsBorders {
        let rect = Rect::new(
            hash_x * CELL_SHEET_WIDTH as i64,
            hash_y * CELL_SHEET_HEIGHT as i64,
            CELL_SHEET_WIDTH as i64,
            CELL_SHEET_HEIGHT as i64,
        );

        self.borders_in_rect(rect)
    }

    /// Sends the borders within a hash to the client.
    pub fn send_borders_in_hash(&self, sheet_id: SheetId, hash_x: i64, hash_y: i64) {
        let borders = self.borders_in_hash(hash_x, hash_y);
        if let Ok(borders_json) = serde_json::to_string(&borders) {
            crate::wasm_bindings::js::jsBordersHash(sheet_id.to_string(), borders_json);
        }
    }

    /// Gets packaged borders to send to the client.
    pub(crate) fn all(&self, skip_hashes: bool) -> Result<String, serde_json::Error> /*JsBordersSheet*/
    {
        let hashes = if skip_hashes {
            None
        } else {
            if let Some(bounds) = self.bounds() {
                let mut hashes = vec![];
                for hash_x in bounds.min.x..=bounds.max.x {
                    for hash_y in bounds.min.y..=bounds.max.y {
                        let borders_hash = self.borders_in_hash(hash_x, hash_y);
                        if !borders_hash.is_empty() {
                            hashes.push(borders_hash);
                        }
                    }
                }
                Some(hashes)
            } else {
                Some(vec![])
            }
        };

        serde_json::to_string(&JsBordersSheet {
            all: self.all.clone(),
            columns: self.columns.clone(),
            rows: self.rows.clone(),
            hashes,
        })
    }

    /// Sends the borders for the sheet to the client.
    pub fn send_sheet_borders(&self, sheet_id: SheetId, skip_hashes: bool) {
        if let Ok(borders_json) = self.all(skip_hashes) {
            crate::wasm_bindings::js::jsBordersSheet(sheet_id.to_string(), borders_json);
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
        grid::sheet::borders_new::borders_style::{
            BorderSelection, BorderStyle, BorderStyleCell, CellBorderLine,
        },
        selection::Selection,
        SheetRect,
    };

    use super::*;

    #[test]
    #[parallel]
    fn horizontal_borders_in_rect() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(0, 0, 5, 5, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        let horizontal = sheet
            .borders_new
            .horizontal_borders_in_rect(Rect::new(0, 0, 10, 10));
        dbg!(&horizontal);
        assert_eq!(horizontal.len(), 7);
    }

    #[test]
    #[parallel]
    fn borders_in_hash() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet(sheet_id);
        let borders = sheet.borders_new.borders_in_hash(0, 0);
        assert!(borders.is_empty());

        let color = Rgba::new(255, 0, 0, 255);
        let line = CellBorderLine::Dotted;

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(0, 0, 5, 5, sheet_id)),
            BorderSelection::Outer,
            Some(BorderStyle { color, line }),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        let borders = sheet.borders_new.borders_in_hash(0, 0);
        assert_eq!(
            borders,
            JsBorders {
                hash_x: 0,
                hash_y: 0,
                horizontal: vec![
                    JsBorderHorizontal {
                        x: 0,
                        y: 0,
                        width: 6,
                        color,
                        line
                    },
                    JsBorderHorizontal {
                        x: 0,
                        y: 6,
                        width: 6,
                        color,
                        line
                    }
                ],
                vertical: vec![
                    JsBorderVertical {
                        x: 0,
                        y: 0,
                        height: 6,
                        color,
                        line
                    },
                    JsBorderVertical {
                        x: 6,
                        y: 0,
                        height: 6,
                        color,
                        line
                    }
                ],
            }
        );
    }

    #[test]
    #[parallel]
    fn all_empty() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet(sheet_id);

        // skip_hashes == true: hashes == null
        let borders = sheet.borders_new.all(true).unwrap();
        let results = serde_json::to_string(&JsBordersSheet::default()).unwrap();
        assert_eq!(borders, results);

        // skip_hashes == false: hashes == []
        let borders_json = sheet.borders_new.all(false).unwrap();
        let borders: JsBordersSheet = serde_json::from_str(&borders_json).unwrap();
        assert_eq!(borders.hashes, Some(vec![]));
    }

    #[test]
    #[parallel]
    fn all() {
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
        let borders = sheet.borders_new.all(false).unwrap();
        let expected = JsBordersSheet {
            all: BorderStyleCell::default(),
            columns: HashMap::new(),
            rows: HashMap::new(),
            hashes: Some(vec![JsBorders {
                hash_x: 0,
                hash_y: 0,
                horizontal: vec![
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
                ],
                vertical: vec![
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
                ],
            }]),
        };
        assert_eq!(borders, serde_json::to_string(&expected).unwrap());
    }
}

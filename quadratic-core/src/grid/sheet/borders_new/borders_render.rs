use crate::{
    controller::transaction_summary::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
    Rect,
};

use super::{
    borders_style::{JsBorderHorizontal, JsBorderVertical, JsBorders, JsBordersSheet},
    Borders,
};

impl Borders {
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

        let mut borders = JsBorders {
            hash_x,
            hash_y,
            horizontal: vec![],
            vertical: vec![],
        };

        // Generate horizontal borders
        for y in rect.min.y..rect.max.y {
            let mut x = rect.min.x;
            while x < rect.max.x {
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
                    borders.horizontal.push(JsBorderHorizontal {
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

        // Generate vertical borders
        for x in rect.min.x..rect.max.x {
            let mut y = rect.min.y;
            while y < rect.max.y {
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
                    borders.vertical.push(JsBorderVertical {
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
        borders
    }

    /// Sends the borders within a hash to the client.
    pub fn send_borders_in_hash(&self, hash_x: i64, hash_y: i64) {
        let borders = self.borders_in_hash(hash_x, hash_y);
        if let Ok(borders_json) = serde_json::to_string(&borders) {
            crate::wasm_bindings::js::jsBordersHash(borders_json);
        }
    }

    /// Returns the bounds of the borders.
    pub(crate) fn bounds(&self) -> Option<Rect> {
        let y_start_top = self.top.keys().min();
        let y_start_bottom = self.bottom.keys().min();
        let y_start = y_start_top
            .iter()
            .chain(y_start_bottom.iter())
            .min()
            .copied();
        let y_end_top = self.top.keys().max();
        let y_end_bottom = self.bottom.keys().max();
        let y_end = y_end_top.iter().chain(y_end_bottom.iter()).max().copied();

        let x_start_left = self.left.keys().min();
        let x_start_right = self.right.keys().min();
        let x_start = x_start_left
            .iter()
            .chain(x_start_right.iter())
            .min()
            .copied();
        let x_end_left = self.left.keys().max();
        let x_end_right = self.right.keys().max();
        let x_end = x_end_left.iter().chain(x_end_right.iter()).max().copied();

        let (Some(x_start), Some(y_start), Some(x_end), Some(y_end)) =
            (x_start, y_start, x_end, y_end)
        else {
            return None;
        };

        Some(Rect::new(
            *x_start,
            *y_start,
            *x_end - *x_start,
            *y_end - *y_start,
        ))
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
    pub fn send_sheet_borders(&self, skip_hashes: bool) {
        if let Ok(borders_json) = self.all(skip_hashes) {
            crate::wasm_bindings::js::jsBordersSheet(borders_json);
        }
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use crate::{
        color::Rgba,
        controller::GridController,
        grid::sheet::borders_new::borders_style::{BorderSelection, BorderStyle, CellBorderLine},
        selection::Selection,
        SheetRect,
    };

    use super::*;

    #[test]
    #[parallel]
    fn bounds() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet(sheet_id);
        let bounds = sheet.borders_new.bounds();
        assert_eq!(bounds, None);

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(0, 0, 10, 10, sheet_id)),
            BorderSelection::Outer,
            Some(BorderStyle {
                color: Rgba::new(255, 0, 0, 255),
                line: CellBorderLine::Dotted,
            }),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        let bounds = sheet.borders_new.bounds();
        assert_eq!(bounds, Some(Rect::new(0, 0, 10, 10)));
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
}

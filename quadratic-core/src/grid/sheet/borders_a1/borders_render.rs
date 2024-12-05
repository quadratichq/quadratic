use crate::{grid::SheetId, wasm_bindings::js::jsBordersSheet};

use itertools::Itertools;

use super::*;

impl BordersA1 {
    /// Gets all borders to send to the client.
    pub(crate) fn borders_in_sheet(&self) -> Option<Vec<JsBorder>> {
        if self.is_default() {
            return None;
        }

        let borders = self
            .top
            .to_rects()
            .map(|(x1, y1, x2, y2, border)| JsBorder {
                x: x1,
                y: y1,
                w: x2.map(|x2| x2 - x1 + 1),
                h: y2.map(|y2| y2 - y1 + 1),
                color: border.color,
                line: border.line,
                side: BorderSide::Top,
                // cast to i64 so we don't lose precision on the u32
                time_stamp: border.timestamp.value() as i64,
            })
            .chain(
                self.bottom
                    .to_rects()
                    .map(|(x1, y1, x2, y2, border)| JsBorder {
                        x: x1,

                        // bottom of the current one is rendered in the same
                        // place as the top of the previous one
                        y: y1,
                        w: x2.map(|x2| x2 - x1 + 1),
                        h: y2.map(|y2| y2 - y1 + 1),
                        color: border.color,
                        line: border.line,
                        side: BorderSide::Bottom,

                        // cast to i64 so we don't lose precision on the u32
                        time_stamp: border.timestamp.value() as i64,
                    }),
            )
            .chain(
                self.left
                    .to_rects()
                    .map(|(x1, y1, x2, y2, border)| JsBorder {
                        x: x1,
                        y: y1,
                        w: x2.map(|x2| x2 - x1 + 1),
                        h: y2.map(|y2| y2 - y1 + 1),
                        color: border.color,
                        line: border.line,
                        side: BorderSide::Left,

                        // cast to i64 so we don't lose precision on the u32
                        time_stamp: border.timestamp.value() as i64,
                    }),
            )
            .chain(
                self.right
                    .to_rects()
                    .map(|(x1, y1, x2, y2, border)| JsBorder {
                        // right of the current one is rendered in the same
                        // place as the left of the next one
                        x: x1,
                        y: y1,
                        w: x2.map(|x2| x2 - x1 + 1),
                        h: y2.map(|y2| y2 - y1 + 1),
                        color: border.color,
                        line: border.line,
                        side: BorderSide::Right,

                        // cast to i64 so we don't lose precision on the u32
                        time_stamp: border.timestamp.value() as i64,
                    }),
            )
            .sorted_by(|a, b| b.time_stamp.cmp(&a.time_stamp))
            .collect::<Vec<_>>();

        (!borders.is_empty()).then_some(borders)
    }

    /// Sends the borders for the sheet to the client.
    pub fn send_sheet_borders(&self, sheet_id: SheetId) {
        match self.borders_in_sheet() {
            Some(b) => {
                dbgjs!(&b);
                if let Ok(borders) = serde_json::to_string(&b) {
                    jsBordersSheet(sheet_id.to_string(), borders);
                } else {
                    dbgjs!("Unable to serialize borders in send_sheet_borders");
                }
            }
            None => {
                dbgjs!("No borders to send");
                jsBordersSheet(sheet_id.to_string(), String::new())
            }
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::{color::Rgba, controller::GridController, A1Selection};

    use super::*;

    #[test]
    fn borders_rect_all() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet(sheet_id);

        let borders = sheet.borders_a1.borders_in_sheet();
        assert_eq!(borders, None);

        gc.set_borders(
            A1Selection::test_a1("A1:C3"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        let borders = sheet.borders_a1.borders_in_sheet().unwrap();
        assert_eq!(borders.len(), 4);

        // it's possible that this order will be messed up if the timestamp ends up not being the same
        // as the order of the borders in the sheet
        assert!(borders[0].compare_without_timestamp(&JsBorder {
            x: 1,
            y: 1,
            w: Some(3),
            h: Some(3),
            color: Rgba::default(),
            line: CellBorderLine::default(),
            side: BorderSide::Top,
            time_stamp: 0,
        }));
        assert!(borders[1].compare_without_timestamp(&JsBorder {
            x: 1,
            y: 1,
            w: Some(3),
            h: Some(3),
            color: Rgba::default(),
            line: CellBorderLine::default(),
            side: BorderSide::Bottom,
            time_stamp: 0,
        }));
        assert!(borders[2].compare_without_timestamp(&JsBorder {
            x: 1,
            y: 1,
            w: Some(3),
            h: Some(3),
            color: Rgba::default(),
            line: CellBorderLine::default(),
            side: BorderSide::Left,
            time_stamp: 0,
        }));
        assert!(borders[3].compare_without_timestamp(&JsBorder {
            x: 1,
            y: 1,
            w: Some(3),
            h: Some(3),
            color: Rgba::default(),
            line: CellBorderLine::default(),
            side: BorderSide::Right,
            time_stamp: 0,
        }));
    }

    #[test]
    fn borders_rect_outer() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("B1:C3"),
            BorderSelection::Outer,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        let borders = sheet.borders_a1.borders_in_sheet().unwrap();
        assert_eq!(borders.len(), 4);
        assert!(borders[0].compare_without_timestamp(&JsBorder {
            x: 2,
            y: 1,
            w: Some(2),
            h: Some(1),
            color: Rgba::default(),
            line: CellBorderLine::default(),
            side: BorderSide::Top,
            time_stamp: 0,
        }));
        assert!(borders[1].compare_without_timestamp(&JsBorder {
            x: 2,
            y: 3,
            w: Some(2),
            h: Some(1),
            color: Rgba::default(),
            line: CellBorderLine::default(),
            side: BorderSide::Bottom,
            time_stamp: 0,
        }));
        assert!(borders[2].compare_without_timestamp(&JsBorder {
            x: 2,
            y: 1,
            w: Some(1),
            h: Some(3),
            color: Rgba::default(),
            line: CellBorderLine::default(),
            side: BorderSide::Left,
            time_stamp: 0,
        }));
        assert!(borders[3].compare_without_timestamp(&JsBorder {
            x: 3,
            y: 1,
            w: Some(1),
            h: Some(3),
            color: Rgba::default(),
            line: CellBorderLine::default(),
            side: BorderSide::Right,
            time_stamp: 0,
        }));
    }
}

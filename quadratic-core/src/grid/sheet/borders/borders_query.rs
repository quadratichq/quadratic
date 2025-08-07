use crate::{Pos, Rect, grid::GridBounds};

use super::*;

impl Borders {
    /// Returns the finite bounds of the borders.
    pub fn finite_bounds(&self) -> Option<Rect> {
        let mut bounds = GridBounds::default();

        self.top.to_rects().for_each(|(x1, y1, x2, y2, _)| {
            if let (Some(x2), Some(y2)) = (x2, y2) {
                bounds.add_rect(Rect::new(x1, y1, x2, y2));
            }
        });
        self.bottom.to_rects().for_each(|(x1, y1, x2, y2, _)| {
            if let (Some(x2), Some(y2)) = (x2, y2) {
                bounds.add_rect(Rect::new(x1, y1, x2, y2));
            }
        });

        self.left.to_rects().for_each(|(x1, y1, x2, y2, _)| {
            if let (Some(x2), Some(y2)) = (x2, y2) {
                bounds.add_rect(Rect::new(x1, y1, x2, y2));
            }
        });
        self.right.to_rects().for_each(|(x1, y1, x2, y2, _)| {
            if let (Some(x2), Some(y2)) = (x2, y2) {
                bounds.add_rect(Rect::new(x1, y1, x2, y2));
            }
        });

        bounds.into()
    }

    /// Returns true if all the borders are empty.
    pub fn is_default(&self) -> bool {
        self.top.is_all_default()
            && self.bottom.is_all_default()
            && self.left.is_all_default()
            && self.right.is_all_default()
    }

    /// Returns true if the border and update are the same.
    fn same_border_and_update(
        border: &Option<BorderStyleTimestamp>,
        update: &ClearOption<BorderStyleTimestamp>,
    ) -> bool {
        match (border, update) {
            (Some(border), ClearOption::Some(update)) => {
                BorderStyleTimestamp::is_equal_ignore_timestamp(Some(*border), Some(*update))
            }
            (None, ClearOption::Some(_)) => false,
            (Some(_), ClearOption::Clear) => false,
            _ => true,
        }
    }

    /// Returns true if the borders update is already applied to the sheet.
    pub fn is_toggle_borders(&self, border_update: &BordersUpdates) -> bool {
        // First check if update borders match current borders
        if let Some(update_left) = border_update.left.as_ref()
            && self.left.zip_any(update_left, |border, update| {
                !Borders::same_border_and_update(border, update)
            }) {
                return false;
            }
        if let Some(update_right) = border_update.right.as_ref()
            && self.right.zip_any(update_right, |border, update| {
                !Borders::same_border_and_update(border, update)
            }) {
                return false;
            }
        if let Some(update_top) = border_update.top.as_ref()
            && self.top.zip_any(update_top, |border, update| {
                !Borders::same_border_and_update(border, update)
            }) {
                return false;
            }
        if let Some(update_bottom) = border_update.bottom.as_ref()
            && self.bottom.zip_any(update_bottom, |border, update| {
                !Borders::same_border_and_update(border, update)
            }) {
                return false;
            }

        true
    }

    /// Returns the border style for the given side and position.
    pub fn get(&self, side: BorderSide, pos: Pos) -> Option<BorderStyle> {
        match side {
            BorderSide::Top => self.top.get(pos).map(|b| b.into()),
            BorderSide::Bottom => self.bottom.get(pos).map(|b| b.into()),
            BorderSide::Left => self.left.get(pos).map(|b| b.into()),
            BorderSide::Right => self.right.get(pos).map(|b| b.into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_finite_bounds() {
        let mut borders = Borders::default();

        // Empty borders should return None
        assert_eq!(borders.finite_bounds(), None);

        // Add some borders and verify bounds
        borders.top.set_rect(
            1,
            1,
            Some(20),
            Some(20),
            Some(BorderStyleTimestamp::default()),
        );
        assert_eq!(borders.finite_bounds().unwrap(), Rect::new(1, 1, 20, 20));
    }

    #[test]
    fn test_is_toggle_borders() {
        let mut borders = Borders::default();

        let mut border_update = BordersUpdates::default();
        border_update.set_style_cell(pos![A1], BorderStyleCell::all());

        assert!(!borders.is_toggle_borders(&border_update));

        borders.set_style_cell(pos![A1], BorderStyleCell::all());
        assert!(borders.is_toggle_borders(&border_update));
    }

    #[test]
    fn test_is_toggle_borders_different_border_selection() {
        let mut borders = Borders::default();
        let mut border_update = BordersUpdates::default();
        border_update.set_style_cell(
            pos![A1],
            BorderStyleCell {
                top: Some(BorderStyleTimestamp::default()),
                bottom: None,
                left: None,
                right: None,
            },
        );
        assert!(!borders.is_toggle_borders(&border_update));

        borders.set_style_cell(pos![A1], BorderStyleCell::all());
        assert!(borders.is_toggle_borders(&border_update));
    }
}

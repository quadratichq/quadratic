use crate::{grid::GridBounds, Pos, Rect};

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

    /// Returns true if the borders update is already applied to the sheet.
    pub fn is_toggle_borders(&self, border_update: &BordersUpdates) -> bool {
        if let Some(update_left) = border_update.left.as_ref() {
            if !self
                .left
                .zip_any(update_left, |border, update| *border == (*update).into())
            {
                return false;
            }
        }
        if let Some(update_right) = border_update.right.as_ref() {
            if !self
                .right
                .zip_any(update_right, |border, update| *border == (*update).into())
            {
                return false;
            }
        }
        if let Some(update_top) = border_update.top.as_ref() {
            if !self
                .top
                .zip_any(update_top, |border, update| *border == (*update).into())
            {
                return false;
            }
        }
        if let Some(update_bottom) = border_update.bottom.as_ref() {
            if !self
                .bottom
                .zip_any(update_bottom, |border, update| *border == (*update).into())
            {
                return false;
            }
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
#[serial_test::parallel]
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
}

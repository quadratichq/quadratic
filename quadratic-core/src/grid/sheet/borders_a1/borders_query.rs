use crate::Rect;

use super::*;

impl BordersA1 {
    pub fn finite_bounds(&self) -> Option<Rect> {
        let top = self.top.finite_bounds();

        // bottom needs to be adjusted by 1 cell down
        let bottom = self
            .bottom
            .finite_bounds()
            .map(|r| Rect::from_numbers(r.min.x, r.min.y + 1, r.width() as i64, r.height() as i64));
        let left = self.left.finite_bounds();

        // right needs to be adjusted by 1 cell right
        let right = self
            .right
            .finite_bounds()
            .map(|r| Rect::from_numbers(r.min.x + 1, r.min.y, r.width() as i64, r.height() as i64));
        let mut bounds = None;
        if let Some(rect) = top {
            bounds = Some(rect);
        }
        if let Some(rect) = bottom {
            bounds = match bounds {
                Some(b) => Some(b.union(&rect)),
                None => Some(rect),
            };
        }
        if let Some(rect) = left {
            bounds = match bounds {
                Some(b) => Some(b.union(&rect)),
                None => Some(rect),
            };
        }
        if let Some(rect) = right {
            bounds = match bounds {
                Some(b) => Some(b.union(&rect)),
                None => Some(rect),
            };
        }
        bounds
    }

    /// Returns true if all the borders are empty.
    pub fn is_default(&self) -> bool {
        self.top.is_all_default()
            && self.bottom.is_all_default()
            && self.left.is_all_default()
            && self.right.is_all_default()
    }

    /// Returns true if the borders update is already applied to the sheet.
    pub fn is_toggle_borders(&self, border_update: &BordersA1Updates) -> bool {
        if let Some(update_left) = border_update.left.as_ref() {
            if !self
                .left
                .zip_any(update_left, |border, update| border == update)
            {
                return false;
            }
        }
        if let Some(update_right) = border_update.right.as_ref() {
            if !self
                .right
                .zip_any(update_right, |border, update| border == update)
            {
                return false;
            }
        }
        if let Some(update_top) = border_update.top.as_ref() {
            if !self
                .top
                .zip_any(update_top, |border, update| border == update)
            {
                return false;
            }
        }
        if let Some(update_bottom) = border_update.bottom.as_ref() {
            if !self
                .bottom
                .zip_any(update_bottom, |border, update| border == update)
            {
                return false;
            }
        }
        true
    }
}

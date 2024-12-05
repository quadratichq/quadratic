use super::*;

impl BordersA1 {
    pub fn apply_updates(&mut self, updates: &BordersA1Updates) -> BordersA1Updates {
        BordersA1Updates {
            left: updates.left.as_ref().map(|value| self.left.set_from(value)),
            right: updates
                .right
                .as_ref()
                .map(|value| self.right.set_from(value)),
            top: updates.top.as_ref().map(|value| self.top.set_from(value)),
            bottom: updates
                .bottom
                .as_ref()
                .map(|value| self.bottom.set_from(value)),
        }
    }
}

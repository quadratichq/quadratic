use super::*;

impl BordersA1 {
    pub fn apply_updates(&mut self, updates: &BordersA1Updates) -> BordersA1Updates {
        BordersA1Updates {
            left: updates.left.clone().map(|value| self.left.set_from(value)),
            right: updates
                .right
                .clone()
                .map(|value| self.right.set_from(value)),
            top: updates.top.clone().map(|value| self.top.set_from(value)),
            bottom: updates
                .bottom
                .clone()
                .map(|value| self.bottom.set_from(value)),
        }
    }
}

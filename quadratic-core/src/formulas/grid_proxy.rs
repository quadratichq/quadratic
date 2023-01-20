use crate::Pos;

pub trait GridProxy {
    fn get(&self, pos: Pos) -> Option<String>;
}

impl GridProxy for crate::Grid {
    fn get(&self, pos: Pos) -> Option<String> {
        match self.get_cell(pos) {
            crate::Cell::Empty => None,
            crate::Cell::Int(i) => Some(i.to_string()),
            crate::Cell::Text(s) => Some(s.clone()),
        }
    }
}

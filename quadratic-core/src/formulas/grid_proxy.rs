use crate::Pos;

pub trait GridProxy {
    fn get(&self, pos: Pos) -> Option<String>;
}

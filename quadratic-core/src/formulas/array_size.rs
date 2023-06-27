use std::fmt;

use super::FormulaErrorMsg;

/// Size of a region or array.
#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct ArraySize {
    /// Width (number of columns)
    pub w: u32,
    /// Height (number of rows)
    pub h: u32,
}
impl fmt::Display for ArraySize {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let ArraySize { w, h } = self;
        write!(f, "{w}x{h}")
    }
}
impl std::ops::Index<Axis> for ArraySize {
    type Output = u32;

    fn index(&self, index: Axis) -> &Self::Output {
        match index {
            Axis::X => &self.w,
            Axis::Y => &self.h,
        }
    }
}
impl std::ops::IndexMut<Axis> for ArraySize {
    fn index_mut(&mut self, index: Axis) -> &mut Self::Output {
        match index {
            Axis::X => &mut self.w,
            Axis::Y => &mut self.h,
        }
    }
}
impl ArraySize {
    pub fn flatten_index(self, x: u32, y: u32) -> Result<usize, FormulaErrorMsg> {
        let x = if self.w > 1 { x } else { 0 };
        let y = if self.h > 1 { y } else { 0 };
        if x < self.w && y < self.h {
            Ok((x + y * self.w) as usize)
        } else {
            Err(FormulaErrorMsg::IndexOutOfBounds)
        }
    }
}

/// Horizontal or vertical axis.
#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub enum Axis {
    /// Horizontal axis / columns
    X = 0,
    /// Vertical axis / rows
    Y = 1,
}
impl Axis {
    pub const ALL: [Axis; 2] = [Axis::X, Axis::Y];

    pub fn other_axis(self) -> Self {
        match self {
            Axis::X => Axis::Y,
            Axis::Y => Axis::X,
        }
    }

    pub fn width_height_str(self) -> &'static str {
        match self {
            Axis::X => "width",
            Axis::Y => "height",
        }
    }
    pub fn rows_cols_str(self, len: u32) -> String {
        format!(
            "{len} {}{}",
            match self {
                Axis::X => "column",
                Axis::Y => "row",
            },
            if len == 1 { "" } else { "s" },
        )
    }
}

use std::{fmt, num::NonZeroU32};

use serde::{Deserialize, Serialize};

use super::RunErrorMsg;

/// Size of a region or array.
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct ArraySize {
    /// Width (number of columns)
    pub w: NonZeroU32,
    /// Height (number of rows)
    pub h: NonZeroU32,
}
impl From<ArraySize> for (i64, i64) {
    fn from(val: ArraySize) -> Self {
        (val.w.get().into(), val.h.get().into())
    }
}
impl fmt::Display for ArraySize {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let ArraySize { w, h } = self;
        write!(f, "{w}x{h}")
    }
}
impl std::ops::Index<Axis> for ArraySize {
    type Output = NonZeroU32;

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
impl TryFrom<(u32, u32)> for ArraySize {
    type Error = RunErrorMsg;

    fn try_from((w, h): (u32, u32)) -> Result<Self, Self::Error> {
        Self::new_or_err(w, h)
    }
}
impl TryFrom<(i64, i64)> for ArraySize {
    type Error = RunErrorMsg;

    fn try_from((w, h): (i64, i64)) -> Result<Self, Self::Error> {
        let w = w.try_into().map_err(|_| RunErrorMsg::ArrayTooBig)?;
        let h = h.try_into().map_err(|_| RunErrorMsg::ArrayTooBig)?;
        Self::new_or_err(w, h)
    }
}

impl ArraySize {
    pub const _1X1: Self = ArraySize {
        w: NonZeroU32::new(1).expect("Unable to create _1X1 ArraySize"),
        h: NonZeroU32::new(1).expect("Unable to create _1X1 ArraySize"),
    };

    /// Constructs a new `ArraySize`, or returns an `None` if the width or
    /// height is zero.
    pub(crate) fn new(w: u32, h: u32) -> Option<Self> {
        Some(ArraySize {
            w: NonZeroU32::new(w)?,
            h: NonZeroU32::new(h)?,
        })
    }
    /// Construct a new `ArraySize`, or returns an error if the width or height
    /// is zero.
    pub(crate) fn new_or_err(w: u32, h: u32) -> Result<Self, RunErrorMsg> {
        Self::new(w, h).ok_or(RunErrorMsg::EmptyArray)
    }
    /// Returns the number of elements in the array.
    #[allow(clippy::len_without_is_empty)]
    pub(crate) fn len(self) -> usize {
        self.w.get() as usize * self.h.get() as usize
    }
    /// Flips the width and height of the array size.
    #[must_use]
    pub(crate) fn transpose(self) -> ArraySize {
        ArraySize {
            w: self.h,
            h: self.w,
        }
    }
    /// Iterates over `(x, y)` array indices in canonical order.
    pub(crate) fn iter(self) -> impl Iterator<Item = (u32, u32)> {
        itertools::iproduct!(0..self.h.get(), 0..self.w.get()).map(|(y, x)| (x, y))
    }
    /// Flattens an index into the array.
    pub(crate) fn flatten_index(self, x: u32, y: u32) -> Result<usize, RunErrorMsg> {
        let w = self.w.get();
        let h = self.h.get();
        let x = if w > 1 { x } else { 0 };
        let y = if h > 1 { y } else { 0 };
        if x < w && y < h {
            Ok((x + y * w) as usize)
        } else {
            Err(RunErrorMsg::IndexOutOfBounds)
        }
    }
}

/// Horizontal or vertical axis.
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub enum Axis {
    /// Horizontal axis / columns
    X = 0,
    /// Vertical axis / rows
    Y = 1,
}
impl Axis {
    pub const ALL: [Axis; 2] = [Axis::X, Axis::Y];

    pub(crate) fn other_axis(self) -> Self {
        match self {
            Axis::X => Axis::Y,
            Axis::Y => Axis::X,
        }
    }

    pub(crate) fn width_height_str(self) -> &'static str {
        match self {
            Axis::X => "width",
            Axis::Y => "height",
        }
    }
    pub(crate) fn rows_cols_str(self, len: u32) -> String {
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
impl From<i8> for Axis {
    fn from(val: i8) -> Self {
        match val {
            0 => Axis::X,
            1 => Axis::Y,
            _ => unreachable!(),
        }
    }
}
impl From<Axis> for i8 {
    fn from(val: Axis) -> Self {
        match val {
            Axis::X => 0,
            Axis::Y => 1,
        }
    }
}

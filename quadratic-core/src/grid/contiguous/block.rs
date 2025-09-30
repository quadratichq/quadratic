use std::fmt;

use serde::{Deserialize, Serialize};

/// Block of contiguous values in a specific range.
///
/// `start` is always a reasonable value, but `end` may be `i64::MAX` to
/// indicate an unbounded range.
#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct Block<T> {
    /// Start of the block.
    pub start: u64,
    /// End of the block, which is `u64::MAX` if unbounded.
    pub end: u64,
    /// Value for every value between `start` (inclusive) and `end` (exclusive).
    pub value: T,
}
impl<T: fmt::Debug> fmt::Debug for Block<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.end {
            u64::MAX => write!(f, "({:?}, {:?})", self.start.., self.value),
            _ => write!(f, "({:?}, {:?})", self.start..self.end, self.value),
        }
    }
}
impl<T> Block<T> {
    /// Return a block that covers the entire space
    pub(crate) fn new_total(value: T) -> Self {
        Self {
            start: 1,
            end: u64::MAX,
            value,
        }
    }
}
impl<T> Block<T> {
    /// Returns the length of the block, or `None` if it is unbounded.
    pub(crate) fn len(&self) -> Option<u64> {
        (self.end < u64::MAX || self.start == self.end)
            .then_some(self.end.saturating_sub(self.start))
    }
    /// Returns whether the block is empty (length 0).
    pub(crate) fn is_empty(&self) -> bool {
        self.len() == Some(0)
    }
    /// Returns the block if it is nonempty, or `None` if it is empty.
    pub(crate) fn if_nonempty(self) -> Option<Self> {
        (!self.is_empty()).then_some(self)
    }

    /// Returns whether the block contains a coordinate.
    pub(crate) fn contains(&self, coordinate: u64) -> bool {
        self.start <= coordinate && (coordinate < self.end || self.end == u64::MAX)
    }
    /// Clamps a coordinate to `self`. Both endpoints are allowed.
    fn clamp(&self, coordinate: u64) -> u64 {
        coordinate.clamp(self.start, self.end)
    }

    /// Returns the lat coordinate in the block (i.e., `end - 1`) if it is a
    /// finite block, or the start of the block if it is infinite.
    pub(crate) fn finite_max(&self) -> u64 {
        if self.end == u64::MAX {
            self.start
        } else {
            self.end.saturating_sub(1)
        }
    }

    /// Applies a function to the value in the block.
    pub(crate) fn map<U>(self, f: impl FnOnce(T) -> U) -> Block<U> {
        Block {
            start: self.start,
            end: self.end,
            value: f(self.value),
        }
    }
    /// Applies a function to the value in the block.
    pub(crate) fn map_ref<'a, U>(&'a self, f: impl FnOnce(&'a T) -> U) -> Block<U> {
        Block {
            start: self.start,
            end: self.end,
            value: f(&self.value),
        }
    }
    /// Converts a `&Block<T>` to a `Block<&T>`.
    pub(crate) fn as_ref(&self) -> Block<&T> {
        self.map_ref(|value| value)
    }
}
impl<T: Clone + PartialEq> Block<T> {
    /// Splits the block at `coordinate`, returning the halves before and after.
    pub(crate) fn split(self, coordinate: u64) -> [Option<Self>; 2] {
        let clamped_coordinate = self.clamp(coordinate);
        [
            Block {
                start: self.start,
                end: clamped_coordinate,
                value: self.value.clone(),
            },
            Block {
                start: clamped_coordinate,
                end: self.end,
                value: self.value,
            },
        ]
        .map(|block| block.if_nonempty())
    }
    /// Splits the block at `start` and `end`, returning in order:
    ///
    /// - the portion of the block before `start` (if any)
    /// - and the portion of the block between `start` and `end` (if any).
    /// - the portion of the block after `end` (if any)
    pub(crate) fn split_twice(self, start: u64, end: u64) -> [Option<Self>; 3] {
        let [before, middle_after] = self.split(start);
        let [middle, after] = match middle_after {
            Some(block) => block.split(end),
            None => [None, None],
        };

        [before, middle, after]
    }

    /// Offsets a block by the given positive delta.
    ///
    /// Returns `None` if the block becomes empty.
    pub(crate) fn add_offset(self, delta: u64) -> Option<Self> {
        Block {
            start: self.start.saturating_add(delta),
            end: self.end.saturating_add(delta),
            value: self.value,
        }
        .if_nonempty()
    }
    /// Offsets a block by the given negative delta. Truncates the block if it
    /// goes below 1.
    ///
    /// Returns `None` if the block becomes empty.
    pub(crate) fn subtract_offset(self, delta: u64) -> Option<Self> {
        Block {
            start: self.start.saturating_sub(delta).max(1),
            end: if self.end == u64::MAX {
                u64::MAX
            } else {
                self.end.saturating_sub(delta).max(1)
            },
            value: self.value,
        }
        .if_nonempty()
    }
}
impl<T> Block<Option<T>> {
    /// Transposes a `Block<Option<T>>` into an `Option<Block<T>>`.
    #[cfg(test)]
    pub(crate) fn into_some(self) -> Option<Block<T>> {
        Some(Block {
            start: self.start,
            end: self.end,
            value: self.value?,
        })
    }
}

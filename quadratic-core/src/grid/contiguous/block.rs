use std::fmt;

use serde::{Deserialize, Serialize};
use smallvec::{smallvec, SmallVec};

/// Block of contiguous values in a specific range.
///
/// `start` is always a reasonable value, but `end` may be `i64::MAX` to
/// indicate an unbounded range.
#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct Block<T> {
    /// Start of the block.
    pub start: i64,
    /// End of the block, which is `i64::MAX` if unbounded.
    pub end: i64,
    /// Value for every value between `start` (inclusive) and `end` (exclusive).
    pub value: T,
}
impl<T: fmt::Debug> fmt::Debug for Block<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.end {
            i64::MAX => write!(f, "({:?}, {:?})", self.start.., self.value),
            _ => write!(f, "({:?}, {:?})", self.start..self.end, self.value),
        }
    }
}
impl<T: Clone + PartialEq> Block<T> {
    /// Returns the length of the block, or `None` if it is unbounded.
    pub fn len(&self) -> Option<i64> {
        (self.end < i64::MAX || self.start == self.end)
            .then_some(self.end.saturating_sub(self.start))
    }
    /// Returns whether the block is empty (length 0).
    pub fn is_empty(&self) -> bool {
        self.len() == Some(0)
    }
    /// Returns the block if it is nonempty, or `None` if it is empty.
    pub fn if_nonempty(self) -> Option<Self> {
        (!self.is_empty()).then_some(self)
    }

    /// Returns whether the block contains the key `coordinate`.
    pub fn contains(&self, coordinate: i64) -> bool {
        self.start <= coordinate && (coordinate < self.end || self.end == i64::MAX)
    }
    /// Clamps a coordinate to `self`. Both endpoints are allowed.
    fn clamp(&self, coordinate: i64) -> i64 {
        coordinate.clamp(self.start, self.end)
    }

    /// Applies a function to the value in the block.
    pub fn map<U>(self, f: impl FnOnce(T) -> U) -> Block<U> {
        Block {
            start: self.start,
            end: self.end,
            value: f(self.value),
        }
    }
    /// Applies a function to the value in the block.
    pub fn map_ref<U>(&self, f: impl FnOnce(&T) -> U) -> Block<U> {
        Block {
            start: self.start,
            end: self.end,
            value: f(&self.value),
        }
    }
    /// Applies a function to the value in the block and creates two new blocks
    /// with the same range.
    pub fn map_split<U, V>(self, f: impl FnOnce(T) -> (U, V)) -> (Block<U>, Block<V>) {
        let (u, v) = f(self.value);
        (
            Block {
                start: self.start,
                end: self.end,
                value: u,
            },
            Block {
                start: self.start,
                end: self.end,
                value: v,
            },
        )
    }

    /// Splits the block at `coordinate`, returning the halves before and after.
    pub fn split(self, coordinate: i64) -> [Option<Self>; 2] {
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
    pub fn split_twice(self, start: i64, end: i64) -> [Option<Self>; 3] {
        let [before, middle_after] = self.split(start);
        let [middle, after] = match middle_after {
            Some(block) => block.split(end),
            None => [None, None],
        };

        [before, middle, after]
    }

    /// Offsets a block by the given positive delta.
    ///
    /// # Panics
    ///
    /// Panics if `self.start + delta` or `self.end + delta` exceeds
    /// [`i64::MAX`].
    pub fn add_offset(self, delta: u64) -> Self {
        Block {
            start: self.start.saturating_add(delta as i64),
            end: self.end.saturating_add(delta as i64),
            value: self.value,
        }
    }
    /// Offsets a block by the given negative delta. Truncates the block if it
    /// goes below 0.
    pub fn subtract_offset(self, delta: u64) -> Self {
        Block {
            start: if self.start == i64::MIN {
                self.start
            } else {
                self.start.saturating_sub(delta as i64)
            },
            end: if self.end == i64::MAX {
                self.end
            } else {
                self.end.saturating_sub(delta as i64)
            },
            value: self.value,
        }
    }

    /// Attempts to merge two blocks, which are assumed to be non-overlapping.
    /// Returns one block if the merge was successful, or two blocks if it was
    /// not.
    ///
    /// Blocks can be merged if they are contiguous and have the same value.
    pub fn try_merge(self, other: Self) -> SmallVec<[Self; 2]> {
        let (start, end) = if self.end == other.start {
            (self.start, other.end)
        } else if other.end == self.start {
            (other.start, self.end)
        } else {
            return smallvec![self, other];
        };

        if self.value == other.value {
            smallvec![Block {
                start,
                end,
                value: self.value
            }]
        } else {
            smallvec![self, other]
        }
    }
}
impl<T: Clone + PartialEq> Block<Option<T>> {
    /// Transposes a `Block<Option<T>>` into an `Option<Block<T>>`.
    pub fn as_some(self) -> Option<Block<T>> {
        Some(Block {
            start: self.start,
            end: self.end,
            value: self.value?,
        })
    }
}

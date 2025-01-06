//! Contiguous 2D serialization
//! Used for formats and borders

use std::fmt::Debug;

use crate::grid::{Block, Contiguous2D};

use super::current;

/// Converts a `T -> U` function to `Option<T> -> Option<U>`
pub(crate) fn opt_fn<T, U>(f: impl Fn(T) -> U) -> impl Fn(Option<T>) -> Option<U> {
    move |x| x.map(&f)
}

pub(crate) fn import_contiguous_2d<C: Clone, F, T: Default + Clone + PartialEq + Debug>(
    blocks: current::Contiguous2DSchema<C>,
    f: F,
) -> Contiguous2D<T>
where
    F: Fn(C) -> T,
{
    let mut ret = Contiguous2D::new();
    for x_block in blocks {
        ret.raw_set_xy_blocks(Block {
            start: x_block.start,
            end: x_block.end,
            value: x_block.value.into_iter().map(|y_block| Block {
                start: y_block.start,
                end: y_block.end,
                value: f(y_block.value),
            }),
        });
    }
    ret
}

pub(crate) fn export_contiguous_2d<T: Default + Clone + PartialEq + Debug, F, C>(
    blocks: Contiguous2D<T>,
    f: F,
) -> current::Contiguous2DSchema<C>
where
    F: Fn(T) -> C,
{
    blocks
        .into_xy_blocks()
        .map(|x_block| current::BlockSchema {
            start: x_block.start,
            end: x_block.end,
            value: x_block
                .value
                .map(|y_block| current::BlockSchema {
                    start: y_block.start,
                    end: y_block.end,
                    value: f(y_block.value),
                })
                .collect(),
        })
        .collect()
}

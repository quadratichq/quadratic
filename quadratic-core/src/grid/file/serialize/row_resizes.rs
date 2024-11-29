use anyhow::Result;

use crate::grid::resize::{Resize, ResizeMap};

use super::current;

pub(crate) fn import_rows_resize(row_resizes: Vec<(i64, current::ResizeSchema)>) -> ResizeMap {
    let mut sizes = ResizeMap::default();
    for (y, size) in row_resizes {
        sizes.set_resize(
            y,
            match size {
                current::ResizeSchema::Auto => Resize::Auto,
                current::ResizeSchema::Manual => Resize::Manual,
            },
        );
    }
    sizes
}

pub(crate) fn export_rows_size(rows_resize: ResizeMap) -> Vec<(i64, current::ResizeSchema)> {
    rows_resize
        .into_iter_resize()
        .map(|(y, resize)| {
            (
                y,
                match resize {
                    Resize::Auto => current::ResizeSchema::Auto,
                    Resize::Manual => current::ResizeSchema::Manual,
                },
            )
        })
        .collect()
}

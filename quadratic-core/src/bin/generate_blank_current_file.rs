use std::fs;

const OUT_PATH_RUST_SHARED: &str = "../quadratic-rust-shared/data/grid";
const OUT_PATH_API: &str = "../quadratic-api/src/data";

use parquet::data_type::AsBytes;
use quadratic_core::grid::{file::export, Grid};

fn write(path: &str, data: &[u8]) {
    let path = format!("{path}/current_blank.grid");
    fs::write(path, data).expect("failed to write to blank file: {path}");
}

fn main() {
    let grid = Grid::new();
    let data = export(&grid).expect("failed to export to blank file");
    let bytes = data.as_bytes();

    write(OUT_PATH_RUST_SHARED, bytes);
    write(OUT_PATH_API, bytes);
}

#![allow(unused)]

//! Benchmark for moving cells
//!
//! usage:
//!
//! To run a single test
//! npm run bench:run move_cells
//!
//! # for watching the actual benchmark code only, much faster since it doesn't have to recompile core
//! npm run bench:watch:bench move_cells
//!
//! # when you're making perf changes and want to watch core only
//! npm run bench:watch:src move_cells

use std::fs;

use criterion::{Criterion, criterion_group, criterion_main};

use quadratic_core::{
    SheetPos, SheetRect,
    controller::GridController,
    grid::{Grid, file},
};
use quadratic_rust_shared::test::benchmark::single_test_or_benchmark;

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);

const SINGLE_TEST: bool = true;

/// Execute the import excel benchmark
fn execute(mut gc: GridController) {
    let sheet_id = *gc.sheet_ids().first().unwrap();
    gc.move_cells(
        SheetRect::single_pos((1, 1).into(), sheet_id),
        SheetPos::new(sheet_id, 2, 2),
        false,
        false,
        None,
    );
}

/// Benchmark for moving cells
fn criterion_benchmark(c: &mut Criterion) {
    let bench_name = format!("move_cells: customers-1_000_000.grid");
    let grid_file = fs::read("benches/test_files/customers-1_000_000.grid").unwrap();
    let file = file::import(grid_file).unwrap();
    let mut gc = GridController::from_grid(file, 0);
    let function = || execute(gc.clone());

    #[cfg(feature = "function-timer")]
    single_test_or_benchmark(
        c,
        SINGLE_TEST,
        &bench_name,
        &quadratic_core::FUNCTIONS,
        Some(10),
        Some(std::time::Duration::from_secs(1)),
        function,
    );
}

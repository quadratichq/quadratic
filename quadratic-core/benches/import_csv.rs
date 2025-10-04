#![allow(unused)]

//! Benchmark for importing csv files
//!
//! usage:
//!
//! To run a single test
//! npm run bench:run import_csv
//!
//! # for watching the actual benchmark code only, much faster since it doesn't have to recompile core
//! npm run bench:watch:bench import_csv
//!
//! # when you're making perf changes and want to watch core only
//! npm run bench:watch:src import_csv

use criterion::{Criterion, criterion_group, criterion_main};

use quadratic_core::{
    Pos, SheetRect,
    a1::A1Selection,
    controller::GridController,
    grid::{Grid, file},
};
use quadratic_rust_shared::test::benchmark::single_test_or_benchmark;

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);

const SINGLE_TEST: bool = true;

/// Execute the import csv benchmark
fn execute(file: &[u8], file_name: &str) {
    let mut gc = GridController::from_grid(Grid::new(), 0);
    let sheet_id = gc.sheet_ids()[0];
    gc.import_csv(
        sheet_id,
        file,
        file_name,
        Pos::new(1, 1),
        None,
        None,
        None,
        false,
    )
    .unwrap();
    let file = file::export(gc.into_grid()).unwrap();
    dbg!(format!("file size: {}", file.len()));

    let _grid = file::import(file).unwrap();
}

/// Benchmark for importing csv files
fn criterion_benchmark(c: &mut Criterion) {
    let file_name = "customers-100000.csv";
    let bench_name = format!("import_csv: {file_name}");
    let csv_file = include_bytes!("test_files/customers-100000.csv");
    let function = || execute(csv_file, file_name);

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

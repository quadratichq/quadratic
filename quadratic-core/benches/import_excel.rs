#![allow(unused)]

//! Benchmark for importing excel files
//!
//! usage:
//!
//! To run a single test
//! npm run bench:run import_excel
//!
//! # for watching the actual benchmark code only, much faster since it doesn't have to recompile core
//! npm run bench:watch:bench import_excel
//!
//! # when you're making perf changes and want to watch core only
//! npm run bench:watch:src import_excel

use criterion::{Criterion, criterion_group, criterion_main};

use quadratic_core::{controller::GridController, grid::Grid};
use quadratic_rust_shared::test::benchmark::single_test_or_benchmark;

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);

const SINGLE_TEST: bool = true;

/// Execute the import excel benchmark
fn execute(file: &[u8], file_name: &str) {
    let mut gc = GridController::from_grid(Grid::new_blank(), 0);
    gc.import_excel(file, file_name, None, false).unwrap();
}

/// Benchmark for importing excel files
fn criterion_benchmark(c: &mut Criterion) {
    let file_name = "1_000_000_formulas.xlsx";
    let bench_name = format!("import_excel: {file_name}");
    let excel_file = include_bytes!("test_files/1_000_000_formulas.xlsx").to_vec();
    let function = || execute(&excel_file, file_name);

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

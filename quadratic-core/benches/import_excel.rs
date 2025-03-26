#![allow(unused)]

//! Benchmark for importing excel files
//!
//! usage:
//! # for watching the actual benchmark code only, much faster since it doesn't have to recompile core
//! cargo watch -c -w benches -x "bench --bench import_excel --features function-timer -- --nocapture"

//! # when you're making perf changes and want to watch core only
//! cargo watch -c -w src -x "bench --bench import_excel --features function-timer -- --nocapture"

use criterion::{Criterion, criterion_group, criterion_main};

use quadratic_core::{controller::GridController, grid::Grid};
use quadratic_rust_shared::test::benchmark::single_test_or_benchmark;

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);

const SINGLE_TEST: bool = true;

fn execute(file: &[u8]) {
    let mut gc = GridController::from_grid(Grid::new_blank(), 0);
    gc.import_excel(file, "all_excel_functions.xlsx", None)
        .unwrap();
}

fn criterion_benchmark(c: &mut Criterion) {
    let name = "import_excel: 10_formulas";
    let excel_file = include_bytes!("test_files/10_formulas.xlsx").to_vec();
    let function = || execute(&excel_file);

    #[cfg(feature = "function-timer")]
    single_test_or_benchmark(
        c,
        SINGLE_TEST,
        name,
        &quadratic_core::FUNCTIONS,
        Some(10),
        Some(std::time::Duration::from_secs(1)),
        function,
    );
}

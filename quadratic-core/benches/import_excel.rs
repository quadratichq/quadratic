//! Benchmark for importing excel files
//!
//! usage:
//! cargo bench --bench import_excel --features function-timer -- --nocapture

use std::time::Duration;

use criterion::{Bencher, Criterion, criterion_group, criterion_main};

use quadratic_core::{controller::GridController, grid::Grid};
use quadratic_rust_shared::test::benchmark::{benchmark, benchmark_function, print_functions};

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);

const SINGLE_TEST: bool = true;

fn execute(file: &[u8]) {
    let mut gc = GridController::from_grid(Grid::new_blank(), 0);
    gc.import_excel(file, "all_excel_functions.xlsx", None)
        .unwrap();
}

#[allow(unused)]
fn criterion_benchmark(c: &mut Criterion) {
    let name = "import_excel: 10_formulas";
    let excel_file = include_bytes!("test_files/10_formulas.xlsx").to_vec();
    let function = || execute(&excel_file);
    let functions = &quadratic_core::FUNCTIONS;

    if SINGLE_TEST {
        function();
        print_functions(&functions, name, true);
    } else {
        let sample_size = Some(10);
        let measurement_time = Some(Duration::from_secs(1));
        benchmark_function(c, name, sample_size, measurement_time, function);
    }
}

#[allow(unused)]
pub fn benchmark_grids(
    c: &mut Criterion,
    inputs: &[(&str, GridController)],
    group_name: impl Into<String>,
    f: impl Fn(&mut Bencher<'_>, &GridController),
) {
    let measurement_time = Some(Duration::new(1, 0));
    let sample_size = Some(10);

    benchmark(c, inputs, group_name, measurement_time, sample_size, f);
}

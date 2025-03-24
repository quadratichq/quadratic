//! Benchmark for importing excel files
//!
//! usage:
//! cargo bench --bench import_excel --features function-timer -- --nocapture

use std::time::Duration;

use criterion::{Bencher, Criterion, criterion_group, criterion_main};

use quadratic_core::{controller::GridController, grid::Grid};
use quadratic_rust_shared::test::benchmark::benchmark;

use tabled::{
    builder::Builder,
    settings::{Color, Modify, Style},
};

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);

fn print_functions(name: &str, ignore_zero: bool) {
    let mut builder = Builder::default();
    builder.set_header(vec!["Function", "Time"]);
    let functions = quadratic_core::FUNCTIONS.lock().unwrap();

    functions.iter().for_each(|(name, time)| {
        if !(ignore_zero && time == &0) {
            builder.push_record(vec![name, &format!("{time} ms")]);
        }
    });

    drop(functions);

    let mut table = builder.build();
    table.with(Style::modern());
    table.with(Modify::new((0, 0)).with(Color::BOLD));
    table.with(Modify::new((0, 1)).with(Color::BOLD));

    println!("\nBenchmark: {name}\n{table}");
}

fn execute(file: Vec<u8>) {
    let mut gc = GridController::from_grid(Grid::new_blank(), 0);
    gc.import_excel(file, "all_excel_functions.xlsx", None)
        .unwrap();
}

#[allow(unused)]
fn criterion_benchmark(c: &mut Criterion) {
    let args: Vec<String> = std::env::args().collect();
    let name = &format!("import_excel: 10_000_formulas");
    let excel_file = include_bytes!("test_files/10_000_formulas.xlsx").to_vec();

    execute(excel_file);
    print_functions(name, true);

    // let mut group = c.benchmark_group(name);
    // group.sample_size(10);
    // group.measurement_time(Duration::from_secs(1));
    // let mut count = 1;
    // // let mut batches = vec![];

    // group.bench_function(name, |b| {
    //     b.iter(|| {
    //         execute(excel_file.clone());
    //         print_functions(name, true);

    //         // batches.push(functions.to_owned());

    //         count += 1;
    //         *quadratic_core::FUNCTIONS.lock().unwrap() = vec![];
    //     });
    // });
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

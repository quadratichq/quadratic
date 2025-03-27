//! Benchmark utilities

use criterion::{Bencher, Criterion};
use std::sync::{LazyLock, Mutex};
use std::time::Duration;

#[cfg(any(test, feature = "test"))]
use tabled::{
    builder::Builder,
    settings::{Color, Modify, Style},
};

pub type Functions = LazyLock<Mutex<Vec<(String, i64)>>>;

/// Benchmark for a single function with inputs
pub fn benchmark<T>(
    c: &mut Criterion,
    inputs: &[(&str, T)],
    group_name: impl Into<String>,
    measurement_time: Option<Duration>,
    sample_size: Option<usize>,
    f: impl Fn(&mut Bencher<'_>, &T),
) {
    let mut group = c.benchmark_group(group_name);

    measurement_time.map(|t| group.measurement_time(t));
    sample_size.map(|s| group.sample_size(s));

    for (id, input) in inputs {
        group.bench_with_input(*id, input, &f);
    }

    group.finish()
}

/// Benchmark for a single function
pub fn benchmark_function(
    c: &mut Criterion,
    name: &str,
    sample_size: Option<usize>,
    measurement_time: Option<Duration>,
    f: impl Fn(),
) {
    let mut group = c.benchmark_group(&name.to_string());

    measurement_time.map(|t| group.measurement_time(t));
    sample_size.map(|s| group.sample_size(s));

    group.bench_function(name, |b| b.iter(|| f()));
}

/// Print the functions in the benchmark
pub fn print_functions(functions: &Functions, name: &str, ignore_zero: bool) {
    let mut builder = Builder::default();
    builder.set_header(vec!["Function", "Time"]);
    let functions = functions.lock().unwrap();

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

/// Run a single test or benchmark
pub fn single_test_or_benchmark(
    c: &mut Criterion,
    single_test: bool,
    name: &str,
    functions: &Functions,
    sample_size: Option<usize>,
    measurement_time: Option<Duration>,
    f: impl Fn(),
) {
    if single_test {
        f();
        print_functions(&functions, name, true);
    } else {
        benchmark_function(c, name, sample_size, measurement_time, f);
    }
}

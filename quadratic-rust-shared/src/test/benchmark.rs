//! Benchmark utilities

use criterion::{Bencher, Criterion};
use std::sync::{LazyLock, Mutex};
use std::time::Duration;

#[cfg(any(test, feature = "test", feature = "benchmark"))]
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
    let mut group = c.benchmark_group(name.to_string());

    measurement_time.map(|t| group.measurement_time(t));
    sample_size.map(|s| group.sample_size(s));

    group.bench_function(name, |b| b.iter(&f));
}

/// Print the functions in the benchmark (aggregated by function name)
/// Times are stored in microseconds and displayed in milliseconds
pub fn print_functions(functions: &Functions, name: &str, ignore_zero: bool) {
    use std::collections::HashMap;

    let mut builder = Builder::default();
    builder.set_header(vec!["Function", "Time", "Calls", "Avg"]);
    let functions = functions.lock().unwrap();

    // Aggregate times by function name (times are in microseconds)
    let mut aggregated: HashMap<&str, (i64, u64)> = HashMap::new();
    for (fn_name, time_us) in functions.iter() {
        let entry = aggregated.entry(fn_name.as_str()).or_insert((0, 0));
        entry.0 += time_us;
        entry.1 += 1;
    }

    // Sort by total time descending
    let mut sorted: Vec<_> = aggregated.into_iter().collect();
    sorted.sort_by(|a, b| b.1.0.cmp(&a.1.0));

    for (fn_name, (total_time_us, call_count)) in sorted {
        let total_time_ms = total_time_us / 1000;
        let avg_time_us = if call_count > 0 {
            total_time_us / call_count as i64
        } else {
            0
        };
        if !(ignore_zero && total_time_ms == 0) {
            builder.push_record(vec![
                fn_name,
                &format!("{total_time_ms} ms"),
                &format!("{call_count}"),
                &format!("{avg_time_us} µs"),
            ]);
        }
    }

    drop(functions);

    let mut table = builder.build();
    table.with(Style::modern());
    table.with(Modify::new((0, 0)).with(Color::BOLD));
    table.with(Modify::new((0, 1)).with(Color::BOLD));
    table.with(Modify::new((0, 2)).with(Color::BOLD));
    table.with(Modify::new((0, 3)).with(Color::BOLD));

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
        print_functions(functions, name, true);
    } else {
        benchmark_function(c, name, sample_size, measurement_time, f);
    }
}

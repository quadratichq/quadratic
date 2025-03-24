use criterion::{Bencher, Criterion};
use std::time::Duration;

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

    println!("benchmark finished");

    group.finish()
}

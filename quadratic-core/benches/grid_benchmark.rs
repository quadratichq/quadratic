use criterion::{criterion_group, criterion_main, Bencher, Criterion};
use quadratic_core::grid::Grid;
use quadratic_core::{Pos, Rect};

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);

fn criterion_benchmark(c: &mut Criterion) {
    let airports =
        quadratic_core::grid::file::import(include_str!("../examples/airports.json")).unwrap();

    let inputs = vec![("empty", Grid::new()), ("airports", airports)];

    benchmark_grids(c, &inputs, "get_render_cells_all", |b, grid| {
        b.iter(|| {
            let output = grid.sheets()[0].get_render_cells(Rect {
                min: Pos { x: -1000, y: -1000 },
                max: Pos { x: 1000, y: 1000 },
            });
            serde_json::to_string(&output)
        });
    });

    benchmark_grids(c, &inputs, "get_render_cells_10x40", |b, grid| {
        b.iter(|| {
            let output = grid.sheets()[0].get_render_cells(Rect {
                min: Pos { x: 11, y: 11 },
                max: Pos { x: 20, y: 50 },
            });
            serde_json::to_string(&output)
        });
    });

    benchmark_grids(c, &inputs, "recalculate_bounds", |b, grid| {
        let mut grid = grid.clone();
        b.iter(|| grid.sheets_mut()[0].recalculate_bounds());
    });
}

fn benchmark_grids(
    c: &mut Criterion,
    inputs: &[(&str, Grid)],
    group_name: impl Into<String>,
    f: impl Fn(&mut Bencher<'_>, &Grid),
) {
    let mut group = c.benchmark_group(group_name);
    for (id, grid) in inputs {
        group.bench_with_input(*id, grid, &f);
    }
    group.finish()
}

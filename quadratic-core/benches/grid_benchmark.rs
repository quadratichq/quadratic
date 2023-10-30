use criterion::{criterion_group, criterion_main, Bencher, Criterion};
use quadratic_core::controller::GridController;
use quadratic_core::grid::Grid;
use quadratic_core::{Pos, Rect};
use std::time::Duration;

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);

fn criterion_benchmark(c: &mut Criterion) {
    let airports =
        quadratic_core::grid::file::import(include_str!("../examples/airports.grid")).unwrap();

    let inputs = vec![
        ("empty", Grid::new()), // empty file
        ("airports", airports), // airports file
    ];

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

    benchmark_grids(c, &inputs, "copy_paste_10_x_10", |b, grid| {
        let mut gc = GridController::from_grid(grid.clone());
        b.iter(|| {
            let sheet_id = gc.sheet_ids()[0];
            let rect = Rect {
                min: Pos { x: 0, y: 0 },
                max: Pos { x: 10, y: 10 },
            };
            let pos = Pos { x: 10000, y: 10000 };
            let contents = gc.copy_to_clipboard(sheet_id, rect);
            gc.paste_from_clipboard(sheet_id, pos, Some(contents.0), Some(contents.1), None);
        });
    });

    benchmark_grids(c, &inputs, "copy_paste_100_x_100", |b, grid| {
        let mut gc = GridController::from_grid(grid.clone());
        b.iter(|| {
            let sheet_id = gc.sheet_ids()[0];
            let rect = Rect {
                min: Pos { x: 0, y: 0 },
                max: Pos { x: 100, y: 100 },
            };
            let pos = Pos { x: 10000, y: 10000 };
            let contents = gc.copy_to_clipboard(sheet_id, rect);
            gc.paste_from_clipboard(sheet_id, pos, Some(contents.0), Some(contents.1), None);
        });
    });

    // TOO SLOW
    // benchmark_grids(c, &inputs, "copy_paste_1000_x_1000", |b, grid| {
    //     let mut gc = GridController::from_grid(grid.clone());
    //     b.iter(|| {
    //         let sheet_id = gc.sheet_ids()[0];
    //         let rect = Rect {
    //             min: Pos { x: 0, y: 0 },
    //             max: Pos { x: 1000, y: 1000 },
    //         };
    //         let pos = Pos { x: 10000, y: 10000 };
    //         let contents = gc.copy_to_clipboard(sheet_id, rect);
    //         gc.paste_from_clipboard(sheet_id, pos, Some(contents.0), Some(contents.1), None);
    //     });
    // });

    benchmark_grids(c, &inputs, "delete_20000_x20000", |b, grid| {
        b.iter_batched(
            || {
                // Setup
                let gc = GridController::from_grid(grid.clone());
                let sheet_id = gc.sheet_ids()[0];
                let rect = Rect {
                    min: Pos {
                        x: -10000,
                        y: -10000,
                    },
                    max: Pos { x: 10000, y: 10000 },
                };
                (gc, sheet_id, rect)
            },
            |(mut gc, sheet_id, rect)| {
                // Test
                gc.delete_cell_values(sheet_id, rect, None);
            },
            criterion::BatchSize::SmallInput,
        )
    });

    benchmark_grids(c, &inputs, "undo_delete_20000_x20000", |b, grid| {
        b.iter_batched(
            || {
                // Setup
                let mut gc = GridController::from_grid(grid.clone());
                let sheet_id = gc.sheet_ids()[0];
                let rect = Rect {
                    min: Pos {
                        x: -10000,
                        y: -10000,
                    },
                    max: Pos { x: 10000, y: 10000 },
                };
                gc.delete_cell_values(sheet_id, rect, None);
                gc
            },
            |mut gc| {
                // Test
                gc.undo(None);
            },
            criterion::BatchSize::SmallInput,
        )
    });

    benchmark_grids(c, &inputs, "redo_delete_20000_x20000", |b, grid| {
        b.iter_batched(
            || {
                // Setup
                let mut gc = GridController::from_grid(grid.clone());
                let sheet_id = gc.sheet_ids()[0];
                let rect = Rect {
                    min: Pos {
                        x: -10000,
                        y: -10000,
                    },
                    max: Pos { x: 10000, y: 10000 },
                };
                gc.delete_cell_values(sheet_id, rect, None);
                gc.undo(None);
                gc
            },
            |mut gc| {
                // Test
                gc.redo(None);
            },
            criterion::BatchSize::SmallInput,
        )
    });

    benchmark_grids(c, &inputs, "add_sheet", |b, grid| {
        b.iter_batched(
            || {
                // Setup
                GridController::from_grid(grid.clone())
            },
            |mut gc| {
                // Test
                gc.add_sheet(None);
            },
            criterion::BatchSize::SmallInput,
        )
    });

    benchmark_grids(c, &inputs, "autocomplete_10_to_100", |b, _grid| {
        let grid = Grid::new();
        let mut gc = GridController::from_grid(grid);
        let sheet_id = gc.sheet_ids()[0];

        let small_selection = Rect {
            min: Pos { x: 0, y: 0 },
            max: Pos { x: 10, y: 10 },
        };
        // add some data
        gc.populate_with_random_floats(sheet_id, &small_selection);

        let expand_to = Rect {
            min: Pos { x: 0, y: 0 },
            max: Pos { x: 100, y: 100 },
        };

        b.iter_batched(
            || {
                // Setup
                (gc.clone(), sheet_id, small_selection, expand_to)
            },
            |(mut gc, sheet_id, small_selection, expand_to)| {
                // Test
                gc.autocomplete(sheet_id, small_selection, expand_to, None)
                    .unwrap();
            },
            criterion::BatchSize::SmallInput,
        )
    });

    benchmark_grids(c, &inputs, "clear_formatting", |b, grid| {
        b.iter_batched(
            || {
                // Setup
                let gc = GridController::from_grid(grid.clone());
                let sheet_id = gc.sheet_ids()[0];
                let rect = Rect {
                    min: Pos {
                        x: -10000,
                        y: -10000,
                    },
                    max: Pos { x: 10000, y: 10000 },
                };
                (gc, sheet_id, rect)
            },
            |(mut gc, sheet_id, rect)| {
                // Test
                gc.clear_formatting(sheet_id, rect, None);
            },
            criterion::BatchSize::SmallInput,
        )
    });

    benchmark_grids(c, &inputs, "delete_sheet", |b, grid| {
        b.iter_batched(
            || {
                // Setup
                let gc = GridController::from_grid(grid.clone());
                let sheet_id = gc.sheet_ids()[0];
                (gc, sheet_id)
            },
            |(mut gc, sheet_id)| {
                // Test
                gc.delete_sheet(sheet_id, None)
            },
            criterion::BatchSize::SmallInput,
        )
    });

    benchmark_grids(c, &inputs, "delete_sheet_undo", |b, grid| {
        b.iter_batched(
            || {
                // Setup
                let mut gc = GridController::from_grid(grid.clone());
                let sheet_id = gc.sheet_ids()[0];
                gc.delete_sheet(sheet_id, None);
                gc
            },
            |mut gc| {
                // Test
                gc.undo(None);
            },
            criterion::BatchSize::SmallInput,
        )
    });

    benchmark_grids(c, &inputs, "import_small_csv", |b, grid| {
        const SIMPLE_CSV: &str = r#"city,region,country,population
        Southborough,MA,United States,9686
        Northbridge,MA,United States,14061
        Westborough,MA,United States,29313
        Marlborough,MA,United States,38334
        Springfield,MA,United States,152227
        Springfield,MO,United States,150443
        Springfield,NJ,United States,14976
        Springfield,OH,United States,64325
        Springfield,OR,United States,56032
        Concord,NH,United States,42605
        "#;

        b.iter_batched(
            || {
                // Setup
                let gc = GridController::from_grid(grid.clone());
                let sheet_id = gc.sheet_ids()[0];
                let pos = Pos { x: 0, y: 0 };
                (gc, sheet_id, pos)
            },
            |(mut gc, sheet_id, pos)| {
                // Test
                let _ = gc.import_csv(sheet_id, SIMPLE_CSV.as_bytes(), "smallpop.csv", pos, None);
            },
            criterion::BatchSize::SmallInput,
        )
    });
}

fn benchmark_grids(
    c: &mut Criterion,
    inputs: &[(&str, Grid)],
    group_name: impl Into<String>,
    f: impl Fn(&mut Bencher<'_>, &Grid),
) {
    let mut group = c.benchmark_group(group_name);
    group.measurement_time(Duration::new(5, 0));
    group.sample_size(10);
    for (id, grid) in inputs {
        group.bench_with_input(*id, grid, &f);
    }
    group.finish()
}

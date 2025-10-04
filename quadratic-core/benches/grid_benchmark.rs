use criterion::{Bencher, Criterion, criterion_group, criterion_main};
use quadratic_rust_shared::test::benchmark::benchmark;

use std::time::Duration;

use quadratic_core::controller::GridController;
use quadratic_core::controller::operations::clipboard::{ClipboardOperation, PasteSpecial};
use quadratic_core::grid::Grid;
use quadratic_core::{Pos, Rect, SheetRect, a1::A1Selection};

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);

#[allow(unused)]
fn criterion_benchmark(c: &mut Criterion) {
    let airports = quadratic_core::grid::file::import(
        include_bytes!("../../quadratic-rust-shared/data/grid/v1_4_airports_distance.grid")
            .to_vec(),
    )
    .unwrap();

    let inputs = vec![
        ("empty", Grid::new()), // empty file
        ("airports", airports), // airports file
    ];

    benchmark_grids(c, &inputs, "get_render_cells_all", |b, grid| {
        let a1_context = grid.expensive_make_a1_context();
        b.iter(|| {
            let output = grid.sheets()[0].get_render_cells(
                Rect {
                    min: Pos { x: -1000, y: -1000 },
                    max: Pos { x: 1000, y: 1000 },
                },
                &a1_context,
            );
            serde_json::to_string(&output)
        });
    });

    benchmark_grids(c, &inputs, "get_render_cells_10x40", |b, grid| {
        let a1_context = grid.expensive_make_a1_context();
        b.iter(|| {
            let output = grid.sheets()[0].get_render_cells(
                Rect {
                    min: Pos { x: 11, y: 11 },
                    max: Pos { x: 20, y: 50 },
                },
                &a1_context,
            );
            serde_json::to_string(&output)
        });
    });

    benchmark_grids(c, &inputs, "recalculate_bounds", |b, grid| {
        let mut grid = grid.clone();
        b.iter(|| {
            let a1_context = grid.expensive_make_a1_context();
            grid.first_sheet_mut().recalculate_bounds(&a1_context);
        });
    });

    benchmark_grids(c, &inputs, "copy_paste_10_x_10", |b, grid| {
        let mut gc = GridController::from_grid(grid.clone(), 0);
        b.iter(|| {
            let sheet_id = gc.sheet_ids()[0];
            let sheet_rect = SheetRect {
                min: Pos { x: 0, y: 0 },
                max: Pos { x: 10, y: 10 },
                sheet_id,
            };

            let sheet = gc.try_sheet(sheet_id).unwrap();
            let js_clipboard = sheet
                .copy_to_clipboard(
                    &A1Selection::from_rect(sheet_rect),
                    gc.a1_context(),
                    ClipboardOperation::Copy,
                    true,
                )
                .into();

            let pos = Pos { x: 10000, y: 10000 };
            gc.paste_from_clipboard(
                &A1Selection::from_xy(pos.x, pos.y, sheet_id),
                js_clipboard,
                PasteSpecial::None,
                None,
                false,
            );
        });
    });

    benchmark_grids(c, &inputs, "copy_paste_100_x_100", |b, grid| {
        let mut gc = GridController::from_grid(grid.clone(), 0);
        b.iter(|| {
            let sheet_id = gc.sheet_ids()[0];
            let sheet_rect = SheetRect {
                min: Pos { x: 0, y: 0 },
                max: Pos { x: 100, y: 100 },
                sheet_id,
            };

            let sheet = gc.try_sheet(sheet_id).unwrap();
            let js_clipboard = sheet
                .copy_to_clipboard(
                    &A1Selection::from_rect(sheet_rect),
                    gc.a1_context(),
                    ClipboardOperation::Copy,
                    true,
                )
                .into();

            let pos = Pos { x: 10000, y: 10000 };
            gc.paste_from_clipboard(
                &A1Selection::from_xy(pos.x, pos.y, sheet_id),
                js_clipboard,
                PasteSpecial::None,
                None,
                false,
            );
        });
    });

    // TOO SLOW
    // benchmark_grids(c, &inputs, "copy_paste_1000_x_1000", |b, grid| {
    //     let mut gc = GridController::from_grid(grid.clone(), 0);
    //     b.iter(|| {
    //         let sheet_id = gc.sheet_ids()[0];
    //         let rect = Rect {
    //             min: Pos { x: 0, y: 0 },
    //             max: Pos { x: 1000, y: 1000 },
    //         };
    //         let pos = Pos { x: 10000, y: 10000 };
    //         let contents = gc.copy_to_clipboard(sheet_id, rect, true);
    //         gc.paste_from_clipboard(sheet_id, pos, Some(contents.0), Some(contents.1), None);
    //     });
    // });

    benchmark_grids(c, &inputs, "delete_20000_x20000", |b, grid| {
        b.iter_batched(
            || {
                // Setup
                let gc = GridController::from_grid(grid.clone(), 0);
                let sheet_id = gc.sheet_ids()[0];
                let sheet_rect = SheetRect {
                    min: Pos {
                        x: -10000,
                        y: -10000,
                    },
                    max: Pos { x: 10000, y: 10000 },
                    sheet_id,
                };
                (gc, sheet_rect)
            },
            |(mut gc, sheet_rect)| {
                // Test
                gc.delete_cells(&A1Selection::from_rect(sheet_rect), None, false);
            },
            criterion::BatchSize::SmallInput,
        )
    });

    benchmark_grids(c, &inputs, "undo_delete_20000_x20000", |b, grid| {
        b.iter_batched(
            || {
                // Setup
                let mut gc = GridController::from_grid(grid.clone(), 0);
                let sheet_id = gc.sheet_ids()[0];
                let sheet_rect = SheetRect {
                    min: Pos {
                        x: -10000,
                        y: -10000,
                    },
                    max: Pos { x: 10000, y: 10000 },
                    sheet_id,
                };
                gc.delete_cells(&A1Selection::from_rect(sheet_rect), None, false);
                gc
            },
            |mut gc| {
                // Test
                gc.undo(1, None, false);
            },
            criterion::BatchSize::SmallInput,
        )
    });

    benchmark_grids(c, &inputs, "redo_delete_20000_x20000", |b, grid| {
        b.iter_batched(
            || {
                // Setup
                let mut gc = GridController::from_grid(grid.clone(), 0);
                let sheet_id = gc.sheet_ids()[0];
                let sheet_rect = SheetRect {
                    min: Pos {
                        x: -10000,
                        y: -10000,
                    },
                    max: Pos { x: 10000, y: 10000 },
                    sheet_id,
                };
                gc.delete_cells(&A1Selection::from_rect(sheet_rect), None, false);
                gc.undo(1, None, false);
                gc
            },
            |mut gc| {
                // Test
                gc.redo(1, None, false);
            },
            criterion::BatchSize::SmallInput,
        )
    });

    benchmark_grids(c, &inputs, "add_sheet", |b, grid| {
        b.iter_batched(
            || {
                // Setup
                GridController::from_grid(grid.clone(), 0)
            },
            |mut gc| {
                // Test
                gc.add_sheet(None, None, None, false);
            },
            criterion::BatchSize::SmallInput,
        )
    });

    benchmark_grids(c, &inputs, "clear_formatting", |b, grid| {
        b.iter_batched(
            || {
                // Setup
                let gc = GridController::from_grid(grid.clone(), 0);
                let sheet_id = gc.sheet_ids()[0];
                let sheet_rect = SheetRect {
                    min: Pos {
                        x: -10000,
                        y: -10000,
                    },
                    max: Pos { x: 10000, y: 10000 },
                    sheet_id,
                };
                (gc, sheet_rect)
            },
            |(mut gc, sheet_rect)| {
                // Test
                gc.clear_formatting(&A1Selection::from_rect(sheet_rect), None, false);
            },
            criterion::BatchSize::SmallInput,
        )
    });

    benchmark_grids(c, &inputs, "delete_sheet", |b, grid| {
        b.iter_batched(
            || {
                // Setup
                let gc = GridController::from_grid(grid.clone(), 0);
                let sheet_id = gc.sheet_ids()[0];
                (gc, sheet_id)
            },
            |(mut gc, sheet_id)| {
                // Test
                gc.delete_sheet(sheet_id, None, false)
            },
            criterion::BatchSize::SmallInput,
        )
    });

    benchmark_grids(c, &inputs, "delete_sheet_undo", |b, grid| {
        b.iter_batched(
            || {
                // Setup
                let mut gc = GridController::from_grid(grid.clone(), 0);
                let sheet_id = gc.sheet_ids()[0];
                gc.delete_sheet(sheet_id, None, false);
                gc
            },
            |mut gc| {
                // Test
                gc.undo(1, None, false);
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
                let gc = GridController::from_grid(grid.clone(), 0);
                let sheet_id = gc.sheet_ids()[0];
                let pos = Pos { x: 0, y: 0 };
                (gc, sheet_id, pos)
            },
            |(mut gc, sheet_id, pos)| {
                // Test
                let _ = gc.import_csv(
                    sheet_id,
                    SIMPLE_CSV.as_bytes(),
                    "smallpop.csv",
                    pos,
                    None,
                    Some(b','),
                    Some(false),
                    false,
                    false,
                );
            },
            criterion::BatchSize::SmallInput,
        )
    });
}

#[allow(unused)]
pub fn benchmark_grids(
    c: &mut Criterion,
    inputs: &[(&str, Grid)],
    group_name: impl Into<String>,
    f: impl Fn(&mut Bencher<'_>, &Grid),
) {
    let measurement_time = Some(Duration::new(5, 0));
    let sample_size = Some(10);

    benchmark(c, inputs, group_name, measurement_time, sample_size, f);
}

#![allow(unused)]

//! Benchmark for autocomplete formula performance
//!
//! usage:
//!
//! To run a single test with function timer output:
//! cargo bench --bench autocomplete_formula --features function-timer
//!
//! To run criterion benchmark:
//! npm run bench:run autocomplete_formula

use criterion::{Criterion, criterion_group, criterion_main};

use quadratic_core::{
    Rect, SheetPos,
    a1::A1Selection,
    controller::GridController,
    controller::operations::clipboard::{ClipboardOperation, PasteSpecial},
    grid::CodeCellLanguage,
};
use quadratic_rust_shared::test::benchmark::single_test_or_benchmark;

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);

const SINGLE_TEST: bool = true;

/// Setup the grid with values in column A
fn setup_grid(size: i64) -> (GridController, quadratic_core::grid::SheetId) {
    let mut gc = GridController::test();
    let sheet_id = gc.sheet_ids()[0];

    // Set values in column A
    for i in 1..=size {
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: i,
                sheet_id,
            },
            i.to_string(),
            None,
            false,
        );
    }

    // Add formula A1+1 in B1
    gc.set_code_cell(
        SheetPos {
            x: 2,
            y: 1,
            sheet_id,
        },
        CodeCellLanguage::Formula,
        "A1+1".to_string(),
        None,
        None,
        false,
    );

    (gc, sheet_id)
}

/// Execute the autocomplete benchmark
fn execute_autocomplete(
    gc: &mut GridController,
    sheet_id: quadratic_core::grid::SheetId,
    size: i64,
) {
    let selected = Rect::new(2, 1, 2, 1); // B1
    let range = Rect::new(2, 1, 2, size); // B1:B{size}
    gc.autocomplete(sheet_id, selected, range, None, false)
        .unwrap();

    // Copy column B to clipboard
    let selection = A1Selection::from_rect(Rect::new(2, 1, 2, size).to_sheet_rect(sheet_id));
    let a1_context = gc.a1_context().to_owned();
    let js_clipboard = gc
        .try_sheet(sheet_id)
        .unwrap()
        .copy_to_clipboard(&selection, &a1_context, ClipboardOperation::Copy, true)
        .into();

    // Paste B to C1
    gc.paste_from_clipboard(
        &A1Selection::from_xy(3, 1, sheet_id),
        js_clipboard,
        PasteSpecial::None,
        None,
        false,
    );
}

/// Execute the benchmark function (sets up and runs autocomplete)
fn execute(size: i64) {
    let (mut gc, sheet_id) = setup_grid(size);
    execute_autocomplete(&mut gc, sheet_id, size);
}

/// Criterion benchmark
fn criterion_benchmark(c: &mut Criterion) {
    let size = 10000;
    let bench_name = format!("autocomplete_{}_formulas", size);

    #[cfg(feature = "function-timer")]
    {
        // Wrap execution with total timing
        let function = || {
            let start = std::time::Instant::now();
            execute(size);
            let elapsed = start.elapsed();
            println!(
                "\n=== TOTAL TIME: {:.2}ms for {} formulas ({:.0} formulas/sec) ===\n",
                elapsed.as_secs_f64() * 1000.0,
                size,
                size as f64 / elapsed.as_secs_f64()
            );
        };

        single_test_or_benchmark(
            c,
            SINGLE_TEST,
            &bench_name,
            &quadratic_core::FUNCTIONS,
            Some(10),
            Some(std::time::Duration::from_secs(60)),
            function,
        );
    }

    #[cfg(not(feature = "function-timer"))]
    {
        let mut group = c.benchmark_group("autocomplete_formula");
        group.sample_size(10);
        group.measurement_time(std::time::Duration::from_secs(10));

        for size in [1000, 5000, 10000] {
            group.bench_function(format!("autocomplete_{}_formulas", size), |b| {
                b.iter_batched(
                    || setup_grid(size),
                    |(mut gc, sheet_id)| {
                        execute_autocomplete(&mut gc, sheet_id, size);
                    },
                    criterion::BatchSize::LargeInput,
                );
            });
        }

        group.finish();
    }
}

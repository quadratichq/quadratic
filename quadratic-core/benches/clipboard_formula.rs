#![allow(unused)]

//! Benchmark for clipboard formula performance
//!
//! usage:
//!
//! To run a single test with function timer output:
//! cargo bench --bench clipboard_formula --features function-timer
//!
//! To run criterion benchmark:
//! npm run bench:run clipboard_formula

use criterion::{Criterion, criterion_group, criterion_main};

use quadratic_core::{
    Rect, SheetPos, SheetRect,
    a1::A1Selection,
    controller::{
        GridController,
        operations::clipboard::{Clipboard, ClipboardOperation, PasteSpecial},
    },
    grid::{CodeCellLanguage, js_types::JsClipboard},
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
    gc.set_formula(
        A1Selection::from_rect(SheetRect::new(2, 1, 2, size, sheet_id)),
        "A1+1".to_string(),
        None,
    );

    (gc, sheet_id)
}

/// Execute the clipboard benchmark
fn execute_copy(
    gc: &mut GridController,
    sheet_id: quadratic_core::grid::SheetId,
    size: i64,
) -> JsClipboard {
    // Copy column B to clipboard
    let selection = A1Selection::from_rect(Rect::new(2, 1, 2, size).to_sheet_rect(sheet_id));
    let a1_context = gc.a1_context().to_owned();
    gc.try_sheet(sheet_id)
        .unwrap()
        .copy_to_clipboard(&selection, &a1_context, ClipboardOperation::Copy, true)
        .into()
}

fn execute_paste(
    gc: &mut GridController,
    sheet_id: quadratic_core::grid::SheetId,
    js_clipboard: JsClipboard,
) {
    // Paste B to C1
    gc.paste_from_clipboard(
        &A1Selection::from_xy(3, 1, sheet_id),
        js_clipboard,
        PasteSpecial::None,
        None,
        false,
    );
}

/// Criterion benchmark
fn criterion_benchmark(c: &mut Criterion) {
    let size = 70000;
    let bench_name = format!("clipboard_{}_formulas", size);

    #[cfg(feature = "function-timer")]
    {
        // Wrap execution with total timing
        let function = || {
            let (mut gc, sheet_id) = setup_grid(size);
            let js_clipboard = execute_copy(&mut gc, sheet_id, size);
            execute_paste(&mut gc, sheet_id, js_clipboard);
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
        let mut group = c.benchmark_group("clipboard_formula");
        group.sample_size(10);
        group.measurement_time(std::time::Duration::from_secs(10));

        for size in [1000, 5000, 10000] {
            group.bench_function(format!("clipboard_{}_formulas", size), |b| {
                b.iter_batched(
                    || setup_grid(size),
                    |(mut gc, sheet_id)| {
                        let js_clipboard = execute_copy(&mut gc, sheet_id, size);
                        execute_paste(&mut gc, sheet_id, js_clipboard);
                    },
                    criterion::BatchSize::LargeInput,
                );
            });
        }

        group.finish();
    }
}

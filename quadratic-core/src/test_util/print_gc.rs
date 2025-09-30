#[cfg(test)]
use crate::controller::GridController;

/// Prints the names of the operations in the last undo transaction.
#[allow(clippy::format_in_format_args)]
#[cfg(test)]
#[allow(unused)]
pub(crate) fn print_last_undo_transaction_names(gc: &GridController) {
    let undo = gc.undo_stack().last().expect("No undo stack");
    println!("__Last undo ops__");
    for op in &undo.operations {
        println!(
            "{}",
            format!("{op:?}").split('{').next().unwrap_or("Unknown")
        );
    }
    println!("\n");
}

/// Prints the operations in the last undo transaction.
#[cfg(test)]
#[allow(unused)]
pub(crate) fn print_last_undo_transactions(gc: &GridController) {
    let undo = gc.undo_stack().last().expect("No redo stack");
    println!("__Last undo ops__");
    for op in &undo.operations {
        println!("{op:?}");
    }
    println!("\n");
}

/// Prints the names of the operations in the last redo transaction.
#[allow(clippy::format_in_format_args)]
#[cfg(test)]
#[allow(unused)]
pub(crate) fn print_last_redo_transaction_names(gc: &GridController) {
    let redo = gc.redo_stack().last().expect("No redo stack");
    println!("__Last redo ops__");
    for op in &redo.operations {
        println!(
            "{}",
            format!("{op:?}").split('{').next().unwrap_or("Unknown")
        );
    }
    println!("\n");
}

/// Prints the operations in the last redo transaction.
#[allow(clippy::format_in_format_args)]
#[cfg(test)]
#[allow(unused)]
pub(crate) fn print_last_redo_transactions(gc: &GridController) {
    let redo = gc.redo_stack().last().expect("No redo stack");
    println!("__Last redo ops__");
    for op in &redo.operations {
        println!("{}", format!("{:?}", op));
    }
    println!("\n");
}

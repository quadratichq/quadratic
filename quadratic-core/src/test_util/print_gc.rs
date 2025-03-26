use crate::controller::GridController;

/// Prints the names of the operations in the last undo transaction.
pub fn print_last_reverse_transaction_names(gc: &GridController) {
    let undo = gc.undo_stack().last().expect("No undo stack");
    for op in &undo.operations {
        println!(
            "{}",
            format!("{:?}", op).split('{').next().unwrap_or("Unknown")
        );
    }
}

/// Prints the operations in the last undo transaction.
pub fn print_last_reverse_transactions(gc: &GridController) {
    let undo = gc.undo_stack().last().expect("No redo stack");
    for op in &undo.operations {
        println!("{}", format!("{:?}", op));
    }
}

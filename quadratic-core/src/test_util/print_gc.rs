use crate::controller::GridController;

#[track_caller]
pub fn print_last_reverse_transaction_names(gc: &GridController) {
    let undo = gc.undo_stack().last().expect("No undo stack");
    for op in &undo.operations {
        println!(
            "{}",
            format!("{:?}", op).split('{').next().unwrap_or("Unknown")
        );
    }
}

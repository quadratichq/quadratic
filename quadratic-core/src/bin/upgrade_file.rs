use std::env;
use std::fs;

use quadratic_core::grid::file::{export, import};

fn main() {
    let args: Vec<String> = env::args().collect();
    let path = args.get(1).expect("missing path");
    let path_out = path.replace(".grid", "-upgraded.grid");
    let file = fs::read(path).unwrap_or_else(|e| {
        eprintln!("failed to read from {path}: {e}");
        std::process::exit(1);
    });
    let grid = import(file).unwrap_or_else(|e| {
        eprintln!("failed to import from {path}: {e}");
        std::process::exit(1);
    });
    let data = export(grid).unwrap_or_else(|e| {
        eprintln!("failed to export to file: {e}");
        std::process::exit(1);
    });

    fs::write(path_out, data).expect("failed to write to {path_out}");
}

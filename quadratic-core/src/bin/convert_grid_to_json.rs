use std::env;
use std::fs;

use quadratic_core::grid::file::{export_json, import};

fn main() {
    let args: Vec<String> = env::args().collect();
    let path = args.get(1).expect("missing path");
    let path_out = path.replace(".grid", ".json");
    let file = fs::read(path.to_owned()).expect(&format!("failed to read from {path}"));
    let grid = import(file).expect(&format!("failed to import from {path}"));
    let data = export_json(grid).expect("failed to export to JSON");

    fs::write(path_out, data).expect("failed to write to {path_out}");
}

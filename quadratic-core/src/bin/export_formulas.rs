//! Exports all formula names to a JSON file.
//!
//! Run with: `cargo run --bin export_formulas`
//! This will output to `scripts/formulas/quadratic-formulas.json`

use std::path::PathBuf;

fn main() {
    // Collect all formula names from all categories
    let mut formula_names: Vec<&str> = quadratic_core::formulas::functions::CATEGORIES
        .iter()
        .filter(|category| category.include_in_docs) // Only include documented functions
        .flat_map(|category| (category.get_functions)())
        .map(|func| func.name)
        .collect();

    // Sort alphabetically (case-insensitive)
    formula_names.sort_by_key(|a| a.to_ascii_uppercase());

    // Convert to JSON
    let json = serde_json::to_string_pretty(&formula_names).expect("failed to serialize to JSON");

    // Determine output path
    let out_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("scripts")
        .join("formulas")
        .join("quadratic-formulas.json");

    // Write to file
    std::fs::write(&out_path, json).expect("failed to write to output file");

    println!(
        "Exported {} formulas to {}",
        formula_names.len(),
        out_path.display()
    );
}

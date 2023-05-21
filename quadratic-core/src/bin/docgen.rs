use itertools::Itertools;

const OUT_FILENAME: &str = "formula_docs_output.md";

fn main() {
    let mut output = String::new();

    for category in quadratic_core::formulas::functions::CATEGORIES {
        if !category.include_in_docs {
            continue;
        }

        output.push_str(&format!("## {}\n\n", category.name));
        output.push_str(category.docs);

        // Table header.
        output.push_str("| **Function** | **Description** |\n");
        output.push_str("| ------------ | --------------- |\n");
        for func in (category.get_functions)() {
            let usages = func.usages_strings().map(|s| format!("`{s}`")).join("; ");
            let doc = func.doc.replace('\n', " ");
            output.push_str(&format!("| {usages} | {doc} |\n"));
        }
        output.push('\n');
    }

    std::fs::write(OUT_FILENAME, output).expect("failed to write to output file");

    println!("Docs were written to {OUT_FILENAME}. No need to check this file into git.")
}

const OUT_FILENAME: &str = "formula_docs_output.md";

fn main() {
    let mut output = String::new();

    for category in quadratic_core::formulas::functions::CATEGORIES {
        if !category.include_in_docs {
            continue;
        }

        output.push_str(&format!("## {}\n\n", category.name));
        output.push_str(category.docs);

        // Table header
        output.push_str("| **Function** | **Description** |\n");
        output.push_str("| ------------ | --------------- |\n");

        let all_functions = (category.get_functions)();
        let mut functions_that_need_their_own_sections = vec![];
        for func in &all_functions {
            let docs = func.docs_string();
            // Check for multiple paragraphs (one blank line)
            if docs.contains("\n\n") {
                functions_that_need_their_own_sections.push(func)
            } else {
                let usages = format!("`{}`", func.usages_string());
                let docs = docs.replace('\n', " ");
                output.push_str(&format!("| {usages} | {docs} |\n"));
            }
        }
        for func in functions_that_need_their_own_sections {
            output.push('\n');
            output.push_str(&format!("### {}\n\n", func.name));
            output.push_str(&format!("`{}`\n\n", func.usages_string()));
            output.push_str("Examples:\n\n");
            for example in func.examples {
                output.push_str(&format!("- `{example}`\n"));
            }
            output.push('\n');
            output.push_str(&func.docs_string().replace("\n#", "\n####"));
            output.push('\n');
        }

        output.push('\n');
    }

    std::fs::write(OUT_FILENAME, output).expect("failed to write to output file");

    println!("Docs were written to {OUT_FILENAME}. No need to check this file into git.")
}

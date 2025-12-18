# Formula Comparison Tools

This directory contains tools for comparing Quadratic's formula coverage against Excel.

## Files

- `quadratic-formulas.json` - List of all documented formulas in Quadratic (auto-generated)
- `excel-formulas.json` - List of Excel formulas to compare against
- `compare-formulas.js` - Node.js script to compare the two lists

## Generating the Quadratic Formulas List

To regenerate `quadratic-formulas.json` after adding or modifying formulas:

```bash
# From the quadratic-core directory
cargo run --bin export_formulas
```

This will:
1. Collect all formula names from documented categories
2. Sort them alphabetically (case-insensitive)
3. Write the output to `scripts/formulas/quadratic-formulas.json`

## Comparing Formulas

To see which Excel formulas are missing from Quadratic (and vice versa):

```bash
# From this directory (quadratic-core/scripts/formulas)
node compare-formulas.js
```

This will output:
- Total counts for both Excel and Quadratic formulas
- Functions missing from Quadratic (present in Excel but not in Quadratic)
- Functions unique to Quadratic (present in Quadratic but not in Excel)
- Overall Excel function coverage percentage

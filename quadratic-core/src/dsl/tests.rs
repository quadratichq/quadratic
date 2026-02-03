//! Integration tests for the DSL parser and compiler

use crate::controller::operations::operation::Operation;
use crate::dsl::ast::*;
use crate::dsl::{compile, parse};
use crate::grid::{CodeCellLanguage, SheetId};
use crate::values::CellValue;

#[test]
fn test_parse_and_compile_simple_cells() {
    let dsl = r#"
        cell A1: "Hello"
        cell B1: 42
        cell C1: true
    "#;

    let doc = parse(dsl).expect("Failed to parse");
    assert_eq!(doc.statements.len(), 3);

    let result = compile(doc, SheetId::TEST).expect("Failed to compile");

    // Should have 3 SetCellValues operations
    assert_eq!(result.operations.len(), 3);

    // Check first cell
    match &result.operations[0] {
        Operation::SetCellValues { sheet_pos, values } => {
            assert_eq!(sheet_pos.x, 0);
            assert_eq!(sheet_pos.y, 0);
            assert_eq!(
                values.get(0, 0),
                Some(&CellValue::Text("Hello".to_string()))
            );
        }
        _ => panic!("Expected SetCellValues operation"),
    }
}

#[test]
fn test_parse_and_compile_grid() {
    let dsl = r#"
        grid at A1 [
            ["Name", "Age", "City"]
            ["Alice", 30, "NYC"]
            ["Bob", 25, "LA"]
        ]
    "#;

    let doc = parse(dsl).expect("Failed to parse");
    let result = compile(doc, SheetId::TEST).expect("Failed to compile");

    // 3 rows x 3 cols = 9 cells
    assert_eq!(result.operations.len(), 9);
}

#[test]
fn test_parse_and_compile_table() {
    let dsl = r#"
        table "Employees" at C3 {
            headers: ["ID", "Name", "Salary"]
            rows: [
                [1, "John", 50000]
                [2, "Jane", 60000]
            ]
        }
    "#;

    let doc = parse(dsl).expect("Failed to parse");
    let result = compile(doc, SheetId::TEST).expect("Failed to compile");

    // 3 headers + 2 rows x 3 cols = 3 + 6 = 9 cells
    assert_eq!(result.operations.len(), 9);

    // Check that table info was recorded
    assert!(result.tables.contains_key("Employees"));
    let table_info = &result.tables["Employees"];
    assert_eq!(table_info.headers, vec!["ID", "Name", "Salary"]);
    assert_eq!(table_info.row_count, 2);
}

#[test]
fn test_parse_formula() {
    let dsl = r#"
        cell A1: 10
        cell A2: 20
        cell A3: =SUM(A1:A2)
    "#;

    let doc = parse(dsl).expect("Failed to parse");
    let result = compile(doc, SheetId::TEST).expect("Failed to compile");

    assert_eq!(result.operations.len(), 3);

    // Check the formula was compiled to SetComputeCode
    match &result.operations[2] {
        Operation::SetComputeCode { language, code, .. } => {
            assert_eq!(*language, CodeCellLanguage::Formula);
            assert_eq!(code, "=SUM(A1:A2)");
        }
        _ => panic!("Expected SetComputeCode operation for formula"),
    }
}

#[test]
fn test_parse_grid_with_orientation() {
    let dsl = r#"
        grid at A1 orientation:columns [
            ["Product", "Widget", "Gadget"]
            ["Price", 25, 45]
            ["Stock", 100, 50]
        ]
    "#;

    let doc = parse(dsl).expect("Failed to parse");

    match &doc.statements[0] {
        DslStatement::Grid(grid) => {
            assert_eq!(grid.orientation, Orientation::Columns);
            assert_eq!(grid.rows.len(), 3);
        }
        _ => panic!("Expected Grid statement"),
    }
}

#[test]
fn test_parse_code_cell() {
    let dsl = r#"
        python at A10 {
            import pandas as pd
            df = pd.DataFrame()
            df
        }
    "#;

    let doc = parse(dsl).expect("Failed to parse");
    let result = compile(doc, SheetId::TEST).expect("Failed to compile");

    assert_eq!(result.operations.len(), 1);

    match &result.operations[0] {
        Operation::SetComputeCode {
            sheet_pos,
            language,
            code,
            ..
        } => {
            assert_eq!(sheet_pos.x, 0);
            assert_eq!(sheet_pos.y, 9); // A10 = row 9 (0-indexed)
            assert_eq!(*language, CodeCellLanguage::Python);
            assert!(code.contains("pandas"));
        }
        _ => panic!("Expected SetComputeCode operation"),
    }
}

#[test]
fn test_javascript_code_cell() {
    let dsl = r#"
        javascript at B5 {
            const data = [1, 2, 3];
            data.map(x => x * 2);
        }
    "#;

    let doc = parse(dsl).expect("Failed to parse");
    let result = compile(doc, SheetId::TEST).expect("Failed to compile");

    match &result.operations[0] {
        Operation::SetComputeCode {
            sheet_pos,
            language,
            ..
        } => {
            assert_eq!(sheet_pos.x, 1); // B = column 1
            assert_eq!(sheet_pos.y, 4); // 5 = row 4 (0-indexed)
            assert_eq!(*language, CodeCellLanguage::Javascript);
        }
        _ => panic!("Expected SetComputeCode operation"),
    }
}

#[test]
fn test_cell_position_parsing() {
    assert_eq!(CellPosition::parse("A1"), Some(CellPosition::new(0, 0)));
    assert_eq!(CellPosition::parse("Z1"), Some(CellPosition::new(25, 0)));
    assert_eq!(CellPosition::parse("AA1"), Some(CellPosition::new(26, 0)));
    assert_eq!(CellPosition::parse("AB1"), Some(CellPosition::new(27, 0)));
    assert_eq!(CellPosition::parse("AZ1"), Some(CellPosition::new(51, 0)));
    assert_eq!(CellPosition::parse("BA1"), Some(CellPosition::new(52, 0)));

    // Case insensitive
    assert_eq!(CellPosition::parse("a1"), Some(CellPosition::new(0, 0)));
    assert_eq!(CellPosition::parse("aA1"), Some(CellPosition::new(26, 0)));
}

#[test]
fn test_cell_range_parsing() {
    // Cell range
    assert_eq!(
        CellRange::parse("A1:B10"),
        Some(CellRange::Range {
            start: CellPosition::new(0, 0),
            end: CellPosition::new(1, 9)
        })
    );

    // Column range
    assert_eq!(CellRange::parse("B:B"), Some(CellRange::Column { col: 1 }));
    assert_eq!(
        CellRange::parse("AA:AA"),
        Some(CellRange::Column { col: 26 })
    );

    // Row range
    assert_eq!(CellRange::parse("5:5"), Some(CellRange::Row { row: 4 }));
}

#[test]
fn test_comments_are_ignored() {
    let dsl = r#"
        # This is a comment
        cell A1: "Hello"
        # Another comment
        cell B1: 42
    "#;

    let doc = parse(dsl).expect("Failed to parse");
    assert_eq!(doc.statements.len(), 2);
}

#[test]
fn test_mixed_document() {
    let dsl = r#"
        # Dashboard title
        cell A1: "Sales Report"

        # Data grid
        grid at A3 [
            ["Product", "Q1", "Q2"]
            ["Widget", 100, 150]
        ]

        # Summary table
        table "Summary" at E1 {
            headers: ["Metric", "Value"]
            rows: [
                ["Total", 250]
            ]
        }
    "#;

    let doc = parse(dsl).expect("Failed to parse");
    assert_eq!(doc.statements.len(), 3);

    let result = compile(doc, SheetId::TEST).expect("Failed to compile");

    // 1 title cell + 6 grid cells + 4 table cells = 11
    assert_eq!(result.operations.len(), 11);

    // Check that Summary table was recorded
    assert!(result.tables.contains_key("Summary"));
}

#[test]
fn test_cell_with_format() {
    let dsl = r#"
        cell A1: "Title" {bold, align:center}
    "#;

    let doc = parse(dsl).expect("Failed to parse");

    // Verify the format was parsed correctly
    match &doc.statements[0] {
        crate::dsl::DslStatement::Cell(cell) => {
            assert!(cell.format.is_some(), "Format should be parsed");
            let fmt = cell.format.as_ref().unwrap();
            assert_eq!(fmt.bold, Some(true), "Bold should be true");
            assert!(fmt.align.is_some(), "Align should be set");
        }
        _ => panic!("Expected Cell statement"),
    }

    let result = compile(doc, SheetId::TEST).expect("Failed to compile");

    // Should have 2 operations: SetCellValues and SetCellFormatsA1
    assert_eq!(
        result.operations.len(),
        2,
        "Should have 2 operations: {:?}",
        result.operations
    );

    // Verify first operation is SetCellValues
    assert!(
        matches!(&result.operations[0], Operation::SetCellValues { .. }),
        "First operation should be SetCellValues"
    );

    // Verify second operation is SetCellFormatsA1
    match &result.operations[1] {
        Operation::SetCellFormatsA1 { sheet_id, .. } => {
            assert_eq!(*sheet_id, SheetId::TEST);
        }
        _ => panic!(
            "Expected SetCellFormatsA1 operation, got {:?}",
            result.operations[1]
        ),
    }
}

#[test]
fn test_format_statement() {
    let dsl = r#"
        format B:B {format:currency}
    "#;

    let doc = parse(dsl).expect("Failed to parse");
    let result = compile(doc, SheetId::TEST).expect("Failed to compile");

    assert_eq!(result.operations.len(), 1);

    match &result.operations[0] {
        Operation::SetCellFormatsA1 { sheet_id, .. } => {
            assert_eq!(*sheet_id, SheetId::TEST);
        }
        _ => panic!("Expected SetCellFormatsA1 operation"),
    }
}

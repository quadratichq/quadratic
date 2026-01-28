//! Conversion functions between runtime Formula/AST types and schema types.

use std::str::FromStr;

use anyhow::{Result, anyhow};

use crate::{
    Span, Spanned,
    a1::{CellRefRange, ColRange, RefRangeBounds, SheetCellRefRange, TableRef},
    formulas::ast::{AstNodeContents, Formula},
    grid::SheetId,
};

use super::current::{
    self, AstNodeContentsSchema, AstNodeSchema, CellRefRangeForAstSchema, ColRangeForAstSchema,
    FormulaSchema, SheetCellRefRangeSchema, SpannedStringSchema, TableRefForAstSchema,
};

use super::data_table::{export_cell_ref_coord, import_cell_ref_coord};

// ============================================================================
// Import (Schema -> Runtime)
// ============================================================================

/// Converts a FormulaSchema to a runtime Formula.
pub fn import_formula(schema: FormulaSchema) -> Result<Formula> {
    Ok(Formula {
        ast: import_ast_node(schema.ast)?,
    })
}

fn import_ast_node(schema: AstNodeSchema) -> Result<Spanned<AstNodeContents>> {
    Ok(Spanned {
        span: Span {
            start: schema.span.start,
            end: schema.span.end,
        },
        inner: import_ast_node_contents(schema.inner)?,
    })
}

fn import_ast_node_contents(schema: AstNodeContentsSchema) -> Result<AstNodeContents> {
    Ok(match schema {
        AstNodeContentsSchema::Empty => AstNodeContents::Empty,
        AstNodeContentsSchema::FunctionCall { func, args } => AstNodeContents::FunctionCall {
            func: Spanned {
                span: Span {
                    start: func.span.start,
                    end: func.span.end,
                },
                inner: func.inner,
            },
            args: args
                .into_iter()
                .map(import_ast_node)
                .collect::<Result<Vec<_>>>()?,
        },
        AstNodeContentsSchema::Paren(contents) => AstNodeContents::Paren(
            contents
                .into_iter()
                .map(import_ast_node)
                .collect::<Result<Vec<_>>>()?,
        ),
        AstNodeContentsSchema::Array(rows) => AstNodeContents::Array(
            rows.into_iter()
                .map(|row| {
                    row.into_iter()
                        .map(import_ast_node)
                        .collect::<Result<Vec<_>>>()
                })
                .collect::<Result<Vec<_>>>()?,
        ),
        AstNodeContentsSchema::CellRef(sheet_id, bounds) => {
            let sheet_id = sheet_id
                .map(|id| SheetId::from_str(&id.to_string()))
                .transpose()
                .map_err(|e| anyhow!("Invalid sheet ID: {}", e))?;
            let range = import_ref_range_bounds(bounds);
            AstNodeContents::CellRef(sheet_id, range)
        }
        AstNodeContentsSchema::RangeRef(range) => {
            AstNodeContents::RangeRef(import_sheet_cell_ref_range(range)?)
        }
        AstNodeContentsSchema::String(s) => AstNodeContents::String(s),
        AstNodeContentsSchema::Number(n) => AstNodeContents::Number(n),
        AstNodeContentsSchema::Bool(b) => AstNodeContents::Bool(b),
        AstNodeContentsSchema::Error(msg) => {
            AstNodeContents::Error(super::data_table::import_run_error_msg(msg)?)
        }
    })
}

fn import_ref_range_bounds(schema: current::RefRangeBoundsSchema) -> RefRangeBounds {
    use crate::a1::CellRefRangeEnd;

    RefRangeBounds {
        start: CellRefRangeEnd {
            col: import_cell_ref_coord(schema.start.col),
            row: import_cell_ref_coord(schema.start.row),
        },
        end: CellRefRangeEnd {
            col: import_cell_ref_coord(schema.end.col),
            row: import_cell_ref_coord(schema.end.row),
        },
    }
}

fn import_sheet_cell_ref_range(schema: SheetCellRefRangeSchema) -> Result<SheetCellRefRange> {
    let sheet_id = SheetId::from_str(&schema.sheet_id.to_string())
        .map_err(|e| anyhow!("Invalid sheet ID: {}", e))?;

    let cells = match schema.cells {
        CellRefRangeForAstSchema::Sheet { range } => CellRefRange::Sheet {
            range: import_ref_range_bounds(range),
        },
        CellRefRangeForAstSchema::Table { range } => CellRefRange::Table {
            range: import_table_ref(range),
        },
    };

    Ok(SheetCellRefRange {
        sheet_id,
        cells,
        explicit_sheet_name: schema.explicit_sheet_name,
    })
}

fn import_table_ref(schema: TableRefForAstSchema) -> TableRef {
    TableRef {
        table_name: schema.table_name,
        data: schema.data,
        headers: schema.headers,
        totals: schema.totals,
        col_range: match schema.col_range {
            ColRangeForAstSchema::All => ColRange::All,
            ColRangeForAstSchema::Col(col) => ColRange::Col(col),
            ColRangeForAstSchema::ColRange(c1, c2) => ColRange::ColRange(c1, c2),
            ColRangeForAstSchema::ColToEnd(col) => ColRange::ColToEnd(col),
        },
    }
}

// ============================================================================
// Export (Runtime -> Schema)
// ============================================================================

/// Converts a runtime Formula to a FormulaSchema.
pub fn export_formula(formula: Formula) -> FormulaSchema {
    FormulaSchema {
        ast: export_ast_node(formula.ast),
    }
}

fn export_ast_node(node: Spanned<AstNodeContents>) -> AstNodeSchema {
    AstNodeSchema {
        span: current::SpanSchema {
            start: node.span.start,
            end: node.span.end,
        },
        inner: export_ast_node_contents(node.inner),
    }
}

fn export_ast_node_contents(contents: AstNodeContents) -> AstNodeContentsSchema {
    match contents {
        AstNodeContents::Empty => AstNodeContentsSchema::Empty,
        AstNodeContents::FunctionCall { func, args } => AstNodeContentsSchema::FunctionCall {
            func: SpannedStringSchema {
                span: current::SpanSchema {
                    start: func.span.start,
                    end: func.span.end,
                },
                inner: func.inner,
            },
            args: args.into_iter().map(export_ast_node).collect(),
        },
        AstNodeContents::Paren(contents) => {
            AstNodeContentsSchema::Paren(contents.into_iter().map(export_ast_node).collect())
        }
        AstNodeContents::Array(rows) => AstNodeContentsSchema::Array(
            rows.into_iter()
                .map(|row| row.into_iter().map(export_ast_node).collect())
                .collect(),
        ),
        AstNodeContents::CellRef(sheet_id, bounds) => AstNodeContentsSchema::CellRef(
            sheet_id.map(|id| current::IdSchema::from(id.to_string())),
            export_ref_range_bounds(bounds),
        ),
        AstNodeContents::RangeRef(range) => {
            AstNodeContentsSchema::RangeRef(export_sheet_cell_ref_range(range))
        }
        AstNodeContents::String(s) => AstNodeContentsSchema::String(s),
        AstNodeContents::Number(n) => AstNodeContentsSchema::Number(n),
        AstNodeContents::Bool(b) => AstNodeContentsSchema::Bool(b),
        AstNodeContents::Error(msg) => {
            AstNodeContentsSchema::Error(super::data_table::export_run_error_msg(msg))
        }
    }
}

fn export_ref_range_bounds(bounds: RefRangeBounds) -> current::RefRangeBoundsSchema {
    use super::data_table::export_cell_ref_coord;

    current::RefRangeBoundsSchema {
        start: current::CellRefRangeEndSchema {
            col: export_cell_ref_coord(bounds.start.col),
            row: export_cell_ref_coord(bounds.start.row),
        },
        end: current::CellRefRangeEndSchema {
            col: export_cell_ref_coord(bounds.end.col),
            row: export_cell_ref_coord(bounds.end.row),
        },
    }
}

fn export_sheet_cell_ref_range(range: SheetCellRefRange) -> SheetCellRefRangeSchema {
    SheetCellRefRangeSchema {
        sheet_id: current::IdSchema::from(range.sheet_id.to_string()),
        cells: match range.cells {
            CellRefRange::Sheet { range } => CellRefRangeForAstSchema::Sheet {
                range: export_ref_range_bounds(range),
            },
            CellRefRange::Table { range } => CellRefRangeForAstSchema::Table {
                range: export_table_ref(range),
            },
        },
        explicit_sheet_name: range.explicit_sheet_name,
    }
}

fn export_table_ref(range: TableRef) -> TableRefForAstSchema {
    TableRefForAstSchema {
        table_name: range.table_name,
        data: range.data,
        headers: range.headers,
        totals: range.totals,
        col_range: match range.col_range {
            ColRange::All => ColRangeForAstSchema::All,
            ColRange::Col(col) => ColRangeForAstSchema::Col(col),
            ColRange::ColRange(c1, c2) => ColRangeForAstSchema::ColRange(c1, c2),
            ColRange::ColToEnd(col) => ColRangeForAstSchema::ColToEnd(col),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::controller::GridController;
    use crate::formulas::parse_formula;

    #[test]
    fn test_formula_roundtrip() {
        let gc = GridController::new();
        let pos = gc.grid().origin_in_first_sheet();
        let ctx = gc.a1_context();

        let formulas = vec![
            "=42",
            "=A1",
            "=A1:B2",
            "=SUM(A1:A10)",
            "=IF(A1 > 10, TRUE, FALSE)",
            "=(1 + 2) * 3",
            "={1, 2; 3, 4}",
            r#"="hello""#,
            "=TRUE",
            "=-5",
        ];

        for formula_str in formulas {
            let parsed = parse_formula(formula_str, ctx, pos).expect("Failed to parse");
            let schema = export_formula(parsed.clone());
            let imported = import_formula(schema).expect("Failed to import");

            assert_eq!(parsed, imported, "Roundtrip failed for: {}", formula_str);
        }
    }
}

//! Compiler that converts DSL AST to Operations

use std::collections::HashMap;

use crate::cell_values::CellValues;
use crate::controller::operations::operation::Operation;
use crate::dsl::ast::*;
use crate::dsl::error::DslResult;
use crate::grid::formats::SheetFormatUpdates;
use crate::grid::{CodeCellLanguage, SheetId};
use crate::values::CellValue;
use crate::{Pos, SheetPos};

/// Information about a named table for structured references
#[derive(Debug, Clone)]
pub struct TableInfo {
    pub name: String,
    pub position: CellPosition,
    pub headers: Vec<String>,
    pub row_count: usize,
    pub orientation: Orientation,
}

/// Result of DSL compilation
#[derive(Debug, Clone)]
pub struct CompileResult {
    /// Operations to execute
    pub operations: Vec<Operation>,
    /// Named tables for reference
    pub tables: HashMap<String, TableInfo>,
}

/// Compiler state
pub struct Compiler {
    /// The sheet ID to compile to
    sheet_id: SheetId,
    /// Named tables for structured references
    tables: HashMap<String, TableInfo>,
    /// Accumulated operations
    operations: Vec<Operation>,
}

impl Compiler {
    pub fn new(sheet_id: SheetId) -> Self {
        Self {
            sheet_id,
            tables: HashMap::new(),
            operations: Vec::new(),
        }
    }

    /// Compile a DSL document to operations
    pub fn compile(mut self, doc: DslDocument) -> DslResult<CompileResult> {
        // First pass: collect table info for structured references
        for stmt in &doc.statements {
            if let DslStatement::Table(table) = stmt {
                self.tables.insert(
                    table.name.clone(),
                    TableInfo {
                        name: table.name.clone(),
                        position: table.position.clone(),
                        headers: table.headers.clone(),
                        row_count: table.rows.len(),
                        orientation: table.orientation,
                    },
                );
            }
        }

        // Second pass: compile statements to operations
        for stmt in doc.statements {
            self.compile_statement(stmt)?;
        }

        Ok(CompileResult {
            operations: self.operations,
            tables: self.tables,
        })
    }

    fn compile_statement(&mut self, stmt: DslStatement) -> DslResult<()> {
        match stmt {
            DslStatement::Cell(cell) => self.compile_cell(cell),
            DslStatement::Grid(grid_stmt) => self.compile_grid(grid_stmt),
            DslStatement::Table(table) => self.compile_table(table),
            DslStatement::CodeCell(code) => self.compile_code_cell(code),
            DslStatement::Format(fmt) => self.compile_format(fmt),
        }
    }

    fn compile_cell(&mut self, cell: CellStatement) -> DslResult<()> {
        let sheet_pos = SheetPos {
            x: cell.position.col,
            y: cell.position.row,
            sheet_id: self.sheet_id,
        };

        // Check if this is a formula - formulas need special handling
        if let DslValue::Formula(formula) = &cell.value {
            // For formulas, we use SetComputeCode with Formula language
            self.operations.push(Operation::SetComputeCode {
                sheet_pos,
                language: CodeCellLanguage::Formula,
                code: formula.clone(),
                template: None,
            });
        } else {
            let value = self.dsl_value_to_cell_value(&cell.value)?;
            self.operations.push(Operation::SetCellValues {
                sheet_pos,
                values: CellValues::from(value),
            });
        }

        // Apply format if present
        if let Some(fmt) = cell.format {
            self.compile_cell_format(cell.position, &fmt)?;
        }

        Ok(())
    }

    fn compile_grid(&mut self, grid_stmt: GridStatement) -> DslResult<()> {
        let start_col = grid_stmt.position.col;
        let start_row = grid_stmt.position.row;

        match grid_stmt.orientation {
            Orientation::Rows => {
                for (row_idx, row) in grid_stmt.rows.iter().enumerate() {
                    for (col_idx, value) in row.values.iter().enumerate() {
                        let pos = CellPosition::new(
                            start_col + col_idx as i64,
                            start_row + row_idx as i64,
                        );
                        self.compile_single_value(pos, value)?;
                    }

                    // Apply row format if present
                    if let Some(ref fmt) = row.format {
                        for col_idx in 0..row.values.len() {
                            let pos = CellPosition::new(
                                start_col + col_idx as i64,
                                start_row + row_idx as i64,
                            );
                            self.compile_cell_format(pos, fmt)?;
                        }
                    }
                }
            }
            Orientation::Columns => {
                for (col_idx, row) in grid_stmt.rows.iter().enumerate() {
                    for (row_idx, value) in row.values.iter().enumerate() {
                        let pos = CellPosition::new(
                            start_col + col_idx as i64,
                            start_row + row_idx as i64,
                        );
                        self.compile_single_value(pos, value)?;
                    }
                }
            }
        }

        Ok(())
    }

    fn compile_table(&mut self, table: TableStatement) -> DslResult<()> {
        let start_col = table.position.col;
        let start_row = table.position.row;

        match table.orientation {
            Orientation::Rows => {
                // Write headers
                for (col_idx, header) in table.headers.iter().enumerate() {
                    let pos = CellPosition::new(start_col + col_idx as i64, start_row);
                    self.compile_single_value(pos, &DslValue::Text(header.clone()))?;

                    // Apply header format
                    if let Some(ref fmt) = table.formats.headers {
                        self.compile_cell_format(pos, fmt)?;
                    }
                }

                // Write data rows
                for (row_idx, row) in table.rows.iter().enumerate() {
                    for (col_idx, value) in row.iter().enumerate() {
                        let pos = CellPosition::new(
                            start_col + col_idx as i64,
                            start_row + 1 + row_idx as i64,
                        );
                        self.compile_single_value(pos, value)?;

                        // Apply column format if defined
                        if col_idx < table.headers.len() {
                            let header_name = &table.headers[col_idx];
                            if let Some((_, fmt)) = table
                                .formats
                                .columns
                                .iter()
                                .find(|(name, _)| name == header_name)
                            {
                                self.compile_cell_format(pos, fmt)?;
                            }
                        }
                    }
                }
            }
            Orientation::Columns => {
                // Headers on left, data going right
                for (row_idx, header) in table.headers.iter().enumerate() {
                    let pos = CellPosition::new(start_col, start_row + row_idx as i64);
                    self.compile_single_value(pos, &DslValue::Text(header.clone()))?;

                    if let Some(ref fmt) = table.formats.headers {
                        self.compile_cell_format(pos, fmt)?;
                    }
                }

                // Write data columns
                for (col_idx, row) in table.rows.iter().enumerate() {
                    for (row_idx, value) in row.iter().enumerate() {
                        let pos = CellPosition::new(
                            start_col + 1 + col_idx as i64,
                            start_row + row_idx as i64,
                        );
                        self.compile_single_value(pos, value)?;
                    }
                }
            }
        }

        Ok(())
    }

    fn compile_code_cell(&mut self, code: CodeCellStatement) -> DslResult<()> {
        let sheet_pos = SheetPos {
            x: code.position.col,
            y: code.position.row,
            sheet_id: self.sheet_id,
        };

        let language = match code.language {
            CodeLanguage::Python => CodeCellLanguage::Python,
            CodeLanguage::Javascript => CodeCellLanguage::Javascript,
        };

        self.operations.push(Operation::SetComputeCode {
            sheet_pos,
            language,
            code: code.code,
            template: None,
        });

        Ok(())
    }

    fn compile_format(&mut self, fmt: FormatStatement) -> DslResult<()> {
        use crate::SheetRect;
        use crate::a1::A1Selection;

        // Build format updates for the range
        let format_update = self.dsl_format_to_format_update(&fmt.format);

        let selection = match fmt.range {
            CellRange::Range { start, end } => {
                let sheet_rect = SheetRect::new_pos_span(
                    Pos {
                        x: start.col,
                        y: start.row,
                    },
                    Pos {
                        x: end.col,
                        y: end.row,
                    },
                    self.sheet_id,
                );
                A1Selection::from_rect(sheet_rect)
            }
            CellRange::Column { col } => A1Selection::cols(self.sheet_id, col, col),
            CellRange::Row { row } => A1Selection::rows(self.sheet_id, row, row),
        };

        let formats = SheetFormatUpdates::from_selection(&selection, format_update);
        self.operations.push(Operation::SetCellFormatsA1 {
            sheet_id: self.sheet_id,
            formats,
        });

        Ok(())
    }

    /// Compile a single value at a position
    fn compile_single_value(&mut self, pos: CellPosition, value: &DslValue) -> DslResult<()> {
        let sheet_pos = SheetPos {
            x: pos.col,
            y: pos.row,
            sheet_id: self.sheet_id,
        };

        if let DslValue::Formula(formula) = value {
            self.operations.push(Operation::SetComputeCode {
                sheet_pos,
                language: CodeCellLanguage::Formula,
                code: formula.clone(),
                template: None,
            });
        } else {
            let cell_value = self.dsl_value_to_cell_value(value)?;
            self.operations.push(Operation::SetCellValues {
                sheet_pos,
                values: CellValues::from(cell_value),
            });
        }

        Ok(())
    }

    /// Compile format for a single cell
    fn compile_cell_format(&mut self, pos: CellPosition, fmt: &DslFormat) -> DslResult<()> {
        use crate::a1::A1Selection;

        let format_update = self.dsl_format_to_format_update(fmt);
        let selection = A1Selection::from_pos(
            Pos {
                x: pos.col,
                y: pos.row,
            },
            self.sheet_id,
        );

        let formats = SheetFormatUpdates::from_selection(&selection, format_update);
        self.operations.push(Operation::SetCellFormatsA1 {
            sheet_id: self.sheet_id,
            formats,
        });

        Ok(())
    }

    fn dsl_value_to_cell_value(&self, value: &DslValue) -> DslResult<CellValue> {
        match value {
            DslValue::Blank => Ok(CellValue::Blank),
            DslValue::Text(s) => Ok(CellValue::Text(s.clone())),
            DslValue::Number(n) => Ok(CellValue::Number(*n)),
            DslValue::Boolean(b) => Ok(CellValue::Logical(*b)),
            DslValue::Formula(_) => {
                // Formulas should be handled separately via SetComputeCode
                Ok(CellValue::Blank)
            }
        }
    }

    fn dsl_format_to_format_update(&self, fmt: &DslFormat) -> crate::grid::formats::FormatUpdate {
        use crate::grid::formats::FormatUpdate;
        use crate::grid::{CellAlign, CellVerticalAlign, NumericFormat, NumericFormatKind};

        let mut update = FormatUpdate::default();

        if let Some(bold) = fmt.bold {
            update.bold = Some(Some(bold));
        }
        if let Some(italic) = fmt.italic {
            update.italic = Some(Some(italic));
        }
        if let Some(underline) = fmt.underline {
            update.underline = Some(Some(underline));
        }
        if let Some(strikethrough) = fmt.strikethrough {
            update.strike_through = Some(Some(strikethrough));
        }
        if let Some(size) = fmt.font_size {
            update.font_size = Some(Some(size as i16));
        }
        if let Some(ref color) = fmt.color {
            update.text_color = Some(Some(color.clone()));
        }
        if let Some(ref bg) = fmt.background {
            update.fill_color = Some(Some(bg.clone()));
        }
        if let Some(ref align) = fmt.align {
            let align_value = match align {
                HorizontalAlign::Left => CellAlign::Left,
                HorizontalAlign::Center => CellAlign::Center,
                HorizontalAlign::Right => CellAlign::Right,
            };
            update.align = Some(Some(align_value));
        }
        if let Some(ref valign) = fmt.valign {
            let valign_value = match valign {
                VerticalAlign::Top => CellVerticalAlign::Top,
                VerticalAlign::Middle => CellVerticalAlign::Middle,
                VerticalAlign::Bottom => CellVerticalAlign::Bottom,
            };
            update.vertical_align = Some(Some(valign_value));
        }
        if let Some(ref num_fmt) = fmt.number_format {
            match num_fmt {
                NumberFormat::Currency => {
                    update.numeric_format = Some(Some(NumericFormat {
                        kind: NumericFormatKind::Currency,
                        symbol: Some("$".to_string()),
                    }));
                }
                NumberFormat::Percent => {
                    update.numeric_format = Some(Some(NumericFormat {
                        kind: NumericFormatKind::Percentage,
                        symbol: None,
                    }));
                }
                NumberFormat::Number => {
                    update.numeric_format = Some(Some(NumericFormat {
                        kind: NumericFormatKind::Number,
                        symbol: None,
                    }));
                }
                NumberFormat::Date => {
                    update.date_time = Some(Some("%Y-%m-%d".to_string()));
                }
                NumberFormat::DateTime => {
                    update.date_time = Some(Some("%Y-%m-%d %H:%M:%S".to_string()));
                }
            };
        }
        if let Some(decimals) = fmt.decimals {
            update.numeric_decimals = Some(Some(decimals as i16));
        }

        update
    }
}

/// Convert a 0-based column index to Excel-style letter (A, B, ..., Z, AA, AB, ...)
#[allow(dead_code)]
fn col_to_letter(col: i64) -> String {
    let mut result = String::new();
    let mut n = col + 1; // Convert to 1-based

    while n > 0 {
        n -= 1;
        result.insert(0, (b'A' + (n % 26) as u8) as char);
        n /= 26;
    }

    result
}

/// Compile a DSL document to operations for a given sheet
pub fn compile(doc: DslDocument, sheet_id: SheetId) -> DslResult<CompileResult> {
    let compiler = Compiler::new(sheet_id);
    compiler.compile(doc)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dsl::parse;
    use crate::grid::SheetId;

    #[test]
    fn test_compile_simple_cell() {
        let doc = parse("cell A1: \"Hello\"").unwrap();
        let result = compile(doc, SheetId::TEST).unwrap();

        assert_eq!(result.operations.len(), 1);
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
    fn test_compile_formula() {
        let doc = parse("cell A1: =SUM(B1:B10)").unwrap();
        let result = compile(doc, SheetId::TEST).unwrap();

        assert_eq!(result.operations.len(), 1);
        match &result.operations[0] {
            Operation::SetComputeCode {
                sheet_pos,
                language,
                code,
                ..
            } => {
                assert_eq!(sheet_pos.x, 0);
                assert_eq!(sheet_pos.y, 0);
                assert_eq!(*language, CodeCellLanguage::Formula);
                assert_eq!(code, "=SUM(B1:B10)");
            }
            _ => panic!("Expected SetComputeCode operation"),
        }
    }

    #[test]
    fn test_compile_code_cell() {
        let doc = parse(
            r#"python at A1 {
            import pandas as pd
            df = pd.DataFrame()
        }"#,
        )
        .unwrap();
        let result = compile(doc, SheetId::TEST).unwrap();

        assert_eq!(result.operations.len(), 1);
        match &result.operations[0] {
            Operation::SetComputeCode {
                sheet_pos,
                language,
                code,
                ..
            } => {
                assert_eq!(sheet_pos.x, 0);
                assert_eq!(sheet_pos.y, 0);
                assert_eq!(*language, CodeCellLanguage::Python);
                assert!(code.contains("pandas"));
            }
            _ => panic!("Expected SetComputeCode operation"),
        }
    }

    #[test]
    fn test_compile_grid() {
        let doc = parse(
            r#"grid at A1 [
            ["Product", "Price"]
            ["Widget", 100]
        ]"#,
        )
        .unwrap();
        let result = compile(doc, SheetId::TEST).unwrap();

        // 4 cells = 4 operations
        assert_eq!(result.operations.len(), 4);
    }

    #[test]
    fn test_col_to_letter() {
        assert_eq!(col_to_letter(0), "A");
        assert_eq!(col_to_letter(1), "B");
        assert_eq!(col_to_letter(25), "Z");
        assert_eq!(col_to_letter(26), "AA");
        assert_eq!(col_to_letter(27), "AB");
        assert_eq!(col_to_letter(51), "AZ");
        assert_eq!(col_to_letter(52), "BA");
    }
}

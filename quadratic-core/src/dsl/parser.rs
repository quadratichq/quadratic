//! Parser for the Quadratic DSL

use rust_decimal::Decimal;
use std::str::FromStr;

use crate::dsl::ast::*;
use crate::dsl::error::{DslError, DslResult};
use crate::dsl::lexer::{Lexer, Token};

/// Parse DSL text into a document AST
pub fn parse(input: &str) -> DslResult<DslDocument> {
    let mut parser = Parser::new(input);
    parser.parse_document()
}

/// Parser for the DSL
struct Parser {
    lexer: Lexer,
    tokens: Vec<Token>,
    pos: usize,
}

impl Parser {
    fn new(input: &str) -> Self {
        Self {
            lexer: Lexer::new(input),
            tokens: Vec::new(),
            pos: 0,
        }
    }

    fn parse_document(&mut self) -> DslResult<DslDocument> {
        // First, tokenize the input (but we'll re-lex for code blocks)
        self.tokens = self.lexer.tokenize()?;
        self.pos = 0;

        let mut statements = Vec::new();

        while !self.is_at_end() {
            self.skip_newlines();
            if self.is_at_end() {
                break;
            }

            let stmt = self.parse_statement()?;
            statements.push(stmt);
        }

        Ok(DslDocument { statements })
    }

    fn parse_statement(&mut self) -> DslResult<DslStatement> {
        match self.current() {
            Token::Cell => self.parse_cell_statement(),
            Token::Grid => self.parse_grid_statement(),
            Token::Table => self.parse_table_statement(),
            Token::Python => self.parse_code_cell_statement(CodeLanguage::Python),
            Token::Javascript => self.parse_code_cell_statement(CodeLanguage::Javascript),
            Token::Format => self.parse_format_statement(),
            _ => Err(DslError::parser(format!(
                "Expected statement (cell, grid, table, python, javascript, format), got {:?}",
                self.current()
            ))),
        }
    }

    /// Parse: `cell A1: value {format}`
    fn parse_cell_statement(&mut self) -> DslResult<DslStatement> {
        self.expect(Token::Cell)?;

        // Parse position (e.g., A1)
        let pos_str = self.expect_identifier()?;
        let position = CellPosition::parse(&pos_str)
            .ok_or_else(|| DslError::parser(format!("Invalid cell position: {}", pos_str)))?;

        self.expect(Token::Colon)?;

        // Parse value
        let value = self.parse_value()?;

        // Parse optional format
        let format = if self.check(&Token::LeftBrace) {
            Some(self.parse_format_block()?)
        } else {
            None
        };

        Ok(DslStatement::Cell(CellStatement {
            position,
            value,
            format,
        }))
    }

    /// Parse: `grid at A1 [orientation:rows] [rows...]`
    fn parse_grid_statement(&mut self) -> DslResult<DslStatement> {
        self.expect(Token::Grid)?;
        self.expect(Token::At)?;

        // Parse position
        let pos_str = self.expect_identifier()?;
        let position = CellPosition::parse(&pos_str)
            .ok_or_else(|| DslError::parser(format!("Invalid cell position: {}", pos_str)))?;

        // Parse optional orientation
        let orientation = if self.check(&Token::Orientation) {
            self.advance();
            self.expect(Token::Colon)?;
            self.parse_orientation()?
        } else {
            Orientation::default()
        };

        // Parse rows array
        self.expect(Token::LeftBracket)?;
        self.skip_newlines();

        let mut rows = Vec::new();
        while !self.check(&Token::RightBracket) && !self.is_at_end() {
            let row = self.parse_grid_row()?;
            rows.push(row);
            self.skip_newlines();
        }

        self.expect(Token::RightBracket)?;

        Ok(DslStatement::Grid(GridStatement {
            position,
            orientation,
            rows,
        }))
    }

    /// Parse a single grid row: `[value, value, ...] {format}`
    fn parse_grid_row(&mut self) -> DslResult<GridRow> {
        self.expect(Token::LeftBracket)?;
        self.skip_newlines();

        let mut values = Vec::new();
        while !self.check(&Token::RightBracket) && !self.is_at_end() {
            let value = self.parse_value()?;
            values.push(value);

            if self.check(&Token::Comma) {
                self.advance();
                self.skip_newlines();
            } else {
                break;
            }
        }

        self.expect(Token::RightBracket)?;

        // Parse optional row format
        let format = if self.check(&Token::LeftBrace) {
            Some(self.parse_format_block()?)
        } else {
            None
        };

        Ok(GridRow { values, format })
    }

    /// Parse: `table "name" at A1 {...}`
    fn parse_table_statement(&mut self) -> DslResult<DslStatement> {
        self.expect(Token::Table)?;

        // Parse table name
        let name = self.expect_string()?;

        self.expect(Token::At)?;

        // Parse position
        let pos_str = self.expect_identifier()?;
        let position = CellPosition::parse(&pos_str)
            .ok_or_else(|| DslError::parser(format!("Invalid cell position: {}", pos_str)))?;

        // Parse optional orientation
        let orientation = if self.check(&Token::Orientation) {
            self.advance();
            self.expect(Token::Colon)?;
            self.parse_orientation()?
        } else {
            Orientation::default()
        };

        self.expect(Token::LeftBrace)?;
        self.skip_newlines();

        // Parse table body
        let mut headers = Vec::new();
        let mut rows = Vec::new();
        let mut formats = TableFormats::default();

        while !self.check(&Token::RightBrace) && !self.is_at_end() {
            let key = self.expect_identifier_or_keyword()?;
            self.expect(Token::Colon)?;

            match key.to_lowercase().as_str() {
                "headers" => {
                    headers = self.parse_string_array()?;
                }
                "rows" => {
                    rows = self.parse_rows_array()?;
                }
                "formats" => {
                    formats = self.parse_table_formats()?;
                }
                _ => {
                    return Err(DslError::parser(format!("Unknown table property: {}", key)));
                }
            }

            self.skip_newlines();
        }

        self.expect(Token::RightBrace)?;

        Ok(DslStatement::Table(TableStatement {
            name,
            position,
            orientation,
            headers,
            rows,
            formats,
        }))
    }

    /// Parse: `python at A1 { code }`
    fn parse_code_cell_statement(&mut self, language: CodeLanguage) -> DslResult<DslStatement> {
        // Consume the language keyword
        self.advance();

        self.expect(Token::At)?;

        // Parse position
        let pos_str = self.expect_identifier()?;
        let position = CellPosition::parse(&pos_str)
            .ok_or_else(|| DslError::parser(format!("Invalid cell position: {}", pos_str)))?;

        // For code blocks, we need to re-lex from the current position to get the code content
        // This is a simplification - in a real implementation we'd track positions more carefully
        self.expect(Token::LeftBrace)?;

        // Collect all tokens until matching RightBrace
        let code = self.collect_code_block()?;

        Ok(DslStatement::CodeCell(CodeCellStatement {
            position,
            language,
            code,
        }))
    }

    /// Collect tokens inside a code block and reconstruct the code
    fn collect_code_block(&mut self) -> DslResult<String> {
        let mut code_parts = Vec::new();
        let mut brace_depth = 1;

        self.skip_newlines();

        while !self.is_at_end() && brace_depth > 0 {
            match self.current() {
                Token::LeftBrace => {
                    brace_depth += 1;
                    code_parts.push("{".to_string());
                    self.advance();
                }
                Token::RightBrace => {
                    brace_depth -= 1;
                    if brace_depth > 0 {
                        code_parts.push("}".to_string());
                    }
                    self.advance();
                }
                Token::Newline => {
                    code_parts.push("\n".to_string());
                    self.advance();
                }
                Token::String(s) => {
                    code_parts.push(format!("\"{}\"", s));
                    self.advance();
                }
                Token::Number(n) => {
                    code_parts.push(n.clone());
                    self.advance();
                }
                Token::Identifier(s) => {
                    code_parts.push(s.clone());
                    self.advance();
                }
                Token::Colon => {
                    code_parts.push(":".to_string());
                    self.advance();
                }
                Token::Comma => {
                    code_parts.push(",".to_string());
                    self.advance();
                }
                Token::LeftBracket => {
                    code_parts.push("[".to_string());
                    self.advance();
                }
                Token::RightBracket => {
                    code_parts.push("]".to_string());
                    self.advance();
                }
                Token::LeftParen => {
                    code_parts.push("(".to_string());
                    self.advance();
                }
                Token::RightParen => {
                    code_parts.push(")".to_string());
                    self.advance();
                }
                _ => {
                    // Skip other tokens
                    self.advance();
                }
            }
        }

        if brace_depth > 0 {
            return Err(DslError::parser("Unterminated code block"));
        }

        Ok(code_parts.join(" ").trim().to_string())
    }

    /// Parse: `format A1:B10 {format}`
    fn parse_format_statement(&mut self) -> DslResult<DslStatement> {
        self.expect(Token::Format)?;

        // Parse range
        let range_str = self.expect_identifier()?;

        // Check if next token is a colon (part of range syntax)
        let full_range = if self.check(&Token::Colon) {
            self.advance();
            let end = self.expect_identifier()?;
            format!("{}:{}", range_str, end)
        } else {
            range_str
        };

        let range = CellRange::parse(&full_range)
            .ok_or_else(|| DslError::parser(format!("Invalid range: {}", full_range)))?;

        let format = self.parse_format_block()?;

        Ok(DslStatement::Format(FormatStatement { range, format }))
    }

    /// Parse a format block: `{bold, color:#fff, ...}`
    fn parse_format_block(&mut self) -> DslResult<DslFormat> {
        self.expect(Token::LeftBrace)?;
        self.skip_newlines();

        let mut format = DslFormat::default();

        while !self.check(&Token::RightBrace) && !self.is_at_end() {
            let prop = self.expect_identifier_or_keyword()?;

            match prop.to_lowercase().as_str() {
                // Boolean flags
                "bold" => format.bold = Some(true),
                "italic" => format.italic = Some(true),
                "underline" => format.underline = Some(true),
                "strikethrough" => format.strikethrough = Some(true),
                "border" => format.border = Some(true),
                "border-top" => format.border_top = Some(true),
                "border-bottom" => format.border_bottom = Some(true),
                "border-left" => format.border_left = Some(true),
                "border-right" => format.border_right = Some(true),

                // Value properties (require colon)
                "size" => {
                    self.expect(Token::Colon)?;
                    let n = self.expect_number()?;
                    format.font_size = Some(n.parse().unwrap_or(12));
                }
                "color" => {
                    self.expect(Token::Colon)?;
                    format.color = Some(self.expect_color_or_identifier()?);
                }
                "bg" => {
                    self.expect(Token::Colon)?;
                    format.background = Some(self.expect_color_or_identifier()?);
                }
                "align" => {
                    self.expect(Token::Colon)?;
                    format.align = Some(self.parse_horizontal_align()?);
                }
                "valign" => {
                    self.expect(Token::Colon)?;
                    format.valign = Some(self.parse_vertical_align()?);
                }
                "format" => {
                    self.expect(Token::Colon)?;
                    format.number_format = Some(self.parse_number_format()?);
                }
                "decimals" => {
                    self.expect(Token::Colon)?;
                    let n = self.expect_number()?;
                    format.decimals = Some(n.parse().unwrap_or(2));
                }
                "width" => {
                    self.expect(Token::Colon)?;
                    let n = self.expect_number()?;
                    format.width = Some(n.parse().unwrap_or(100));
                }
                "height" => {
                    self.expect(Token::Colon)?;
                    let n = self.expect_number()?;
                    format.height = Some(n.parse().unwrap_or(20));
                }

                _ => {
                    return Err(DslError::parser(format!(
                        "Unknown format property: {}",
                        prop
                    )));
                }
            }

            // Skip comma if present
            if self.check(&Token::Comma) {
                self.advance();
            }
            self.skip_newlines();
        }

        self.expect(Token::RightBrace)?;

        Ok(format)
    }

    fn parse_value(&mut self) -> DslResult<DslValue> {
        match self.current() {
            Token::String(s) => {
                let value = s.clone();
                self.advance();
                Ok(DslValue::Text(value))
            }
            Token::Number(n) => {
                let value = n.clone();
                self.advance();
                Ok(DslValue::Number(Decimal::from_str(&value).map_err(
                    |_| DslError::parser(format!("Invalid number: {}", value)),
                )?))
            }
            Token::Identifier(s) if s == "=" => {
                // Formula: starts with = and continues until a delimiter
                self.advance(); // consume the "="
                let formula = self.collect_formula()?;
                Ok(DslValue::Formula(format!("={}", formula)))
            }
            Token::Identifier(s) => {
                let value = s.clone();
                let lower = value.to_lowercase();
                self.advance();
                match lower.as_str() {
                    "true" => Ok(DslValue::Boolean(true)),
                    "false" => Ok(DslValue::Boolean(false)),
                    "null" | "blank" | "" => Ok(DslValue::Blank),
                    _ => Ok(DslValue::Text(value)),
                }
            }
            _ => Err(DslError::parser(format!(
                "Expected value, got {:?}",
                self.current()
            ))),
        }
    }

    /// Collect tokens for a formula until we hit a delimiter
    fn collect_formula(&mut self) -> DslResult<String> {
        let mut parts = Vec::new();
        let mut paren_depth = 0;

        while !self.is_at_end() {
            // End of formula on these tokens (when not in parentheses)
            if paren_depth == 0 {
                match self.current() {
                    Token::Comma | Token::RightBracket | Token::RightBrace | Token::Newline => {
                        break;
                    }
                    _ => {}
                }
            }

            match self.current() {
                Token::LeftParen => {
                    paren_depth += 1;
                    parts.push("(".to_string());
                    self.advance();
                }
                Token::RightParen => {
                    paren_depth -= 1;
                    parts.push(")".to_string());
                    self.advance();
                }
                Token::Identifier(s) => {
                    parts.push(s.clone());
                    self.advance();
                }
                Token::Number(n) => {
                    parts.push(n.clone());
                    self.advance();
                }
                Token::String(s) => {
                    parts.push(format!("\"{}\"", s));
                    self.advance();
                }
                Token::Colon => {
                    parts.push(":".to_string());
                    self.advance();
                }
                Token::Comma => {
                    parts.push(",".to_string());
                    self.advance();
                }
                _ => {
                    // Unknown token in formula, stop
                    break;
                }
            }
        }

        Ok(parts.join(""))
    }

    fn parse_orientation(&mut self) -> DslResult<Orientation> {
        match self.current() {
            Token::Rows => {
                self.advance();
                Ok(Orientation::Rows)
            }
            Token::Columns => {
                self.advance();
                Ok(Orientation::Columns)
            }
            Token::Identifier(s) => {
                let value = s.clone();
                let lower = value.to_lowercase();
                self.advance();
                match lower.as_str() {
                    "rows" => Ok(Orientation::Rows),
                    "columns" => Ok(Orientation::Columns),
                    _ => Err(DslError::parser(format!(
                        "Expected 'rows' or 'columns', got '{}'",
                        value
                    ))),
                }
            }
            _ => Err(DslError::parser(format!(
                "Expected orientation, got {:?}",
                self.current()
            ))),
        }
    }

    fn parse_horizontal_align(&mut self) -> DslResult<HorizontalAlign> {
        let s = self.expect_identifier()?;
        match s.to_lowercase().as_str() {
            "left" => Ok(HorizontalAlign::Left),
            "center" => Ok(HorizontalAlign::Center),
            "right" => Ok(HorizontalAlign::Right),
            _ => Err(DslError::parser(format!(
                "Expected 'left', 'center', or 'right', got '{}'",
                s
            ))),
        }
    }

    fn parse_vertical_align(&mut self) -> DslResult<VerticalAlign> {
        let s = self.expect_identifier()?;
        match s.to_lowercase().as_str() {
            "top" => Ok(VerticalAlign::Top),
            "middle" => Ok(VerticalAlign::Middle),
            "bottom" => Ok(VerticalAlign::Bottom),
            _ => Err(DslError::parser(format!(
                "Expected 'top', 'middle', or 'bottom', got '{}'",
                s
            ))),
        }
    }

    fn parse_number_format(&mut self) -> DslResult<NumberFormat> {
        let s = self.expect_identifier()?;
        match s.to_lowercase().as_str() {
            "currency" => Ok(NumberFormat::Currency),
            "percent" => Ok(NumberFormat::Percent),
            "number" => Ok(NumberFormat::Number),
            "date" => Ok(NumberFormat::Date),
            "datetime" => Ok(NumberFormat::DateTime),
            _ => Err(DslError::parser(format!(
                "Expected number format type, got '{}'",
                s
            ))),
        }
    }

    fn parse_string_array(&mut self) -> DslResult<Vec<String>> {
        self.expect(Token::LeftBracket)?;
        self.skip_newlines();

        let mut strings = Vec::new();
        while !self.check(&Token::RightBracket) && !self.is_at_end() {
            strings.push(self.expect_string()?);

            if self.check(&Token::Comma) {
                self.advance();
                self.skip_newlines();
            } else {
                break;
            }
        }

        self.expect(Token::RightBracket)?;
        Ok(strings)
    }

    fn parse_rows_array(&mut self) -> DslResult<Vec<Vec<DslValue>>> {
        self.expect(Token::LeftBracket)?;
        self.skip_newlines();

        let mut rows = Vec::new();
        while !self.check(&Token::RightBracket) && !self.is_at_end() {
            self.expect(Token::LeftBracket)?;
            self.skip_newlines();

            let mut values = Vec::new();
            while !self.check(&Token::RightBracket) && !self.is_at_end() {
                values.push(self.parse_value()?);

                if self.check(&Token::Comma) {
                    self.advance();
                    self.skip_newlines();
                } else {
                    break;
                }
            }

            self.expect(Token::RightBracket)?;
            rows.push(values);

            if self.check(&Token::Comma) {
                self.advance();
            }
            self.skip_newlines();
        }

        self.expect(Token::RightBracket)?;
        Ok(rows)
    }

    fn parse_table_formats(&mut self) -> DslResult<TableFormats> {
        self.expect(Token::LeftBrace)?;
        self.skip_newlines();

        let mut formats = TableFormats::default();

        while !self.check(&Token::RightBrace) && !self.is_at_end() {
            let key = self.expect_identifier_or_string()?;
            self.expect(Token::Colon)?;

            if key.to_lowercase() == "headers" {
                formats.headers = Some(self.parse_format_block()?);
            } else {
                let fmt = self.parse_format_block()?;
                formats.columns.push((key, fmt));
            }

            self.skip_newlines();
        }

        self.expect(Token::RightBrace)?;
        Ok(formats)
    }

    // Helper methods

    fn current(&self) -> &Token {
        self.tokens.get(self.pos).unwrap_or(&Token::Eof)
    }

    fn check(&self, expected: &Token) -> bool {
        std::mem::discriminant(self.current()) == std::mem::discriminant(expected)
    }

    fn advance(&mut self) {
        if !self.is_at_end() {
            self.pos += 1;
        }
    }

    fn is_at_end(&self) -> bool {
        matches!(self.current(), Token::Eof)
    }

    fn skip_newlines(&mut self) {
        while self.check(&Token::Newline) {
            self.advance();
        }
    }

    fn expect(&mut self, expected: Token) -> DslResult<()> {
        if self.check(&expected) {
            self.advance();
            Ok(())
        } else {
            Err(DslError::parser(format!(
                "Expected {:?}, got {:?}",
                expected,
                self.current()
            )))
        }
    }

    fn expect_identifier(&mut self) -> DslResult<String> {
        match self.current() {
            Token::Identifier(s) => {
                let value = s.clone();
                self.advance();
                Ok(value)
            }
            _ => Err(DslError::parser(format!(
                "Expected identifier, got {:?}",
                self.current()
            ))),
        }
    }

    fn expect_identifier_or_keyword(&mut self) -> DslResult<String> {
        match self.current() {
            Token::Identifier(s) => {
                let value = s.clone();
                self.advance();
                Ok(value)
            }
            Token::Headers => {
                self.advance();
                Ok("headers".to_string())
            }
            Token::Rows => {
                self.advance();
                Ok("rows".to_string())
            }
            Token::Columns => {
                self.advance();
                Ok("columns".to_string())
            }
            Token::Format => {
                self.advance();
                Ok("format".to_string())
            }
            _ => Err(DslError::parser(format!(
                "Expected identifier, got {:?}",
                self.current()
            ))),
        }
    }

    fn expect_identifier_or_string(&mut self) -> DslResult<String> {
        match self.current() {
            Token::Identifier(s) => {
                let value = s.clone();
                self.advance();
                Ok(value)
            }
            Token::String(s) => {
                let value = s.clone();
                self.advance();
                Ok(value)
            }
            Token::Headers => {
                self.advance();
                Ok("headers".to_string())
            }
            _ => Err(DslError::parser(format!(
                "Expected identifier or string, got {:?}",
                self.current()
            ))),
        }
    }

    fn expect_string(&mut self) -> DslResult<String> {
        match self.current() {
            Token::String(s) => {
                let value = s.clone();
                self.advance();
                Ok(value)
            }
            _ => Err(DslError::parser(format!(
                "Expected string, got {:?}",
                self.current()
            ))),
        }
    }

    fn expect_number(&mut self) -> DslResult<String> {
        match self.current() {
            Token::Number(n) => {
                let value = n.clone();
                self.advance();
                Ok(value)
            }
            _ => Err(DslError::parser(format!(
                "Expected number, got {:?}",
                self.current()
            ))),
        }
    }

    fn expect_color_or_identifier(&mut self) -> DslResult<String> {
        match self.current() {
            Token::Identifier(s) => {
                let value = s.clone();
                self.advance();
                Ok(value)
            }
            Token::String(s) => {
                let value = s.clone();
                self.advance();
                Ok(value)
            }
            _ => Err(DslError::parser(format!(
                "Expected color or identifier, got {:?}",
                self.current()
            ))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_cell() {
        let doc = parse("cell A1: \"Hello\"").unwrap();
        assert_eq!(doc.statements.len(), 1);

        match &doc.statements[0] {
            DslStatement::Cell(cell) => {
                assert_eq!(cell.position, CellPosition::new(0, 0));
                assert_eq!(cell.value, DslValue::Text("Hello".to_string()));
            }
            _ => panic!("Expected Cell statement"),
        }
    }

    #[test]
    fn test_parse_cell_with_number() {
        let doc = parse("cell B2: 123.45").unwrap();
        assert_eq!(doc.statements.len(), 1);

        match &doc.statements[0] {
            DslStatement::Cell(cell) => {
                assert_eq!(cell.position, CellPosition::new(1, 1));
                assert_eq!(
                    cell.value,
                    DslValue::Number(Decimal::from_str("123.45").unwrap())
                );
            }
            _ => panic!("Expected Cell statement"),
        }
    }

    #[test]
    fn test_parse_cell_with_formula() {
        let doc = parse("cell C3: =SUM(A1:A10)").unwrap();
        assert_eq!(doc.statements.len(), 1);

        match &doc.statements[0] {
            DslStatement::Cell(cell) => {
                assert_eq!(cell.position, CellPosition::new(2, 2));
                assert_eq!(cell.value, DslValue::Formula("=SUM(A1:A10)".to_string()));
            }
            _ => panic!("Expected Cell statement"),
        }
    }

    #[test]
    fn test_parse_cell_with_format() {
        let doc = parse("cell A1: \"Title\" {bold, align:center}").unwrap();

        match &doc.statements[0] {
            DslStatement::Cell(cell) => {
                assert!(cell.format.is_some());
                let fmt = cell.format.as_ref().unwrap();
                assert_eq!(fmt.bold, Some(true));
                assert_eq!(fmt.align, Some(HorizontalAlign::Center));
            }
            _ => panic!("Expected Cell statement"),
        }
    }

    #[test]
    fn test_parse_grid() {
        let doc = parse(
            r#"grid at A1 [
            ["Product", "Price"]
            ["Widget", 100]
        ]"#,
        )
        .unwrap();

        match &doc.statements[0] {
            DslStatement::Grid(grid) => {
                assert_eq!(grid.position, CellPosition::new(0, 0));
                assert_eq!(grid.rows.len(), 2);
                assert_eq!(grid.rows[0].values.len(), 2);
            }
            _ => panic!("Expected Grid statement"),
        }
    }

    #[test]
    fn test_parse_table() {
        let doc = parse(
            r#"table "Sales" at A1 {
            headers: ["Region", "Revenue"]
            rows: [
                ["North", 5000]
                ["South", 3000]
            ]
        }"#,
        )
        .unwrap();

        match &doc.statements[0] {
            DslStatement::Table(table) => {
                assert_eq!(table.name, "Sales");
                assert_eq!(table.position, CellPosition::new(0, 0));
                assert_eq!(table.headers, vec!["Region", "Revenue"]);
                assert_eq!(table.rows.len(), 2);
            }
            _ => panic!("Expected Table statement"),
        }
    }

    #[test]
    fn test_parse_code_cell() {
        let doc = parse(
            r#"python at A10 {
            import pandas as pd
            df = pd.DataFrame()
        }"#,
        )
        .unwrap();

        match &doc.statements[0] {
            DslStatement::CodeCell(code) => {
                assert_eq!(code.position, CellPosition::new(0, 9));
                assert_eq!(code.language, CodeLanguage::Python);
                assert!(code.code.contains("import"));
            }
            _ => panic!("Expected CodeCell statement"),
        }
    }

    #[test]
    fn test_parse_format_statement() {
        let doc = parse("format B:B {format:currency}").unwrap();

        match &doc.statements[0] {
            DslStatement::Format(fmt) => {
                assert_eq!(fmt.range, CellRange::Column { col: 1 });
                assert_eq!(fmt.format.number_format, Some(NumberFormat::Currency));
            }
            _ => panic!("Expected Format statement"),
        }
    }
}

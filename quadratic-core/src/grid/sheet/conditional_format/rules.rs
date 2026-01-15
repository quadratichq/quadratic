//! Conditional format rule types for client communication.
//!
//! These types represent the parsed condition from a formula AST,
//! making it easy for the client to display and edit conditional formats.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{
    a1::A1Context,
    formulas::ast::{AstNode, AstNodeContents, Formula},
    grid::SheetId,
};

/// A value in a conditional format rule - can be a number, text, cell reference, etc.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub enum ConditionalFormatValue {
    /// A numeric value
    Number(f64),
    /// A text/string value
    Text(String),
    /// A cell reference (as A1 notation string)
    CellRef(String),
    /// A boolean value
    Bool(bool),
}

impl ConditionalFormatValue {
    /// Convert the value to a string for display
    pub fn to_display_string(&self) -> String {
        match self {
            ConditionalFormatValue::Number(n) => n.to_string(),
            ConditionalFormatValue::Text(s) => s.clone(),
            ConditionalFormatValue::CellRef(s) => s.clone(),
            ConditionalFormatValue::Bool(b) => b.to_string().to_uppercase(),
        }
    }
}

/// Parsed conditional format rule for client display/editing.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub enum ConditionalFormatRule {
    // Cell conditions
    IsEmpty,
    IsNotEmpty,

    // Text conditions
    TextContains { value: String },
    TextNotContains { value: String },
    TextStartsWith { value: String },
    TextEndsWith { value: String },
    TextIsExactly { value: String },

    // Number conditions
    GreaterThan { value: ConditionalFormatValue },
    GreaterThanOrEqual { value: ConditionalFormatValue },
    LessThan { value: ConditionalFormatValue },
    LessThanOrEqual { value: ConditionalFormatValue },
    IsEqualTo { value: ConditionalFormatValue },
    IsNotEqualTo { value: ConditionalFormatValue },
    IsBetween { min: ConditionalFormatValue, max: ConditionalFormatValue },
    IsNotBetween { min: ConditionalFormatValue, max: ConditionalFormatValue },

    // Custom formula - doesn't match any known pattern
    Custom { formula: String },
}

impl ConditionalFormatRule {
    /// Try to parse a Formula AST into a ConditionalFormatRule.
    /// Returns a Custom rule with the formula string if no pattern matches.
    pub fn from_formula(
        formula: &Formula,
        sheet_id: Option<SheetId>,
        a1_context: &A1Context,
    ) -> Self {
        // Get the formula as a string first (for Custom fallback)
        let formula_string = formula.to_a1_string(sheet_id, a1_context);

        // Try to match known patterns
        if let Some(rule) = Self::try_parse_ast(&formula.ast, sheet_id, a1_context) {
            rule
        } else {
            ConditionalFormatRule::Custom {
                formula: formula_string,
            }
        }
    }

    /// Try to parse an AST node into a known rule pattern.
    fn try_parse_ast(
        ast: &AstNode,
        sheet_id: Option<SheetId>,
        a1_context: &A1Context,
    ) -> Option<Self> {
        match &ast.inner {
            // ISBLANK(cellRef) -> IsEmpty
            AstNodeContents::FunctionCall { func, args } if func.inner.eq_ignore_ascii_case("ISBLANK") => {
                if args.len() == 1 && Self::is_cell_ref(&args[0]) {
                    return Some(ConditionalFormatRule::IsEmpty);
                }
                None
            }

            // NOT(ISBLANK(cellRef)) -> IsNotEmpty
            AstNodeContents::FunctionCall { func, args } if func.inner.eq_ignore_ascii_case("NOT") => {
                if args.len() == 1 {
                    if let AstNodeContents::FunctionCall { func: inner_func, args: inner_args } = &args[0].inner {
                        if inner_func.inner.eq_ignore_ascii_case("ISBLANK")
                            && inner_args.len() == 1
                            && Self::is_cell_ref(&inner_args[0])
                        {
                            return Some(ConditionalFormatRule::IsNotEmpty);
                        }
                    }
                }
                None
            }

            // ISNUMBER(SEARCH(value, cellRef)) -> TextContains
            AstNodeContents::FunctionCall { func, args } if func.inner.eq_ignore_ascii_case("ISNUMBER") => {
                if args.len() == 1 {
                    if let AstNodeContents::FunctionCall { func: inner_func, args: inner_args } = &args[0].inner {
                        if inner_func.inner.eq_ignore_ascii_case("SEARCH") && inner_args.len() == 2 {
                            if let Some(value) = Self::extract_string_value(&inner_args[0]) {
                                if Self::is_cell_ref(&inner_args[1]) {
                                    return Some(ConditionalFormatRule::TextContains { value });
                                }
                            }
                        }
                    }
                }
                None
            }

            // ISERROR(SEARCH(value, cellRef)) -> TextNotContains
            AstNodeContents::FunctionCall { func, args } if func.inner.eq_ignore_ascii_case("ISERROR") => {
                if args.len() == 1 {
                    if let AstNodeContents::FunctionCall { func: inner_func, args: inner_args } = &args[0].inner {
                        if inner_func.inner.eq_ignore_ascii_case("SEARCH") && inner_args.len() == 2 {
                            if let Some(value) = Self::extract_string_value(&inner_args[0]) {
                                if Self::is_cell_ref(&inner_args[1]) {
                                    return Some(ConditionalFormatRule::TextNotContains { value });
                                }
                            }
                        }
                    }
                }
                None
            }

            // AND(cellRef >= min, cellRef <= max) -> IsBetween
            AstNodeContents::FunctionCall { func, args } if func.inner.eq_ignore_ascii_case("AND") => {
                if args.len() == 2 {
                    if let (Some((op1, val1)), Some((op2, val2))) = (
                        Self::extract_comparison(&args[0], sheet_id, a1_context),
                        Self::extract_comparison(&args[1], sheet_id, a1_context),
                    ) {
                        // AND(cellRef >= min, cellRef <= max)
                        if op1 == ">=" && op2 == "<=" {
                            return Some(ConditionalFormatRule::IsBetween { min: val1, max: val2 });
                        }
                    }
                }
                None
            }

            // OR(cellRef < min, cellRef > max) -> IsNotBetween
            AstNodeContents::FunctionCall { func, args } if func.inner.eq_ignore_ascii_case("OR") => {
                if args.len() == 2 {
                    if let (Some((op1, val1)), Some((op2, val2))) = (
                        Self::extract_comparison(&args[0], sheet_id, a1_context),
                        Self::extract_comparison(&args[1], sheet_id, a1_context),
                    ) {
                        // OR(cellRef < min, cellRef > max)
                        if op1 == "<" && op2 == ">" {
                            return Some(ConditionalFormatRule::IsNotBetween { min: val1, max: val2 });
                        }
                    }
                }
                None
            }

            // LEFT(cellRef, len) = value -> TextStartsWith
            // RIGHT(cellRef, len) = value -> TextEndsWith
            // cellRef = value, cellRef > value, etc. -> comparison rules
            AstNodeContents::FunctionCall { func, args } => {
                let op = func.inner.as_str();
                match op {
                    "=" | "==" => Self::try_parse_equals(args, sheet_id, a1_context),
                    ">" => Self::try_parse_simple_comparison(args, ">", sheet_id, a1_context),
                    ">=" => Self::try_parse_simple_comparison(args, ">=", sheet_id, a1_context),
                    "<" => Self::try_parse_simple_comparison(args, "<", sheet_id, a1_context),
                    "<=" => Self::try_parse_simple_comparison(args, "<=", sheet_id, a1_context),
                    "<>" | "!=" => Self::try_parse_simple_comparison(args, "<>", sheet_id, a1_context),
                    _ => None,
                }
            }

            _ => None,
        }
    }

    /// Check if an AST node is a cell reference
    fn is_cell_ref(ast: &AstNode) -> bool {
        matches!(&ast.inner, AstNodeContents::CellRef(_, _) | AstNodeContents::RangeRef(_))
    }

    /// Extract a string value from an AST node
    fn extract_string_value(ast: &AstNode) -> Option<String> {
        match &ast.inner {
            AstNodeContents::String(s) => Some(s.clone()),
            _ => None,
        }
    }

    /// Extract a value from an AST node
    fn extract_value(ast: &AstNode, sheet_id: Option<SheetId>, a1_context: &A1Context) -> Option<ConditionalFormatValue> {
        match &ast.inner {
            AstNodeContents::Number(n) => Some(ConditionalFormatValue::Number(*n)),
            AstNodeContents::String(s) => Some(ConditionalFormatValue::Text(s.clone())),
            AstNodeContents::Bool(b) => Some(ConditionalFormatValue::Bool(*b)),
            AstNodeContents::CellRef(_, _) | AstNodeContents::RangeRef(_) => {
                // Convert cell reference to A1 string
                let formula = Formula { ast: ast.clone() };
                Some(ConditionalFormatValue::CellRef(formula.to_a1_string(sheet_id, a1_context)))
            }
            _ => None,
        }
    }

    /// Extract a comparison operation and value from an AST node.
    /// Returns (operator, value) if successful.
    fn extract_comparison(
        ast: &AstNode,
        sheet_id: Option<SheetId>,
        a1_context: &A1Context,
    ) -> Option<(&'static str, ConditionalFormatValue)> {
        if let AstNodeContents::FunctionCall { func, args } = &ast.inner {
            if args.len() == 2 && Self::is_cell_ref(&args[0]) {
                let op = match func.inner.as_str() {
                    ">" => ">",
                    ">=" => ">=",
                    "<" => "<",
                    "<=" => "<=",
                    "=" | "==" => "=",
                    "<>" | "!=" => "<>",
                    _ => return None,
                };
                if let Some(value) = Self::extract_value(&args[1], sheet_id, a1_context) {
                    return Some((op, value));
                }
            }
        }
        None
    }

    /// Try to parse an equals comparison (could be text_is_exactly, text_starts_with, text_ends_with, or is_equal_to)
    fn try_parse_equals(
        args: &[AstNode],
        sheet_id: Option<SheetId>,
        a1_context: &A1Context,
    ) -> Option<Self> {
        if args.len() != 2 {
            return None;
        }

        // Check for LEFT(cellRef, len) = value -> TextStartsWith
        if let AstNodeContents::FunctionCall { func, args: left_args } = &args[0].inner {
            if func.inner.eq_ignore_ascii_case("LEFT") && left_args.len() == 2 {
                if Self::is_cell_ref(&left_args[0]) {
                    if let Some(value) = Self::extract_string_value(&args[1]) {
                        return Some(ConditionalFormatRule::TextStartsWith { value });
                    }
                }
            }
            // Check for RIGHT(cellRef, len) = value -> TextEndsWith
            if func.inner.eq_ignore_ascii_case("RIGHT") && left_args.len() == 2 {
                if Self::is_cell_ref(&left_args[0]) {
                    if let Some(value) = Self::extract_string_value(&args[1]) {
                        return Some(ConditionalFormatRule::TextEndsWith { value });
                    }
                }
            }
        }

        // Simple comparison: cellRef = value
        if Self::is_cell_ref(&args[0]) {
            if let Some(value) = Self::extract_value(&args[1], sheet_id, a1_context) {
                // If it's a string, it's TextIsExactly; otherwise IsEqualTo
                if matches!(value, ConditionalFormatValue::Text(_)) {
                    if let ConditionalFormatValue::Text(s) = value {
                        return Some(ConditionalFormatRule::TextIsExactly { value: s });
                    }
                }
                return Some(ConditionalFormatRule::IsEqualTo { value });
            }
        }

        None
    }

    /// Try to parse a simple comparison (>, >=, <, <=, <>)
    fn try_parse_simple_comparison(
        args: &[AstNode],
        op: &str,
        sheet_id: Option<SheetId>,
        a1_context: &A1Context,
    ) -> Option<Self> {
        if args.len() != 2 {
            return None;
        }

        if Self::is_cell_ref(&args[0]) {
            if let Some(value) = Self::extract_value(&args[1], sheet_id, a1_context) {
                return match op {
                    ">" => Some(ConditionalFormatRule::GreaterThan { value }),
                    ">=" => Some(ConditionalFormatRule::GreaterThanOrEqual { value }),
                    "<" => Some(ConditionalFormatRule::LessThan { value }),
                    "<=" => Some(ConditionalFormatRule::LessThanOrEqual { value }),
                    "<>" | "!=" => Some(ConditionalFormatRule::IsNotEqualTo { value }),
                    _ => None,
                };
            }
        }

        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::controller::GridController;
    use crate::formulas::parse_formula;

    fn parse_and_match(formula_str: &str) -> ConditionalFormatRule {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let pos = gc.grid().origin_in_first_sheet();
        let formula = parse_formula(formula_str, gc.a1_context(), pos).unwrap();
        ConditionalFormatRule::from_formula(&formula, Some(sheet_id), gc.a1_context())
    }

    #[test]
    fn test_is_empty() {
        let rule = parse_and_match("ISBLANK(A1)");
        assert!(matches!(rule, ConditionalFormatRule::IsEmpty));
    }

    #[test]
    fn test_is_not_empty() {
        let rule = parse_and_match("NOT(ISBLANK(A1))");
        assert!(matches!(rule, ConditionalFormatRule::IsNotEmpty));
    }

    #[test]
    fn test_greater_than() {
        let rule = parse_and_match("A1 > 5");
        assert!(matches!(rule, ConditionalFormatRule::GreaterThan { value: ConditionalFormatValue::Number(n) } if n == 5.0));
    }

    #[test]
    fn test_greater_than_or_equal() {
        let rule = parse_and_match("A1 >= 10");
        assert!(matches!(rule, ConditionalFormatRule::GreaterThanOrEqual { value: ConditionalFormatValue::Number(n) } if n == 10.0));
    }

    #[test]
    fn test_less_than() {
        let rule = parse_and_match("A1 < 100");
        assert!(matches!(rule, ConditionalFormatRule::LessThan { value: ConditionalFormatValue::Number(n) } if n == 100.0));
    }

    #[test]
    fn test_less_than_or_equal() {
        let rule = parse_and_match("A1 <= 50");
        assert!(matches!(rule, ConditionalFormatRule::LessThanOrEqual { value: ConditionalFormatValue::Number(n) } if n == 50.0));
    }

    #[test]
    fn test_is_equal_to() {
        let rule = parse_and_match("A1 = 42");
        assert!(matches!(rule, ConditionalFormatRule::IsEqualTo { value: ConditionalFormatValue::Number(n) } if n == 42.0));
    }

    #[test]
    fn test_is_not_equal_to() {
        let rule = parse_and_match("A1 <> 0");
        assert!(matches!(rule, ConditionalFormatRule::IsNotEqualTo { value: ConditionalFormatValue::Number(n) } if n == 0.0));
    }

    #[test]
    fn test_text_contains() {
        let rule = parse_and_match("ISNUMBER(SEARCH(\"hello\", A1))");
        assert!(matches!(rule, ConditionalFormatRule::TextContains { value } if value == "hello"));
    }

    #[test]
    fn test_text_not_contains() {
        let rule = parse_and_match("ISERROR(SEARCH(\"test\", A1))");
        assert!(matches!(rule, ConditionalFormatRule::TextNotContains { value } if value == "test"));
    }

    #[test]
    fn test_text_starts_with() {
        let rule = parse_and_match("LEFT(A1, 5) = \"hello\"");
        assert!(matches!(rule, ConditionalFormatRule::TextStartsWith { value } if value == "hello"));
    }

    #[test]
    fn test_text_ends_with() {
        let rule = parse_and_match("RIGHT(A1, 5) = \"world\"");
        assert!(matches!(rule, ConditionalFormatRule::TextEndsWith { value } if value == "world"));
    }

    #[test]
    fn test_text_is_exactly() {
        let rule = parse_and_match("A1 = \"exact match\"");
        assert!(matches!(rule, ConditionalFormatRule::TextIsExactly { value } if value == "exact match"));
    }

    #[test]
    fn test_is_between() {
        let rule = parse_and_match("AND(A1 >= 5, A1 <= 10)");
        assert!(matches!(rule, ConditionalFormatRule::IsBetween { min: ConditionalFormatValue::Number(min), max: ConditionalFormatValue::Number(max) } if min == 5.0 && max == 10.0));
    }

    #[test]
    fn test_is_not_between() {
        let rule = parse_and_match("OR(A1 < 5, A1 > 10)");
        assert!(matches!(rule, ConditionalFormatRule::IsNotBetween { min: ConditionalFormatValue::Number(min), max: ConditionalFormatValue::Number(max) } if min == 5.0 && max == 10.0));
    }

    #[test]
    fn test_custom_formula() {
        let rule = parse_and_match("SUM(A1:A10) > 100");
        assert!(matches!(rule, ConditionalFormatRule::Custom { .. }));
    }

    #[test]
    fn test_cell_ref_value() {
        let rule = parse_and_match("A1 > B1");
        assert!(matches!(rule, ConditionalFormatRule::GreaterThan { value: ConditionalFormatValue::CellRef(_) }));
    }
}

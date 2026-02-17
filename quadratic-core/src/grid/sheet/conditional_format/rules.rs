//! Conditional format rule types for client communication.
//!
//! These types represent the parsed condition from a formula AST,
//! making it easy for the client to display and edit conditional formats.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{
    Pos,
    a1::{A1Context, A1Selection, CellRefRange},
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

/// Escape a string for use inside double quotes in a formula.
/// Double quotes are escaped by doubling them: `"` → `""`.
fn escape_formula_string(s: &str) -> String {
    s.replace('"', "\"\"")
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

    /// Convert the value to a string suitable for use in a formula.
    /// Text values are quoted and escaped, numbers/cell refs/bools are not.
    pub fn to_formula_string(&self) -> String {
        match self {
            ConditionalFormatValue::Number(n) => n.to_string(),
            ConditionalFormatValue::Text(s) => format!("\"{}\"", escape_formula_string(s)),
            ConditionalFormatValue::CellRef(s) => s.clone(),
            ConditionalFormatValue::Bool(b) => {
                if *b {
                    "TRUE".to_string()
                } else {
                    "FALSE".to_string()
                }
            }
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
    TextContains {
        value: String,
    },
    TextNotContains {
        value: String,
    },
    TextStartsWith {
        value: String,
    },
    TextEndsWith {
        value: String,
    },
    TextIsExactly {
        value: String,
    },

    // Number conditions
    GreaterThan {
        value: ConditionalFormatValue,
    },
    GreaterThanOrEqual {
        value: ConditionalFormatValue,
    },
    LessThan {
        value: ConditionalFormatValue,
    },
    LessThanOrEqual {
        value: ConditionalFormatValue,
    },
    IsEqualTo {
        value: ConditionalFormatValue,
    },
    IsNotEqualTo {
        value: ConditionalFormatValue,
    },
    IsBetween {
        min: ConditionalFormatValue,
        max: ConditionalFormatValue,
    },
    IsNotBetween {
        min: ConditionalFormatValue,
        max: ConditionalFormatValue,
    },

    // Custom formula - doesn't match any known pattern
    Custom {
        formula: String,
    },
}

impl ConditionalFormatRule {
    /// Try to parse a Formula AST into a ConditionalFormatRule.
    /// Returns a Custom rule with the formula string if no pattern matches.
    ///
    /// The `selection` parameter is used to determine the expected first cell.
    /// For a formula to match a preset pattern, any cell reference in the formula
    /// must match the start of the selection's first range. For example, if the
    /// selection is A2:B5 (first range starts at A2), and the formula is `=A2<0`,
    /// it matches the "less than" preset. But if the formula is `=A1<0`, it doesn't
    /// match because A1 != A2.
    pub fn from_formula(
        formula: &Formula,
        sheet_id: Option<SheetId>,
        a1_context: &A1Context,
        selection: &A1Selection,
    ) -> Self {
        // Get the formula as a string first (for Custom fallback)
        let formula_string = formula.to_a1_string(sheet_id, a1_context);

        // Get the expected first cell from the start of the first range
        let expected_first_cell = Self::get_first_cell_from_selection(selection, a1_context);

        // Try to match known patterns
        if let Some(rule) =
            Self::try_parse_ast(&formula.ast, sheet_id, a1_context, expected_first_cell)
        {
            rule
        } else {
            ConditionalFormatRule::Custom {
                formula: formula_string,
            }
        }
    }

    /// Extract the first cell position from the start of the selection's first range.
    pub(crate) fn get_first_cell_from_selection(
        selection: &A1Selection,
        a1_context: &A1Context,
    ) -> Option<Pos> {
        selection.ranges.first().and_then(|range| match range {
            CellRefRange::Sheet { range } => {
                // Get the start position of the sheet range
                let x = range.start.col();
                let y = range.start.row();
                // Only return if both are finite (not unbounded)
                if x != crate::a1::UNBOUNDED && y != crate::a1::UNBOUNDED {
                    Some(Pos { x, y })
                } else {
                    None
                }
            }
            CellRefRange::Table { range } => {
                // For table references, convert to ref range bounds and get the start position
                range
                    .convert_to_ref_range_bounds(false, a1_context, false, false)
                    .and_then(|bounds| {
                        let x = bounds.start.col();
                        let y = bounds.start.row();
                        if x != crate::a1::UNBOUNDED && y != crate::a1::UNBOUNDED {
                            Some(Pos { x, y })
                        } else {
                            None
                        }
                    })
            }
        })
    }

    /// Try to parse an AST node into a known rule pattern.
    /// The `expected_first_cell` is the start of the selection's first range.
    /// For a formula to match a preset, the cell reference must match this position.
    fn try_parse_ast(
        ast: &AstNode,
        sheet_id: Option<SheetId>,
        a1_context: &A1Context,
        expected_first_cell: Option<Pos>,
    ) -> Option<Self> {
        match &ast.inner {
            // ISBLANK(cellRef) -> IsEmpty
            AstNodeContents::FunctionCall { func, args }
                if func.inner.eq_ignore_ascii_case("ISBLANK") =>
            {
                if args.len() == 1 && Self::is_matching_cell_ref(&args[0], expected_first_cell) {
                    return Some(ConditionalFormatRule::IsEmpty);
                }
                None
            }

            // NOT(ISBLANK(cellRef)) -> IsNotEmpty
            AstNodeContents::FunctionCall { func, args }
                if func.inner.eq_ignore_ascii_case("NOT") =>
            {
                if args.len() == 1
                    && let AstNodeContents::FunctionCall {
                        func: inner_func,
                        args: inner_args,
                    } = &args[0].inner
                    && inner_func.inner.eq_ignore_ascii_case("ISBLANK")
                    && inner_args.len() == 1
                    && Self::is_matching_cell_ref(&inner_args[0], expected_first_cell)
                {
                    return Some(ConditionalFormatRule::IsNotEmpty);
                }
                None
            }

            // ISNUMBER(SEARCH(value, cellRef)) -> TextContains
            AstNodeContents::FunctionCall { func, args }
                if func.inner.eq_ignore_ascii_case("ISNUMBER") =>
            {
                if args.len() == 1
                    && let AstNodeContents::FunctionCall {
                        func: inner_func,
                        args: inner_args,
                    } = &args[0].inner
                    && inner_func.inner.eq_ignore_ascii_case("SEARCH")
                    && inner_args.len() == 2
                    && let Some(value) = Self::extract_string_value(&inner_args[0])
                    && Self::is_matching_cell_ref(&inner_args[1], expected_first_cell)
                {
                    return Some(ConditionalFormatRule::TextContains { value });
                }
                None
            }

            // ISERROR(SEARCH(value, cellRef)) -> TextNotContains
            AstNodeContents::FunctionCall { func, args }
                if func.inner.eq_ignore_ascii_case("ISERROR") =>
            {
                if args.len() == 1
                    && let AstNodeContents::FunctionCall {
                        func: inner_func,
                        args: inner_args,
                    } = &args[0].inner
                    && inner_func.inner.eq_ignore_ascii_case("SEARCH")
                    && inner_args.len() == 2
                    && let Some(value) = Self::extract_string_value(&inner_args[0])
                    && Self::is_matching_cell_ref(&inner_args[1], expected_first_cell)
                {
                    return Some(ConditionalFormatRule::TextNotContains { value });
                }
                None
            }

            // AND(cellRef >= min, cellRef <= max) -> IsBetween
            AstNodeContents::FunctionCall { func, args }
                if func.inner.eq_ignore_ascii_case("AND") =>
            {
                if args.len() == 2
                    && let (Some((op1, val1)), Some((op2, val2))) = (
                        Self::extract_comparison(
                            &args[0],
                            sheet_id,
                            a1_context,
                            expected_first_cell,
                        ),
                        Self::extract_comparison(
                            &args[1],
                            sheet_id,
                            a1_context,
                            expected_first_cell,
                        ),
                    )
                    // AND(cellRef >= min, cellRef <= max)
                    && op1 == ">="
                    && op2 == "<="
                {
                    return Some(ConditionalFormatRule::IsBetween {
                        min: val1,
                        max: val2,
                    });
                }
                None
            }

            // OR(cellRef < min, cellRef > max) -> IsNotBetween
            AstNodeContents::FunctionCall { func, args }
                if func.inner.eq_ignore_ascii_case("OR") =>
            {
                if args.len() == 2
                    && let (Some((op1, val1)), Some((op2, val2))) = (
                        Self::extract_comparison(
                            &args[0],
                            sheet_id,
                            a1_context,
                            expected_first_cell,
                        ),
                        Self::extract_comparison(
                            &args[1],
                            sheet_id,
                            a1_context,
                            expected_first_cell,
                        ),
                    )
                    // OR(cellRef < min, cellRef > max)
                    && op1 == "<"
                    && op2 == ">"
                {
                    return Some(ConditionalFormatRule::IsNotBetween {
                        min: val1,
                        max: val2,
                    });
                }
                None
            }

            // LEFT(cellRef, len) = value -> TextStartsWith
            // RIGHT(cellRef, len) = value -> TextEndsWith
            // cellRef = value, cellRef > value, etc. -> comparison rules
            AstNodeContents::FunctionCall { func, args } => {
                let op = func.inner.as_str();
                match op {
                    "=" | "==" => {
                        Self::try_parse_equals(args, sheet_id, a1_context, expected_first_cell)
                    }
                    ">" => Self::try_parse_simple_comparison(
                        args,
                        ">",
                        sheet_id,
                        a1_context,
                        expected_first_cell,
                    ),
                    ">=" => Self::try_parse_simple_comparison(
                        args,
                        ">=",
                        sheet_id,
                        a1_context,
                        expected_first_cell,
                    ),
                    "<" => Self::try_parse_simple_comparison(
                        args,
                        "<",
                        sheet_id,
                        a1_context,
                        expected_first_cell,
                    ),
                    "<=" => Self::try_parse_simple_comparison(
                        args,
                        "<=",
                        sheet_id,
                        a1_context,
                        expected_first_cell,
                    ),
                    "<>" | "!=" => Self::try_parse_simple_comparison(
                        args,
                        "<>",
                        sheet_id,
                        a1_context,
                        expected_first_cell,
                    ),
                    _ => None,
                }
            }

            _ => None,
        }
    }

    /// Check if an AST node is a cell reference that matches the expected first cell.
    /// If `expected_first_cell` is None, we cannot verify the position, so we return false
    /// (treat as custom formula).
    fn is_matching_cell_ref(ast: &AstNode, expected_first_cell: Option<Pos>) -> bool {
        let Some(expected) = expected_first_cell else {
            return false;
        };

        match &ast.inner {
            AstNodeContents::CellRef(_, bounds) => {
                // Check if this is a single cell reference that matches the expected position
                if let Some(pos) = bounds.try_to_pos() {
                    pos == expected
                } else {
                    false
                }
            }
            AstNodeContents::RangeRef(_) => {
                // Range references don't match single cell presets
                false
            }
            _ => false,
        }
    }

    /// Extract a string value from an AST node
    fn extract_string_value(ast: &AstNode) -> Option<String> {
        match &ast.inner {
            AstNodeContents::String(s) => Some(s.clone()),
            _ => None,
        }
    }

    /// Extract a value from an AST node
    fn extract_value(
        ast: &AstNode,
        sheet_id: Option<SheetId>,
        a1_context: &A1Context,
    ) -> Option<ConditionalFormatValue> {
        match &ast.inner {
            AstNodeContents::Number(n) => Some(ConditionalFormatValue::Number(*n)),
            AstNodeContents::String(s) => Some(ConditionalFormatValue::Text(s.clone())),
            AstNodeContents::Bool(b) => Some(ConditionalFormatValue::Bool(*b)),
            AstNodeContents::CellRef(_, _) | AstNodeContents::RangeRef(_) => {
                // Convert cell reference to A1 string
                let formula = Formula { ast: ast.clone() };
                Some(ConditionalFormatValue::CellRef(
                    formula.to_a1_string(sheet_id, a1_context),
                ))
            }
            _ => None,
        }
    }

    /// Extract a comparison operation and value from an AST node.
    /// Returns (operator, value) if successful.
    /// The cell reference must match the expected_first_cell position.
    fn extract_comparison(
        ast: &AstNode,
        sheet_id: Option<SheetId>,
        a1_context: &A1Context,
        expected_first_cell: Option<Pos>,
    ) -> Option<(&'static str, ConditionalFormatValue)> {
        if let AstNodeContents::FunctionCall { func, args } = &ast.inner
            && args.len() == 2
            && Self::is_matching_cell_ref(&args[0], expected_first_cell)
        {
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
        None
    }

    /// Try to parse an equals comparison (could be text_is_exactly, text_starts_with, text_ends_with, or is_equal_to)
    fn try_parse_equals(
        args: &[AstNode],
        sheet_id: Option<SheetId>,
        a1_context: &A1Context,
        expected_first_cell: Option<Pos>,
    ) -> Option<Self> {
        if args.len() != 2 {
            return None;
        }

        // Check for LEFT(cellRef, len) = value -> TextStartsWith
        if let AstNodeContents::FunctionCall {
            func,
            args: left_args,
        } = &args[0].inner
        {
            if func.inner.eq_ignore_ascii_case("LEFT")
                && left_args.len() == 2
                && Self::is_matching_cell_ref(&left_args[0], expected_first_cell)
                && let Some(value) = Self::extract_string_value(&args[1])
            {
                return Some(ConditionalFormatRule::TextStartsWith { value });
            }
            // Check for RIGHT(cellRef, len) = value -> TextEndsWith
            if func.inner.eq_ignore_ascii_case("RIGHT")
                && left_args.len() == 2
                && Self::is_matching_cell_ref(&left_args[0], expected_first_cell)
                && let Some(value) = Self::extract_string_value(&args[1])
            {
                return Some(ConditionalFormatRule::TextEndsWith { value });
            }
        }

        // Simple comparison: cellRef = value
        if Self::is_matching_cell_ref(&args[0], expected_first_cell)
            && let Some(value) = Self::extract_value(&args[1], sheet_id, a1_context)
        {
            // If it's a string, it's TextIsExactly; otherwise IsEqualTo
            if let ConditionalFormatValue::Text(s) = value {
                return Some(ConditionalFormatRule::TextIsExactly { value: s });
            }
            return Some(ConditionalFormatRule::IsEqualTo { value });
        }

        None
    }

    /// Try to parse a simple comparison (>, >=, <, <=, <>)
    fn try_parse_simple_comparison(
        args: &[AstNode],
        op: &str,
        sheet_id: Option<SheetId>,
        a1_context: &A1Context,
        expected_first_cell: Option<Pos>,
    ) -> Option<Self> {
        if args.len() != 2 {
            return None;
        }

        if Self::is_matching_cell_ref(&args[0], expected_first_cell)
            && let Some(value) = Self::extract_value(&args[1], sheet_id, a1_context)
        {
            return match op {
                ">" => Some(ConditionalFormatRule::GreaterThan { value }),
                ">=" => Some(ConditionalFormatRule::GreaterThanOrEqual { value }),
                "<" => Some(ConditionalFormatRule::LessThan { value }),
                "<=" => Some(ConditionalFormatRule::LessThanOrEqual { value }),
                "<>" | "!=" => Some(ConditionalFormatRule::IsNotEqualTo { value }),
                _ => None,
            };
        }

        None
    }

    /// Returns the default value for `apply_to_blank` based on the rule type.
    ///
    /// - `IsEmpty` and `IsNotEmpty`: return `true` (these rules are specifically about blank cells)
    /// - Numeric comparisons (GreaterThan, LessThan, etc.): return `false` (blank coerces to 0, which is often surprising)
    /// - Text conditions: return `false` (blank is not the same as empty string for these purposes)
    /// - Custom formulas: return `false` (user should explicitly opt-in)
    ///
    /// Convert the rule to a formula string using the given anchor cell reference.
    /// For example, with anchor "B2", IsEmpty becomes "ISBLANK(B2)" and
    /// GreaterThan { value: 5 } becomes "B2>5".
    pub fn to_formula_string(&self, anchor: &str) -> String {
        match self {
            ConditionalFormatRule::IsEmpty => format!("ISBLANK({})", anchor),
            ConditionalFormatRule::IsNotEmpty => format!("NOT(ISBLANK({}))", anchor),

            ConditionalFormatRule::TextContains { value } => {
                format!(
                    "ISNUMBER(SEARCH(\"{}\", {}))",
                    escape_formula_string(value),
                    anchor
                )
            }
            ConditionalFormatRule::TextNotContains { value } => {
                format!(
                    "ISERROR(SEARCH(\"{}\", {}))",
                    escape_formula_string(value),
                    anchor
                )
            }
            ConditionalFormatRule::TextStartsWith { value } => {
                format!(
                    "LEFT({}, {})=\"{}\"",
                    anchor,
                    value.chars().count(),
                    escape_formula_string(value)
                )
            }
            ConditionalFormatRule::TextEndsWith { value } => {
                format!(
                    "RIGHT({}, {})=\"{}\"",
                    anchor,
                    value.chars().count(),
                    escape_formula_string(value)
                )
            }
            ConditionalFormatRule::TextIsExactly { value } => {
                format!("{}=\"{}\"", anchor, escape_formula_string(value))
            }

            ConditionalFormatRule::GreaterThan { value } => {
                format!("{}>{}", anchor, value.to_formula_string())
            }
            ConditionalFormatRule::GreaterThanOrEqual { value } => {
                format!("{}>={}", anchor, value.to_formula_string())
            }
            ConditionalFormatRule::LessThan { value } => {
                format!("{}<{}", anchor, value.to_formula_string())
            }
            ConditionalFormatRule::LessThanOrEqual { value } => {
                format!("{}<={}", anchor, value.to_formula_string())
            }
            ConditionalFormatRule::IsEqualTo { value } => {
                format!("{}={}", anchor, value.to_formula_string())
            }
            ConditionalFormatRule::IsNotEqualTo { value } => {
                format!("{}<>{}", anchor, value.to_formula_string())
            }
            ConditionalFormatRule::IsBetween { min, max } => {
                format!(
                    "AND({}>={}, {}<={})",
                    anchor,
                    min.to_formula_string(),
                    anchor,
                    max.to_formula_string()
                )
            }
            ConditionalFormatRule::IsNotBetween { min, max } => {
                format!(
                    "OR({}<{}, {}>{})",
                    anchor,
                    min.to_formula_string(),
                    anchor,
                    max.to_formula_string()
                )
            }

            ConditionalFormatRule::Custom { formula } => formula.clone(),
        }
    }

    pub fn default_apply_to_blank(&self) -> bool {
        match self {
            // These rules are specifically about blank cells
            ConditionalFormatRule::IsEmpty | ConditionalFormatRule::IsNotEmpty => true,

            // Numeric comparisons: blank coerces to 0, which is often surprising
            // e.g., ">=0" would match blank cells unexpectedly
            ConditionalFormatRule::GreaterThan { .. }
            | ConditionalFormatRule::GreaterThanOrEqual { .. }
            | ConditionalFormatRule::LessThan { .. }
            | ConditionalFormatRule::LessThanOrEqual { .. }
            | ConditionalFormatRule::IsEqualTo { .. }
            | ConditionalFormatRule::IsNotEqualTo { .. }
            | ConditionalFormatRule::IsBetween { .. }
            | ConditionalFormatRule::IsNotBetween { .. } => false,

            // Text conditions: blank is not the same as empty string
            ConditionalFormatRule::TextContains { .. }
            | ConditionalFormatRule::TextNotContains { .. }
            | ConditionalFormatRule::TextStartsWith { .. }
            | ConditionalFormatRule::TextEndsWith { .. }
            | ConditionalFormatRule::TextIsExactly { .. } => false,

            // Custom formulas: user should explicitly opt-in
            ConditionalFormatRule::Custom { .. } => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::controller::GridController;
    use crate::formulas::parse_formula;

    fn parse_and_match(formula_str: &str) -> ConditionalFormatRule {
        parse_and_match_with_selection(formula_str, "A1")
    }

    fn parse_and_match_with_selection(
        formula_str: &str,
        selection_str: &str,
    ) -> ConditionalFormatRule {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let pos = gc.grid().origin_in_first_sheet();
        let formula = parse_formula(formula_str, gc.a1_context(), pos).unwrap();
        let selection = A1Selection::test_a1(selection_str);
        ConditionalFormatRule::from_formula(&formula, Some(sheet_id), gc.a1_context(), &selection)
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
        assert!(
            matches!(rule, ConditionalFormatRule::GreaterThan { value: ConditionalFormatValue::Number(n) } if n == 5.0)
        );
    }

    #[test]
    fn test_greater_than_or_equal() {
        let rule = parse_and_match("A1 >= 10");
        assert!(
            matches!(rule, ConditionalFormatRule::GreaterThanOrEqual { value: ConditionalFormatValue::Number(n) } if n == 10.0)
        );
    }

    #[test]
    fn test_less_than() {
        let rule = parse_and_match("A1 < 100");
        assert!(
            matches!(rule, ConditionalFormatRule::LessThan { value: ConditionalFormatValue::Number(n) } if n == 100.0)
        );
    }

    #[test]
    fn test_less_than_or_equal() {
        let rule = parse_and_match("A1 <= 50");
        assert!(
            matches!(rule, ConditionalFormatRule::LessThanOrEqual { value: ConditionalFormatValue::Number(n) } if n == 50.0)
        );
    }

    #[test]
    fn test_is_equal_to() {
        let rule = parse_and_match("A1 = 42");
        assert!(
            matches!(rule, ConditionalFormatRule::IsEqualTo { value: ConditionalFormatValue::Number(n) } if n == 42.0)
        );
    }

    #[test]
    fn test_is_not_equal_to() {
        let rule = parse_and_match("A1 <> 0");
        assert!(
            matches!(rule, ConditionalFormatRule::IsNotEqualTo { value: ConditionalFormatValue::Number(n) } if n == 0.0)
        );
    }

    #[test]
    fn test_text_contains() {
        let rule = parse_and_match("ISNUMBER(SEARCH(\"hello\", A1))");
        assert!(matches!(rule, ConditionalFormatRule::TextContains { value } if value == "hello"));
    }

    #[test]
    fn test_text_not_contains() {
        let rule = parse_and_match("ISERROR(SEARCH(\"test\", A1))");
        assert!(
            matches!(rule, ConditionalFormatRule::TextNotContains { value } if value == "test")
        );
    }

    #[test]
    fn test_text_starts_with() {
        let rule = parse_and_match("LEFT(A1, 5) = \"hello\"");
        assert!(
            matches!(rule, ConditionalFormatRule::TextStartsWith { value } if value == "hello")
        );
    }

    #[test]
    fn test_text_ends_with() {
        let rule = parse_and_match("RIGHT(A1, 5) = \"world\"");
        assert!(matches!(rule, ConditionalFormatRule::TextEndsWith { value } if value == "world"));
    }

    #[test]
    fn test_text_is_exactly() {
        let rule = parse_and_match("A1 = \"exact match\"");
        assert!(
            matches!(rule, ConditionalFormatRule::TextIsExactly { value } if value == "exact match")
        );
    }

    #[test]
    fn test_is_between() {
        let rule = parse_and_match("AND(A1 >= 5, A1 <= 10)");
        assert!(
            matches!(rule, ConditionalFormatRule::IsBetween { min: ConditionalFormatValue::Number(min), max: ConditionalFormatValue::Number(max) } if min == 5.0 && max == 10.0)
        );
    }

    #[test]
    fn test_is_not_between() {
        let rule = parse_and_match("OR(A1 < 5, A1 > 10)");
        assert!(
            matches!(rule, ConditionalFormatRule::IsNotBetween { min: ConditionalFormatValue::Number(min), max: ConditionalFormatValue::Number(max) } if min == 5.0 && max == 10.0)
        );
    }

    #[test]
    fn test_custom_formula() {
        let rule = parse_and_match("SUM(A1:A10) > 100");
        assert!(matches!(rule, ConditionalFormatRule::Custom { .. }));
    }

    #[test]
    fn test_cell_ref_value() {
        let rule = parse_and_match("A1 > B1");
        assert!(matches!(
            rule,
            ConditionalFormatRule::GreaterThan {
                value: ConditionalFormatValue::CellRef(_)
            }
        ));
    }

    #[test]
    fn test_mismatched_cell_ref_becomes_custom() {
        // Formula references A2 but selection starts at A1 - should be custom
        let rule = parse_and_match_with_selection("A2 > 5", "A1:B5");
        assert!(matches!(rule, ConditionalFormatRule::Custom { .. }));

        // Formula references A1 and selection starts at A1 - should match preset
        let rule = parse_and_match_with_selection("A1 > 5", "A1:B5");
        assert!(
            matches!(rule, ConditionalFormatRule::GreaterThan { value: ConditionalFormatValue::Number(n) } if n == 5.0)
        );

        // Formula references B2 but selection starts at A1 - should be custom
        let rule = parse_and_match_with_selection("B2 < 10", "A1:C5");
        assert!(matches!(rule, ConditionalFormatRule::Custom { .. }));

        // Formula references B2 and selection starts at B2 - should match preset
        let rule = parse_and_match_with_selection("B2 < 10", "B2:C5");
        assert!(
            matches!(rule, ConditionalFormatRule::LessThan { value: ConditionalFormatValue::Number(n) } if n == 10.0)
        );
    }

    #[test]
    fn test_isblank_mismatched_becomes_custom() {
        // ISBLANK with matching cell ref
        let rule = parse_and_match_with_selection("ISBLANK(A1)", "A1:B5");
        assert!(matches!(rule, ConditionalFormatRule::IsEmpty));

        // ISBLANK with mismatched cell ref
        let rule = parse_and_match_with_selection("ISBLANK(A2)", "A1:B5");
        assert!(matches!(rule, ConditionalFormatRule::Custom { .. }));
    }

    #[test]
    fn test_table_column_selection() {
        use crate::Rect;
        use crate::a1::A1Context;

        // Create a context with a table at A1:B4 (header row at A2, data at A3:B4)
        let context = A1Context::test(
            &[],
            &[("Table1", &["Col1", "Col2"], Rect::test_a1("A1:B4"))],
        );

        // Table at A1:B4 with headers and data:
        // Row 1: Table name
        // Row 2: Col1, Col2 (headers)
        // Row 3-4: data

        // Parse a formula at the first data cell of Col1 (A3)
        let selection = A1Selection::test_a1_context("Table1[Col1]", &context);
        let sheet_id = selection.sheet_id;

        // The first data cell of Table1[Col1] should be A3
        let formula = parse_formula(
            "A3 < 0",
            &context,
            crate::SheetPos {
                x: 1,
                y: 3,
                sheet_id,
            },
        )
        .unwrap();
        let rule =
            ConditionalFormatRule::from_formula(&formula, Some(sheet_id), &context, &selection);

        // Should match LessThan preset since formula cell ref (A3) matches first cell of selection
        assert!(
            matches!(rule, ConditionalFormatRule::LessThan { value: ConditionalFormatValue::Number(n) } if n == 0.0),
            "Expected LessThan preset for matching table column selection, got {:?}",
            rule
        );

        // Now test with mismatched cell ref (A1 instead of A3)
        let formula = parse_formula(
            "A1 < 0",
            &context,
            crate::SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
        )
        .unwrap();
        let rule =
            ConditionalFormatRule::from_formula(&formula, Some(sheet_id), &context, &selection);

        // Should be Custom since A1 doesn't match the first data cell (A3)
        assert!(
            matches!(rule, ConditionalFormatRule::Custom { .. }),
            "Expected Custom for mismatched table column selection, got {:?}",
            rule
        );
    }

    #[test]
    fn test_table_column2_first_cell() {
        use crate::Rect;
        use crate::a1::A1Context;

        // Create a table at A1:B100 with name+headers
        // Row 1: Table name (TableName)
        // Row 2: Column 1, Column 2 (headers)
        // Rows 3-100: data
        let context = A1Context::test(
            &[],
            &[(
                "TableName",
                &["Column 1", "Column 2"],
                Rect::test_a1("A1:B100"),
            )],
        );

        // Select Column 2 of the table
        let selection = A1Selection::test_a1_context("TableName[Column 2]", &context);

        // Check what first cell is extracted
        let first_cell = ConditionalFormatRule::get_first_cell_from_selection(&selection, &context);

        // Column 2 should be column B (x=2), first data row should be row 3 (y=3)
        // So the first cell should be B3
        assert_eq!(
            first_cell,
            Some(Pos { x: 2, y: 3 }),
            "Expected first cell of TableName[Column 2] to be B3, got {:?}",
            first_cell
        );

        // Also test Column 1 to make sure we're getting the right column
        let selection = A1Selection::test_a1_context("TableName[Column 1]", &context);
        let first_cell = ConditionalFormatRule::get_first_cell_from_selection(&selection, &context);
        assert_eq!(
            first_cell,
            Some(Pos { x: 1, y: 3 }),
            "Expected first cell of TableName[Column 1] to be A3, got {:?}",
            first_cell
        );
    }

    #[test]
    fn test_table_column2_with_real_grid() {
        use crate::test_util::*;

        // Create a real table using the GridController
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Create a data table with 2 columns, multiple rows
        test_create_data_table(&mut gc, sheet_id, pos![A1], 2, 10);

        // The data table should have:
        // - Table name row
        // - Column headers row (Column 1, Column 2)
        // - Data rows

        // Debug: print what tables are available
        println!("A1 Context: {:?}", gc.a1_context());

        // Select the second column - table name is "test_table"
        let selection = A1Selection::test_a1_context("test_table[Column 2]", gc.a1_context());

        // Debug: print the selection
        println!("Selection: {:?}", selection);

        // Check what first cell is extracted
        let first_cell =
            ConditionalFormatRule::get_first_cell_from_selection(&selection, gc.a1_context());

        println!("First cell: {:?}", first_cell);

        // The second column should be column B (x=2)
        // First data row depends on table settings
        if let Some(pos) = first_cell {
            assert_eq!(pos.x, 2, "Expected column B (x=2), got x={}", pos.x);
        } else {
            panic!("Expected Some(Pos), got None");
        }
    }
}

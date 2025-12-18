//! Database functions for formulas.
//!
//! These functions work with structured data where:
//! - The database is a range with headers in the first row
//! - The field specifies which column to operate on
//! - The criteria is a range specifying conditions to match

use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Database functions",
    docs: None,
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Averages values in a column of a database that match specified criteria.
            ///
            /// - database: Range containing the data with headers in the first row
            /// - field: Column name (text) or column number (1-based)
            /// - criteria: Range containing criteria (headers and conditions)
            #[examples("DAVERAGE(A1:C10, \"Sales\", E1:F2)")]
            fn DAVERAGE(
                span: Span,
                database: (Spanned<Array>),
                field: (Spanned<Value>),
                criteria: (Spanned<Array>),
            ) {
                let values = extract_matching_values(&database, &field, &criteria, span)?;
                if values.is_empty() {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                values.iter().sum::<f64>() / values.len() as f64
            }
        ),
        formula_fn!(
            /// Counts cells containing numbers in a column of a database that match criteria.
            ///
            /// - database: Range containing the data with headers in the first row
            /// - field: Column name (text) or column number (1-based)
            /// - criteria: Range containing criteria (headers and conditions)
            #[examples("DCOUNT(A1:C10, \"Quantity\", E1:F2)")]
            fn DCOUNT(
                span: Span,
                database: (Spanned<Array>),
                field: (Spanned<Value>),
                criteria: (Spanned<Array>),
            ) {
                let values = extract_matching_values(&database, &field, &criteria, span)?;
                values.len() as f64
            }
        ),
        formula_fn!(
            /// Counts non-blank cells in a column of a database that match criteria.
            ///
            /// - database: Range containing the data with headers in the first row
            /// - field: Column name (text) or column number (1-based)
            /// - criteria: Range containing criteria (headers and conditions)
            #[examples("DCOUNTA(A1:C10, \"Name\", E1:F2)")]
            fn DCOUNTA(
                span: Span,
                database: (Spanned<Array>),
                field: (Spanned<Value>),
                criteria: (Spanned<Array>),
            ) {
                let count = count_matching_nonblank(&database, &field, &criteria, span)?;
                count as f64
            }
        ),
        formula_fn!(
            /// Extracts a single value from a column of a database that matches criteria.
            ///
            /// Returns an error if no records match or if multiple records match.
            #[examples("DGET(A1:C10, \"Price\", E1:F2)")]
            fn DGET(
                span: Span,
                database: (Spanned<Array>),
                field: (Spanned<Value>),
                criteria: (Spanned<Array>),
            ) {
                let values = extract_matching_cell_values(&database, &field, &criteria, span)?;
                if values.is_empty() {
                    return Err(RunErrorMsg::NoMatch.with_span(span));
                }
                if values.len() > 1 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                values.into_iter().next().unwrap()
            }
        ),
        formula_fn!(
            /// Returns the maximum value in a column of a database that matches criteria.
            #[examples("DMAX(A1:C10, \"Sales\", E1:F2)")]
            fn DMAX(
                span: Span,
                database: (Spanned<Array>),
                field: (Spanned<Value>),
                criteria: (Spanned<Array>),
            ) {
                let values = extract_matching_values(&database, &field, &criteria, span)?;
                values.into_iter().fold(f64::NEG_INFINITY, f64::max)
            }
        ),
        formula_fn!(
            /// Returns the minimum value in a column of a database that matches criteria.
            #[examples("DMIN(A1:C10, \"Sales\", E1:F2)")]
            fn DMIN(
                span: Span,
                database: (Spanned<Array>),
                field: (Spanned<Value>),
                criteria: (Spanned<Array>),
            ) {
                let values = extract_matching_values(&database, &field, &criteria, span)?;
                values.into_iter().fold(f64::INFINITY, f64::min)
            }
        ),
        formula_fn!(
            /// Multiplies all values in a column of a database that match criteria.
            #[examples("DPRODUCT(A1:C10, \"Quantity\", E1:F2)")]
            fn DPRODUCT(
                span: Span,
                database: (Spanned<Array>),
                field: (Spanned<Value>),
                criteria: (Spanned<Array>),
            ) {
                let values = extract_matching_values(&database, &field, &criteria, span)?;
                if values.is_empty() {
                    0.0
                } else {
                    values.into_iter().product::<f64>()
                }
            }
        ),
        formula_fn!(
            /// Calculates the sample standard deviation of values in a column that match criteria.
            #[examples("DSTDEV(A1:C10, \"Sales\", E1:F2)")]
            fn DSTDEV(
                span: Span,
                database: (Spanned<Array>),
                field: (Spanned<Value>),
                criteria: (Spanned<Array>),
            ) {
                let values = extract_matching_values(&database, &field, &criteria, span)?;
                if values.len() < 2 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                let n = values.len() as f64;
                let mean = values.iter().sum::<f64>() / n;
                let variance = values.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / (n - 1.0);
                variance.sqrt()
            }
        ),
        formula_fn!(
            /// Calculates the population standard deviation of values in a column that match criteria.
            #[examples("DSTDEVP(A1:C10, \"Sales\", E1:F2)")]
            fn DSTDEVP(
                span: Span,
                database: (Spanned<Array>),
                field: (Spanned<Value>),
                criteria: (Spanned<Array>),
            ) {
                let values = extract_matching_values(&database, &field, &criteria, span)?;
                if values.is_empty() {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                let n = values.len() as f64;
                let mean = values.iter().sum::<f64>() / n;
                let variance = values.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / n;
                variance.sqrt()
            }
        ),
        formula_fn!(
            /// Sums values in a column of a database that match criteria.
            #[examples("DSUM(A1:C10, \"Sales\", E1:F2)")]
            fn DSUM(
                span: Span,
                database: (Spanned<Array>),
                field: (Spanned<Value>),
                criteria: (Spanned<Array>),
            ) {
                let values = extract_matching_values(&database, &field, &criteria, span)?;
                values.into_iter().sum::<f64>()
            }
        ),
        formula_fn!(
            /// Calculates the sample variance of values in a column that match criteria.
            #[examples("DVAR(A1:C10, \"Sales\", E1:F2)")]
            fn DVAR(
                span: Span,
                database: (Spanned<Array>),
                field: (Spanned<Value>),
                criteria: (Spanned<Array>),
            ) {
                let values = extract_matching_values(&database, &field, &criteria, span)?;
                if values.len() < 2 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                let n = values.len() as f64;
                let mean = values.iter().sum::<f64>() / n;
                values.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / (n - 1.0)
            }
        ),
        formula_fn!(
            /// Calculates the population variance of values in a column that match criteria.
            #[examples("DVARP(A1:C10, \"Sales\", E1:F2)")]
            fn DVARP(
                span: Span,
                database: (Spanned<Array>),
                field: (Spanned<Value>),
                criteria: (Spanned<Array>),
            ) {
                let values = extract_matching_values(&database, &field, &criteria, span)?;
                if values.is_empty() {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                let n = values.len() as f64;
                let mean = values.iter().sum::<f64>() / n;
                values.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / n
            }
        ),
    ]
}

/// Find the column index for the specified field in the database.
fn find_field_column(database: &Array, field: &Spanned<Value>, span: Span) -> CodeResult<usize> {
    let headers: Vec<CellValue> = database
        .rows()
        .next()
        .map(|row| row.to_vec())
        .unwrap_or_default();

    match &field.inner {
        Value::Single(cv) => match cv {
            CellValue::Number(n) => {
                use rust_decimal::prelude::ToPrimitive;
                let col = n
                    .to_i64()
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(field.span))?
                    as usize;
                if col < 1 || col > headers.len() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(field.span));
                }
                Ok(col - 1)
            }
            CellValue::Text(name) => {
                let name_lower = name.to_lowercase();
                headers
                    .iter()
                    .position(|h| {
                        if let CellValue::Text(header) = h {
                            header.to_lowercase() == name_lower
                        } else {
                            false
                        }
                    })
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(field.span))
            }
            _ => Err(RunErrorMsg::InvalidArgument.with_span(field.span)),
        },
        _ => Err(RunErrorMsg::InvalidArgument.with_span(span)),
    }
}

/// Check if a row matches the criteria.
fn row_matches_criteria(
    row: &[CellValue],
    headers: &[CellValue],
    criteria_headers: &[CellValue],
    criteria_row: &[CellValue],
) -> bool {
    // For each criterion column, check if the row matches
    for (crit_idx, crit_header) in criteria_headers.iter().enumerate() {
        let crit_value = criteria_row
            .get(crit_idx)
            .cloned()
            .unwrap_or(CellValue::Blank);

        // Skip blank criteria
        if crit_value.is_blank() {
            continue;
        }

        // Find the matching column in the database
        let db_col_idx = if let CellValue::Text(crit_name) = crit_header {
            let crit_name_lower = crit_name.to_lowercase();
            headers.iter().position(|h| {
                if let CellValue::Text(header) = h {
                    header.to_lowercase() == crit_name_lower
                } else {
                    false
                }
            })
        } else {
            None
        };

        if let Some(db_idx) = db_col_idx {
            let db_value = row.get(db_idx).cloned().unwrap_or(CellValue::Blank);

            // Compare values
            if !values_match(&db_value, &crit_value) {
                return false;
            }
        }
    }
    true
}

/// Check if a database value matches a criteria value.
fn values_match(db_value: &CellValue, crit_value: &CellValue) -> bool {
    match (db_value, crit_value) {
        (CellValue::Number(a), CellValue::Number(b)) => a == b,
        (CellValue::Text(a), CellValue::Text(b)) => {
            // Support wildcard matching with * and ?
            let pattern = b.to_lowercase();
            let text = a.to_lowercase();

            if pattern.contains('*') || pattern.contains('?') {
                wildcard_match(&text, &pattern)
            } else if let Some(stripped) = pattern.strip_prefix('>') {
                // Comparison operators in text
                if let Ok(num) = stripped.trim().parse::<f64>()
                    && let Ok(db_num) = text.parse::<f64>()
                {
                    return db_num > num;
                }
                false
            } else if let Some(stripped) = pattern.strip_prefix("<>") {
                // Not equal
                text != stripped.trim()
            } else if let Some(stripped) = pattern.strip_prefix("<=") {
                if let Ok(num) = stripped.trim().parse::<f64>()
                    && let Ok(db_num) = text.parse::<f64>()
                {
                    return db_num <= num;
                }
                false
            } else if let Some(stripped) = pattern.strip_prefix('<') {
                if let Ok(num) = stripped.trim().parse::<f64>()
                    && let Ok(db_num) = text.parse::<f64>()
                {
                    return db_num < num;
                }
                false
            } else if let Some(stripped) = pattern.strip_prefix(">=") {
                if let Ok(num) = stripped.trim().parse::<f64>()
                    && let Ok(db_num) = text.parse::<f64>()
                {
                    return db_num >= num;
                }
                false
            } else if let Some(stripped) = pattern.strip_prefix('=') {
                text == stripped.trim()
            } else {
                text == pattern
            }
        }
        (CellValue::Number(n), CellValue::Text(t)) => {
            use rust_decimal::prelude::ToPrimitive;
            let num = n.to_f64().unwrap_or(0.0);
            // Handle comparison operators
            if let Some(stripped) = t.strip_prefix(">=") {
                if let Ok(cmp) = stripped.trim().parse::<f64>() {
                    return num >= cmp;
                }
            } else if let Some(stripped) = t.strip_prefix("<=") {
                if let Ok(cmp) = stripped.trim().parse::<f64>() {
                    return num <= cmp;
                }
            } else if let Some(stripped) = t.strip_prefix("<>") {
                if let Ok(cmp) = stripped.trim().parse::<f64>() {
                    return (num - cmp).abs() > f64::EPSILON;
                }
            } else if let Some(stripped) = t.strip_prefix('>') {
                if let Ok(cmp) = stripped.trim().parse::<f64>() {
                    return num > cmp;
                }
            } else if let Some(stripped) = t.strip_prefix('<') {
                if let Ok(cmp) = stripped.trim().parse::<f64>() {
                    return num < cmp;
                }
            } else if let Some(stripped) = t.strip_prefix('=') {
                if let Ok(cmp) = stripped.trim().parse::<f64>() {
                    return (num - cmp).abs() < f64::EPSILON;
                }
            } else if let Ok(cmp) = t.parse::<f64>() {
                return (num - cmp).abs() < f64::EPSILON;
            }
            false
        }
        (CellValue::Logical(a), CellValue::Logical(b)) => a == b,
        _ => false,
    }
}

/// Simple wildcard matching (* matches any sequence, ? matches any single char).
fn wildcard_match(text: &str, pattern: &str) -> bool {
    let mut t_chars = text.chars().peekable();
    let mut p_chars = pattern.chars().peekable();

    let mut t_backup: Option<std::iter::Peekable<std::str::Chars<'_>>> = None;
    let mut p_backup: Option<std::iter::Peekable<std::str::Chars<'_>>> = None;

    loop {
        match (p_chars.peek(), t_chars.peek()) {
            (Some('*'), _) => {
                p_chars.next();
                if p_chars.peek().is_none() {
                    return true; // Trailing * matches everything
                }
                t_backup = Some(t_chars.clone());
                p_backup = Some(p_chars.clone());
            }
            (Some('?'), Some(_)) => {
                p_chars.next();
                t_chars.next();
            }
            (Some(p), Some(t)) if *p == *t => {
                p_chars.next();
                t_chars.next();
            }
            (None, None) => return true,
            (None, Some(_)) => return false,
            (Some(_), None) => {
                // Check if remaining pattern is all *
                if p_chars.clone().all(|c| c == '*') {
                    return true;
                }
                return false;
            }
            _ => {
                // Mismatch - try backtracking
                if let (Some(tb), Some(pb)) = (&t_backup, &p_backup) {
                    t_chars = tb.clone();
                    t_chars.next();
                    t_backup = Some(t_chars.clone());
                    p_chars = pb.clone();
                } else {
                    return false;
                }
            }
        }
    }
}

/// Extract numeric values from matching rows.
fn extract_matching_values(
    database: &Spanned<Array>,
    field: &Spanned<Value>,
    criteria: &Spanned<Array>,
    span: Span,
) -> CodeResult<Vec<f64>> {
    let db = &database.inner;
    let crit = &criteria.inner;

    if db.height() < 2 {
        return Ok(vec![]);
    }

    let field_col = find_field_column(db, field, span)?;
    let headers: Vec<CellValue> = db.rows().next().map(|row| row.to_vec()).unwrap_or_default();
    let criteria_headers: Vec<CellValue> = crit
        .rows()
        .next()
        .map(|row| row.to_vec())
        .unwrap_or_default();

    let mut values = vec![];

    // Iterate through data rows (skip header)
    for row in db.rows().skip(1) {
        let row_vec: Vec<CellValue> = row.to_vec();

        // Check if row matches any criteria row (OR logic between criteria rows)
        let matches = crit.rows().skip(1).any(|crit_row| {
            let crit_row_vec: Vec<CellValue> = crit_row.to_vec();
            row_matches_criteria(&row_vec, &headers, &criteria_headers, &crit_row_vec)
        });

        if matches && let Some(CellValue::Number(n)) = row_vec.get(field_col) {
            use rust_decimal::prelude::ToPrimitive;
            if let Some(f) = n.to_f64() {
                values.push(f);
            }
        }
    }

    Ok(values)
}

/// Extract cell values from matching rows.
fn extract_matching_cell_values(
    database: &Spanned<Array>,
    field: &Spanned<Value>,
    criteria: &Spanned<Array>,
    span: Span,
) -> CodeResult<Vec<CellValue>> {
    let db = &database.inner;
    let crit = &criteria.inner;

    if db.height() < 2 {
        return Ok(vec![]);
    }

    let field_col = find_field_column(db, field, span)?;
    let headers: Vec<CellValue> = db.rows().next().map(|row| row.to_vec()).unwrap_or_default();
    let criteria_headers: Vec<CellValue> = crit
        .rows()
        .next()
        .map(|row| row.to_vec())
        .unwrap_or_default();

    let mut values = vec![];

    for row in db.rows().skip(1) {
        let row_vec: Vec<CellValue> = row.to_vec();

        let matches = crit.rows().skip(1).any(|crit_row| {
            let crit_row_vec: Vec<CellValue> = crit_row.to_vec();
            row_matches_criteria(&row_vec, &headers, &criteria_headers, &crit_row_vec)
        });

        if matches && let Some(cv) = row_vec.get(field_col) {
            values.push(cv.clone());
        }
    }

    Ok(values)
}

/// Count non-blank cells in matching rows.
fn count_matching_nonblank(
    database: &Spanned<Array>,
    field: &Spanned<Value>,
    criteria: &Spanned<Array>,
    span: Span,
) -> CodeResult<usize> {
    let db = &database.inner;
    let crit = &criteria.inner;

    if db.height() < 2 {
        return Ok(0);
    }

    let field_col = find_field_column(db, field, span)?;
    let headers: Vec<CellValue> = db.rows().next().map(|row| row.to_vec()).unwrap_or_default();
    let criteria_headers: Vec<CellValue> = crit
        .rows()
        .next()
        .map(|row| row.to_vec())
        .unwrap_or_default();

    let mut count = 0;

    for row in db.rows().skip(1) {
        let row_vec: Vec<CellValue> = row.to_vec();

        let matches = crit.rows().skip(1).any(|crit_row| {
            let crit_row_vec: Vec<CellValue> = crit_row.to_vec();
            row_matches_criteria(&row_vec, &headers, &criteria_headers, &crit_row_vec)
        });

        if matches
            && let Some(cv) = row_vec.get(field_col)
            && !cv.is_blank()
        {
            count += 1;
        }
    }

    Ok(count)
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, formulas::tests::*};

    #[test]
    fn test_dsum() {
        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];

        // Set up database: A1:C5
        // Headers
        g.set_cell_value(pos![sheet_id!A1], "Name".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!B1], "Category".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!C1], "Sales".to_string(), None, false);
        // Data
        g.set_cell_value(pos![sheet_id!A2], "Apple".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!B2], "Fruit".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!C2], "100".to_string(), None, false);

        g.set_cell_value(pos![sheet_id!A3], "Orange".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!B3], "Fruit".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!C3], "150".to_string(), None, false);

        g.set_cell_value(pos![sheet_id!A4], "Carrot".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!B4], "Vegetable".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!C4], "75".to_string(), None, false);

        g.set_cell_value(pos![sheet_id!A5], "Banana".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!B5], "Fruit".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!C5], "80".to_string(), None, false);

        // Set up criteria: E1:E2
        g.set_cell_value(pos![sheet_id!E1], "Category".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!E2], "Fruit".to_string(), None, false);

        // Test DSUM - should sum all Fruit sales: 100 + 150 + 80 = 330
        assert_eq!("330", eval_to_string(&g, "DSUM(A1:C5, \"Sales\", E1:E2)"));
        assert_eq!("330", eval_to_string(&g, "DSUM(A1:C5, 3, E1:E2)"));
    }

    #[test]
    fn test_daverage() {
        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];

        // Set up simple database
        g.set_cell_value(pos![sheet_id!A1], "Type".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!B1], "Value".to_string(), None, false);

        g.set_cell_value(pos![sheet_id!A2], "A".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!B2], "10".to_string(), None, false);

        g.set_cell_value(pos![sheet_id!A3], "B".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!B3], "20".to_string(), None, false);

        g.set_cell_value(pos![sheet_id!A4], "A".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!B4], "30".to_string(), None, false);

        // Criteria
        g.set_cell_value(pos![sheet_id!D1], "Type".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!D2], "A".to_string(), None, false);

        // Average of A values: (10 + 30) / 2 = 20
        assert_eq!(
            "20",
            eval_to_string(&g, "DAVERAGE(A1:B4, \"Value\", D1:D2)")
        );
    }

    #[test]
    fn test_dcount() {
        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];

        // Set up database
        g.set_cell_value(pos![sheet_id!A1], "Type".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!B1], "Value".to_string(), None, false);

        g.set_cell_value(pos![sheet_id!A2], "A".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!B2], "10".to_string(), None, false);

        g.set_cell_value(pos![sheet_id!A3], "B".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!B3], "20".to_string(), None, false);

        g.set_cell_value(pos![sheet_id!A4], "A".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!B4], "30".to_string(), None, false);

        // Criteria
        g.set_cell_value(pos![sheet_id!D1], "Type".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!D2], "A".to_string(), None, false);

        // Count of A values: 2
        assert_eq!("2", eval_to_string(&g, "DCOUNT(A1:B4, \"Value\", D1:D2)"));
    }

    #[test]
    fn test_dmax_dmin() {
        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];

        // Set up database
        g.set_cell_value(pos![sheet_id!A1], "Type".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!B1], "Value".to_string(), None, false);

        g.set_cell_value(pos![sheet_id!A2], "A".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!B2], "10".to_string(), None, false);

        g.set_cell_value(pos![sheet_id!A3], "A".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!B3], "50".to_string(), None, false);

        g.set_cell_value(pos![sheet_id!A4], "A".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!B4], "30".to_string(), None, false);

        // Criteria
        g.set_cell_value(pos![sheet_id!D1], "Type".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!D2], "A".to_string(), None, false);

        assert_eq!("50", eval_to_string(&g, "DMAX(A1:B4, \"Value\", D1:D2)"));
        assert_eq!("10", eval_to_string(&g, "DMIN(A1:B4, \"Value\", D1:D2)"));
    }
}

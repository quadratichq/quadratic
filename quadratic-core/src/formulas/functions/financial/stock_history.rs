//! STOCKHISTORY function for retrieving historical stock price data.
//!
//! This function is Excel-compatible and retrieves historical data about a
//! financial instrument, returning it as an array.
//!
//! Reference: https://support.microsoft.com/en-us/office/stockhistory-function-1ac8b5b3-5f62-4d94-8ab8-7504ec7239a8

use chrono::NaiveDate;

use super::*;
use crate::ArraySize;
use crate::formulas::ast::AstNode;
use crate::formulas::ctx::Ctx;
use crate::formulas::functions::datetime::parse_date_from_cell_value;

/// Stock price data interval (frequency)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum StockInterval {
    #[default]
    Daily = 0,
    Weekly = 1,
    Monthly = 2,
}

impl TryFrom<i64> for StockInterval {
    type Error = ();

    fn try_from(value: i64) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(StockInterval::Daily),
            1 => Ok(StockInterval::Weekly),
            2 => Ok(StockInterval::Monthly),
            _ => Err(()),
        }
    }
}

impl StockInterval {
    /// Convert to the frequency string expected by the Intrinio API
    pub fn to_api_frequency(&self) -> &'static str {
        match self {
            StockInterval::Daily => "daily",
            StockInterval::Weekly => "weekly",
            StockInterval::Monthly => "monthly",
        }
    }
}

/// Headers display option
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum StockHeaders {
    NoHeaders = 0,
    #[default]
    ShowHeaders = 1,
    ShowIdentifierAndHeaders = 2,
}

impl TryFrom<i64> for StockHeaders {
    type Error = ();

    fn try_from(value: i64) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(StockHeaders::NoHeaders),
            1 => Ok(StockHeaders::ShowHeaders),
            2 => Ok(StockHeaders::ShowIdentifierAndHeaders),
            _ => Err(()),
        }
    }
}

/// Stock property columns that can be retrieved
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StockProperty {
    Date = 0,
    Close = 1,
    Open = 2,
    High = 3,
    Low = 4,
    Volume = 5,
}

impl TryFrom<i64> for StockProperty {
    type Error = ();

    fn try_from(value: i64) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(StockProperty::Date),
            1 => Ok(StockProperty::Close),
            2 => Ok(StockProperty::Open),
            3 => Ok(StockProperty::High),
            4 => Ok(StockProperty::Low),
            5 => Ok(StockProperty::Volume),
            _ => Err(()),
        }
    }
}

impl StockProperty {
    /// Get the header name for this property
    pub fn header_name(&self) -> &'static str {
        match self {
            StockProperty::Date => "Date",
            StockProperty::Close => "Close",
            StockProperty::Open => "Open",
            StockProperty::High => "High",
            StockProperty::Low => "Low",
            StockProperty::Volume => "Volume",
        }
    }

    /// Get the JSON field name from the Intrinio API response
    pub fn api_field_name(&self) -> &'static str {
        match self {
            StockProperty::Date => "date",
            StockProperty::Close => "close",
            StockProperty::Open => "open",
            StockProperty::High => "high",
            StockProperty::Low => "low",
            StockProperty::Volume => "volume",
        }
    }
}

/// Parameters for a STOCKHISTORY request
#[derive(Debug, Clone)]
pub struct StockHistoryParams {
    /// Stock ticker symbol (e.g., "AAPL")
    pub stock: String,
    /// Start date for the data (YYYY-MM-DD)
    pub start_date: String,
    /// End date for the data (YYYY-MM-DD)
    pub end_date: String,
    /// Data interval (daily, weekly, monthly)
    pub interval: StockInterval,
    /// Headers display option
    pub headers: StockHeaders,
    /// Properties (columns) to retrieve
    pub properties: Vec<StockProperty>,
}

impl StockHistoryParams {
    /// Parse properties from optional arguments
    /// Default is [Date, Close] if no properties specified
    pub fn parse_properties(props: &[Option<i64>]) -> Option<Vec<StockProperty>> {
        let filtered: Vec<i64> = props.iter().filter_map(|p| *p).collect();

        if filtered.is_empty() {
            // Default: Date and Close
            return Some(vec![StockProperty::Date, StockProperty::Close]);
        }

        filtered
            .into_iter()
            .map(|i| StockProperty::try_from(i).ok())
            .collect()
    }

    /// Convert properties to a Vec<i32> for the callback
    pub fn properties_to_i32(&self) -> Vec<i32> {
        self.properties.iter().map(|p| *p as i32).collect()
    }

    /// Build a JSON query string for the connection request
    pub fn to_query_json(&self) -> String {
        serde_json::json!({
            "identifier": self.stock,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "frequency": self.interval.to_api_frequency(),
            "headers": self.headers as i32,
            "properties": self.properties_to_i32(),
        })
        .to_string()
    }

    /// Extract StockHistoryParams from evaluated AST arguments.
    ///
    /// This uses the real formula parser, so it properly handles:
    /// - Cell references: STOCKHISTORY(A1, B1, C1)
    /// - Expressions: STOCKHISTORY(CONCAT("AA","PL"), TODAY()-30, TODAY())
    /// - Nested functions and all other formula features
    pub fn from_evaluated_args(args: &[AstNode], ctx: &mut Ctx<'_>) -> Option<Self> {
        if args.is_empty() {
            return None;
        }

        // Extract stock symbol (first argument, required)
        let stock = match value_to_cell_value(args[0].eval(ctx).inner) {
            Some(crate::CellValue::Text(s)) if !s.is_empty() => s,
            _ => return None,
        };

        // Extract start_date (second argument, required)
        let start_date = args.get(1).and_then(|a| eval_date(a, ctx))?;

        // Extract end_date (third argument, optional, defaults to start_date)
        let end_date = args
            .get(2)
            .and_then(|a| eval_date(a, ctx))
            .unwrap_or_else(|| start_date.clone());

        // Extract interval (fourth argument, optional, defaults to 0 = daily)
        let interval = args
            .get(3)
            .and_then(|a| eval_i64(a, ctx))
            .and_then(|i| StockInterval::try_from(i).ok())
            .unwrap_or(StockInterval::Daily);

        // Extract headers (fifth argument, optional, defaults to 1 = show headers)
        let headers = args
            .get(4)
            .and_then(|a| eval_i64(a, ctx))
            .and_then(|h| StockHeaders::try_from(h).ok())
            .unwrap_or(StockHeaders::ShowHeaders);

        // Extract properties (remaining arguments, optional)
        let property_args: Vec<Option<i64>> = (5..=10)
            .map(|i| args.get(i).and_then(|a| eval_i64(a, ctx)))
            .collect();

        let properties = Self::parse_properties(&property_args)?;

        Some(StockHistoryParams {
            stock,
            start_date,
            end_date,
            interval,
            headers,
            properties,
        })
    }
}

/// Extract a single CellValue from a Value (handles both Single and 1x1 Array)
fn value_to_cell_value(value: crate::Value) -> Option<crate::CellValue> {
    match value {
        crate::Value::Single(cv) => Some(cv),
        crate::Value::Array(arr) if arr.size().w.get() == 1 && arr.size().h.get() == 1 => {
            arr.get(0, 0).ok().cloned()
        }
        _ => None,
    }
}

/// Helper to evaluate an AST node and extract an i64
fn eval_i64(arg: &AstNode, ctx: &mut Ctx<'_>) -> Option<i64> {
    use rust_decimal::prelude::ToPrimitive;
    match value_to_cell_value(arg.eval(ctx).inner) {
        Some(crate::CellValue::Number(n)) => n.to_i64(),
        _ => None,
    }
}

/// Helper to evaluate an AST node and extract a date string
fn eval_date(arg: &AstNode, ctx: &mut Ctx<'_>) -> Option<String> {
    match value_to_cell_value(arg.eval(ctx).inner) {
        Some(crate::CellValue::Text(s)) => {
            // Validate date format
            if NaiveDate::parse_from_str(&s, "%Y-%m-%d").is_ok() {
                Some(s)
            } else {
                None
            }
        }
        Some(crate::CellValue::Date(d)) => Some(d.format("%Y-%m-%d").to_string()),
        _ => None,
    }
}

// =============================================================================
// Legacy Manual Formula Parsing (kept for backwards compatibility)
// =============================================================================
//
// The `from_evaluated_args` method above is the preferred approach as it uses
// the real formula parser. These functions are kept for:
// 1. `is_stock_history_formula` - quick check without full parse
// 2. `parse_stock_history_formula` - fallback and for re-parsing in process_stock_history_json
// =============================================================================

/// Check if a formula string is a STOCKHISTORY call (quick check without full parse)
pub fn is_stock_history_formula(code: &str) -> bool {
    let mut trimmed = code.trim();
    // Strip leading '=' if present (formulas are stored with = prefix)
    if trimmed.starts_with('=') {
        trimmed = trimmed[1..].trim();
    }
    trimmed.to_uppercase().starts_with("STOCKHISTORY(")
}

/// Parse STOCKHISTORY arguments from a formula string.
/// Returns Some(StockHistoryParams) if parsing succeeds, None otherwise.
pub fn parse_stock_history_formula(code: &str) -> Option<StockHistoryParams> {
    let mut trimmed = code.trim();

    // Strip leading '=' if present (formulas are stored with = prefix)
    if trimmed.starts_with('=') {
        trimmed = trimmed[1..].trim();
    }

    // Quick check if it starts with STOCKHISTORY(
    if !trimmed.to_uppercase().starts_with("STOCKHISTORY(") {
        return None;
    }

    // Extract the content between STOCKHISTORY( and )
    let start_idx = trimmed.find('(')?;
    let end_idx = trimmed.rfind(')')?;
    if end_idx <= start_idx {
        return None;
    }

    let args_str = &trimmed[start_idx + 1..end_idx];

    // Parse arguments (simple comma splitting, doesn't handle nested functions)
    let args: Vec<&str> = split_args(args_str);

    if args.is_empty() {
        return None;
    }

    // Extract stock symbol (first argument, required)
    let stock = parse_string_arg(args.first()?)?;

    // Extract start_date (second argument, required)
    let start_date = parse_string_arg(args.get(1)?)?;

    // Validate start_date format
    if NaiveDate::parse_from_str(&start_date, "%Y-%m-%d").is_err() {
        return None;
    }

    // Extract end_date (third argument, optional, defaults to start_date)
    let end_date = args
        .get(2)
        .and_then(|s| parse_string_arg(s))
        .filter(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").is_ok())
        .unwrap_or_else(|| start_date.clone());

    // Extract interval (fourth argument, optional, defaults to 0 = daily)
    let interval = args
        .get(3)
        .and_then(|s| s.trim().parse::<i64>().ok())
        .and_then(|i| StockInterval::try_from(i).ok())
        .unwrap_or(StockInterval::Daily);

    // Extract headers (fifth argument, optional, defaults to 1 = show headers)
    let headers = args
        .get(4)
        .and_then(|s| s.trim().parse::<i64>().ok())
        .and_then(|h| StockHeaders::try_from(h).ok())
        .unwrap_or(StockHeaders::ShowHeaders);

    // Extract properties (remaining arguments, optional)
    let property_args: Vec<Option<i64>> = (5..=10)
        .map(|i| args.get(i).and_then(|s| s.trim().parse::<i64>().ok()))
        .collect();

    let properties = StockHistoryParams::parse_properties(&property_args)?;

    Some(StockHistoryParams {
        stock,
        start_date,
        end_date,
        interval,
        headers,
        properties,
    })
}

/// Process stock history JSON response into an Array.
/// This is called from connection_complete when handling StockHistory connections.
///
/// TODO: This re-parses the formula to get headers/properties, even though they
/// were already parsed in run_formula.rs. We could avoid this by passing the
/// params through the connection flow or storing them in the transaction.
pub fn process_stock_history_json(
    json_data: &serde_json::Value,
    formula_code: &str,
) -> Result<Array, String> {
    // Re-parse the formula to get headers and properties settings
    // (see TODO above for why this is necessary)
    let params = parse_stock_history_formula(formula_code).ok_or_else(|| {
        format!(
            "Failed to parse STOCKHISTORY formula parameters from: {:?}",
            formula_code
        )
    })?;

    process_stock_history_response(json_data, params.headers, &params.properties)
}

/// Process the JSON response from the stock prices API into an Array.
fn process_stock_history_response(
    json_data: &serde_json::Value,
    headers: StockHeaders,
    properties: &[StockProperty],
) -> Result<Array, String> {
    // Extract the stock_prices array from the response
    let stock_prices = json_data
        .get("stock_prices")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Invalid response format: missing stock_prices array".to_string())?;

    if stock_prices.is_empty() {
        return Err("No stock price data available for the specified date range".to_string());
    }

    // Determine number of rows and columns
    let num_data_rows = stock_prices.len();
    let num_cols = properties.len();
    let has_headers = matches!(
        headers,
        StockHeaders::ShowHeaders | StockHeaders::ShowIdentifierAndHeaders
    );
    let num_rows = if has_headers {
        num_data_rows + 1
    } else {
        num_data_rows
    };

    // Create the array
    let size = ArraySize::new(num_cols as u32, num_rows as u32)
        .ok_or_else(|| "Invalid array size: width or height is zero".to_string())?;
    let mut array = Array::new_empty(size);

    // Add headers if needed
    let data_start_row = if has_headers {
        for (col, prop) in properties.iter().enumerate() {
            let header_value = CellValue::Text(prop.header_name().to_string());
            array
                .set(col as u32, 0, header_value, false)
                .map_err(|e| format!("Failed to set header: {e}"))?;
        }
        1
    } else {
        0
    };

    // Fill in the data - Intrinio API returns data in descending order (most recent first)
    // which matches Excel's STOCKHISTORY behavior, so we iterate normally
    for (row_offset, price_data) in stock_prices.iter().enumerate() {
        let row = data_start_row + row_offset as u32;

        for (col, prop) in properties.iter().enumerate() {
            let cell_value = extract_cell_value(price_data, prop);
            array
                .set(col as u32, row, cell_value, false)
                .map_err(|e| format!("Failed to set cell: {e}"))?;
        }
    }

    Ok(array)
}

/// Extract a CellValue from the price data JSON for a given property
fn extract_cell_value(price_data: &serde_json::Value, property: &StockProperty) -> CellValue {
    let field_name = property.api_field_name();

    match property {
        StockProperty::Date => price_data
            .get(field_name)
            .and_then(|v| v.as_str())
            .map(|s| CellValue::Text(s.to_string()))
            .unwrap_or(CellValue::Blank),
        StockProperty::Volume => price_data
            .get(field_name)
            .and_then(|v| v.as_i64())
            .map(|n| CellValue::Number(n.into()))
            .unwrap_or(CellValue::Blank),
        StockProperty::Close | StockProperty::Open | StockProperty::High | StockProperty::Low => {
            price_data
                .get(field_name)
                .and_then(|v| v.as_f64())
                .map(CellValue::from)
                .unwrap_or(CellValue::Blank)
        }
    }
}

/// Parse a string argument, handling quoted strings
fn parse_string_arg(arg: &str) -> Option<String> {
    let trimmed = arg.trim();

    // Handle quoted strings using strip_prefix/strip_suffix for clarity
    trimmed
        .strip_prefix('"')
        .and_then(|s| s.strip_suffix('"'))
        .or_else(|| {
            trimmed
                .strip_prefix('\'')
                .and_then(|s| s.strip_suffix('\''))
        })
        .map(String::from)
}

/// Split arguments respecting quoted strings
fn split_args(args_str: &str) -> Vec<&str> {
    let mut args = Vec::new();
    let mut start = 0;
    let mut in_quotes = false;
    let mut quote_char = '\0';

    for (i, c) in args_str.char_indices() {
        if !in_quotes && (c == '"' || c == '\'') {
            in_quotes = true;
            quote_char = c;
        } else if in_quotes && c == quote_char {
            in_quotes = false;
        } else if !in_quotes && c == ',' {
            args.push(&args_str[start..i]);
            start = i + 1;
        }
    }

    // Don't forget the last argument
    if start < args_str.len() {
        args.push(&args_str[start..]);
    }

    args
}

pub fn get_functions() -> Vec<FormulaFunction> {
    vec![formula_fn!(
        /// Retrieves historical data about a financial instrument and returns it as an array.
        ///
        /// This function is compatible with Excel's STOCKHISTORY function.
        ///
        /// **Arguments:**
        /// - `stock`: Stock ticker symbol (e.g., "AAPL", "MSFT")
        /// - `start_date`: The earliest date for which data is retrieved
        /// - `end_date`: (Optional) The latest date for which data is retrieved. Defaults to start_date.
        /// - `interval`: (Optional) Data interval: 0 = daily (default), 1 = weekly, 2 = monthly
        /// - `headers`: (Optional) Header display: 0 = no headers, 1 = show headers (default), 2 = show identifier and headers
        /// - `property0-5`: (Optional) Columns to retrieve: 0 = Date, 1 = Close, 2 = Open, 3 = High, 4 = Low, 5 = Volume. Default is Date and Close.
        ///
        /// **Note:** This function fetches data from Quadratic's financial data service.
        #[examples(
            "STOCKHISTORY(\"AAPL\", \"2025-01-01\")",
            "STOCKHISTORY(\"MSFT\", \"2025-01-01\", \"2025-01-31\")",
            "STOCKHISTORY(\"AAPL\", \"2025-01-01\", \"2025-01-31\", 1)",
            "STOCKHISTORY(\"AAPL\", \"2025-01-01\", \"2025-01-31\", 0, 1, 0, 1, 2, 3, 4, 5)"
        )]
        fn STOCKHISTORY(
            span: Span,
            stock: String,
            start_date: (Spanned<CellValue>),
            end_date: (Option<Spanned<CellValue>>),
            interval: (Option<i64>),
            headers: (Option<i64>),
            property0: (Option<i64>),
            property1: (Option<i64>),
            property2: (Option<i64>),
            property3: (Option<i64>),
            property4: (Option<i64>),
            property5: (Option<i64>),
        ) {
            // Parse start date
            let start_date_parsed = parse_date_from_cell_value(&start_date)?;

            // Parse end date (defaults to start_date)
            let end_date_parsed = match end_date {
                Some(ed) => parse_date_from_cell_value(&ed)?,
                None => start_date_parsed,
            };

            // Validate date range
            if end_date_parsed < start_date_parsed {
                return Err(RunErrorMsg::InvalidArgument.with_span(span));
            }

            // Parse interval
            let interval_val = interval.unwrap_or(0);
            let _interval = StockInterval::try_from(interval_val)
                .map_err(|_| RunErrorMsg::InvalidArgument.with_span(span))?;

            // Parse headers option
            let headers_val = headers.unwrap_or(1);
            let _headers = StockHeaders::try_from(headers_val)
                .map_err(|_| RunErrorMsg::InvalidArgument.with_span(span))?;

            // Parse properties
            let props = [
                property0, property1, property2, property3, property4, property5,
            ];
            let _properties = StockHistoryParams::parse_properties(&props)
                .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

            // Validate stock symbol (basic validation)
            if stock.is_empty() {
                return Err(RunErrorMsg::InvalidArgument.with_span(span));
            }

            // This formula should never reach here during normal execution.
            // The run_formula function intercepts STOCKHISTORY calls and handles them
            // asynchronously via the connection callback with ConnectionKind::StockHistory.
            //
            // If we reach here, it means the callback was not set up.
            return Err(RunErrorMsg::Unimplemented(
                "STOCKHISTORY callback not configured. This may happen in environments \
                 where the financial data service is not available."
                    .into(),
            )
            .with_span(span));

            // Unreachable, but needed for type inference
            #[allow(unreachable_code)]
            CellValue::Blank
        }
    )]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_stock_history_formula() {
        assert!(is_stock_history_formula(
            "STOCKHISTORY(\"AAPL\", \"2025-01-01\")"
        ));
        assert!(is_stock_history_formula(
            "stockhistory(\"AAPL\", \"2025-01-01\")"
        ));
        assert!(is_stock_history_formula(
            "  STOCKHISTORY(\"AAPL\", \"2025-01-01\")"
        ));
        // With = prefix (how formulas are stored)
        assert!(is_stock_history_formula(
            "=STOCKHISTORY(\"AAPL\", \"2025-01-01\")"
        ));
        assert!(is_stock_history_formula(
            "= STOCKHISTORY(\"AAPL\", \"2025-01-01\")"
        ));
        assert!(!is_stock_history_formula("SUM(A1:A10)"));
        assert!(!is_stock_history_formula("=SUM(A1:A10)"));
        assert!(!is_stock_history_formula(
            "A1 + STOCKHISTORY(\"AAPL\", \"2025-01-01\")"
        ));
    }

    #[test]
    fn test_stock_interval_conversion() {
        assert_eq!(StockInterval::try_from(0), Ok(StockInterval::Daily));
        assert_eq!(StockInterval::try_from(1), Ok(StockInterval::Weekly));
        assert_eq!(StockInterval::try_from(2), Ok(StockInterval::Monthly));
        assert!(StockInterval::try_from(3).is_err());
        assert!(StockInterval::try_from(-1).is_err());
    }

    #[test]
    fn test_stock_headers_conversion() {
        assert_eq!(StockHeaders::try_from(0), Ok(StockHeaders::NoHeaders));
        assert_eq!(StockHeaders::try_from(1), Ok(StockHeaders::ShowHeaders));
        assert_eq!(
            StockHeaders::try_from(2),
            Ok(StockHeaders::ShowIdentifierAndHeaders)
        );
        assert!(StockHeaders::try_from(3).is_err());
    }

    #[test]
    fn test_stock_property_conversion() {
        assert_eq!(StockProperty::try_from(0), Ok(StockProperty::Date));
        assert_eq!(StockProperty::try_from(1), Ok(StockProperty::Close));
        assert_eq!(StockProperty::try_from(2), Ok(StockProperty::Open));
        assert_eq!(StockProperty::try_from(3), Ok(StockProperty::High));
        assert_eq!(StockProperty::try_from(4), Ok(StockProperty::Low));
        assert_eq!(StockProperty::try_from(5), Ok(StockProperty::Volume));
        assert!(StockProperty::try_from(6).is_err());
    }

    #[test]
    fn test_parse_properties_default() {
        // No properties specified - should default to Date and Close
        let props = StockHistoryParams::parse_properties(&[]).unwrap();
        assert_eq!(props, vec![StockProperty::Date, StockProperty::Close]);
    }

    #[test]
    fn test_parse_properties_custom() {
        // Custom properties
        let props =
            StockHistoryParams::parse_properties(&[Some(0), Some(2), Some(1), None, None, None])
                .unwrap();
        assert_eq!(
            props,
            vec![
                StockProperty::Date,
                StockProperty::Open,
                StockProperty::Close
            ]
        );
    }

    #[test]
    fn test_stock_interval_api_frequency() {
        assert_eq!(StockInterval::Daily.to_api_frequency(), "daily");
        assert_eq!(StockInterval::Weekly.to_api_frequency(), "weekly");
        assert_eq!(StockInterval::Monthly.to_api_frequency(), "monthly");
    }

    #[test]
    fn test_parse_stock_history_formula() {
        // Basic call
        let result = parse_stock_history_formula("STOCKHISTORY(\"AAPL\", \"2025-01-01\")");
        assert!(result.is_some());
        let params = result.unwrap();
        assert_eq!(params.stock, "AAPL");
        assert_eq!(params.start_date, "2025-01-01");
        assert_eq!(params.end_date, "2025-01-01"); // defaults to start_date

        // With = prefix (how formulas are stored)
        let result = parse_stock_history_formula("=STOCKHISTORY(\"AAPL\", \"2025-01-01\")");
        assert!(result.is_some());
        let params = result.unwrap();
        assert_eq!(params.stock, "AAPL");

        // With = prefix and whitespace
        let result = parse_stock_history_formula("= STOCKHISTORY(\"AAPL\", \"2025-01-01\")");
        assert!(result.is_some());

        // Multi-line formula (how formulas are often entered in the UI)
        let result = parse_stock_history_formula(
            "=STOCKHISTORY(\"AAPL\",\n    \"2025-01-01\",\n    \"2026-01-31\")",
        );
        assert!(result.is_some());
        let params = result.unwrap();
        assert_eq!(params.stock, "AAPL");
        assert_eq!(params.start_date, "2025-01-01");
        assert_eq!(params.end_date, "2026-01-31");

        // With end date
        let result =
            parse_stock_history_formula("STOCKHISTORY(\"MSFT\", \"2025-01-01\", \"2025-01-31\")");
        assert!(result.is_some());
        let params = result.unwrap();
        assert_eq!(params.stock, "MSFT");
        assert_eq!(params.end_date, "2025-01-31");

        // With interval
        let result = parse_stock_history_formula(
            "STOCKHISTORY(\"GOOG\", \"2025-01-01\", \"2025-01-31\", 1)",
        );
        assert!(result.is_some());
        let params = result.unwrap();
        assert_eq!(params.interval, StockInterval::Weekly);

        // With all options
        let result = parse_stock_history_formula(
            "STOCKHISTORY(\"TSLA\", \"2025-01-01\", \"2025-01-31\", 2, 0, 0, 1, 5)",
        );
        assert!(result.is_some());
        let params = result.unwrap();
        assert_eq!(params.interval, StockInterval::Monthly);
        assert_eq!(params.headers, StockHeaders::NoHeaders);
        assert_eq!(
            params.properties,
            vec![
                StockProperty::Date,
                StockProperty::Close,
                StockProperty::Volume
            ]
        );
    }

    #[test]
    fn test_split_args() {
        let args = split_args("\"AAPL\", \"2025-01-01\"");
        assert_eq!(args.len(), 2);
        assert_eq!(args[0], "\"AAPL\"");
        assert_eq!(args[1], " \"2025-01-01\"");

        let args = split_args("\"AAPL\", \"2025-01-01\", \"2025-01-31\", 0, 1");
        assert_eq!(args.len(), 5);
    }

    #[test]
    fn test_parse_string_arg() {
        assert_eq!(parse_string_arg("\"AAPL\""), Some("AAPL".to_string()));
        assert_eq!(parse_string_arg("'MSFT'"), Some("MSFT".to_string()));
        assert_eq!(parse_string_arg("  \"GOOG\"  "), Some("GOOG".to_string()));
        assert_eq!(parse_string_arg("123"), None);
    }

    #[test]
    fn test_process_stock_history_response() {
        let json_data = serde_json::json!({
            "stock_prices": [
                {
                    "date": "2025-01-02",
                    "close": 150.0,
                    "open": 148.0,
                    "high": 152.0,
                    "low": 147.0,
                    "volume": 1000000
                },
                {
                    "date": "2025-01-03",
                    "close": 155.0,
                    "open": 150.0,
                    "high": 157.0,
                    "low": 149.0,
                    "volume": 1200000
                }
            ]
        });

        let result = process_stock_history_response(
            &json_data,
            StockHeaders::ShowHeaders,
            &[StockProperty::Date, StockProperty::Close],
        );

        assert!(result.is_ok());
        let array = result.unwrap();

        assert_eq!(array.width(), 2);
        assert_eq!(array.height(), 3); // 1 header row + 2 data rows

        // Check headers
        assert_eq!(array.get(0, 0), Ok(&CellValue::Text("Date".to_string())));
        assert_eq!(array.get(1, 0), Ok(&CellValue::Text("Close".to_string())));

        // Check data (most recent first, as returned by API)
        assert_eq!(
            array.get(0, 1),
            Ok(&CellValue::Text("2025-01-02".to_string()))
        );
    }

    #[test]
    fn test_process_stock_history_json() {
        let json_data = serde_json::json!({
            "stock_prices": [
                {
                    "date": "2025-01-02",
                    "close": 150.0,
                    "open": 148.0,
                    "high": 152.0,
                    "low": 147.0,
                    "volume": 1000000
                }
            ]
        });

        let result = process_stock_history_json(
            &json_data,
            "STOCKHISTORY(\"AAPL\", \"2025-01-02\", \"2025-01-02\", 0, 1, 0, 1)",
        );

        assert!(result.is_ok());
        let array = result.unwrap();
        assert_eq!(array.width(), 2); // Date and Close
        assert_eq!(array.height(), 2); // 1 header + 1 data row
    }

    #[test]
    fn test_from_evaluated_args_with_literals() {
        use crate::controller::GridController;
        use crate::formulas::{Ctx, ast::AstNodeContents, parse_formula};

        let gc = GridController::new();
        let pos = gc.grid().origin_in_first_sheet();
        let mut ctx = Ctx::new(&gc, pos);

        // Parse a STOCKHISTORY formula with literal arguments
        let parsed = parse_formula(
            "STOCKHISTORY(\"AAPL\", \"2025-01-01\", \"2025-01-31\", 1, 0)",
            gc.a1_context(),
            pos,
        )
        .unwrap();

        // Extract arguments from AST
        if let AstNodeContents::FunctionCall { args, .. } = &parsed.ast.inner {
            let params = StockHistoryParams::from_evaluated_args(args, &mut ctx);
            assert!(params.is_some());
            let params = params.unwrap();

            assert_eq!(params.stock, "AAPL");
            assert_eq!(params.start_date, "2025-01-01");
            assert_eq!(params.end_date, "2025-01-31");
            assert_eq!(params.interval, StockInterval::Weekly);
            assert_eq!(params.headers, StockHeaders::NoHeaders);
        } else {
            panic!("Expected FunctionCall AST node");
        }
    }

    #[test]
    fn test_from_evaluated_args_with_expressions() {
        use crate::controller::GridController;
        use crate::formulas::{Ctx, ast::AstNodeContents, parse_formula};

        let gc = GridController::new();
        let pos = gc.grid().origin_in_first_sheet();
        let mut ctx = Ctx::new(&gc, pos);

        // Parse a STOCKHISTORY formula with CONCAT expression for stock symbol
        let parsed = parse_formula(
            "STOCKHISTORY(CONCAT(\"GO\", \"OG\"), \"2025-03-01\")",
            gc.a1_context(),
            pos,
        )
        .unwrap();

        // Extract arguments from AST
        if let AstNodeContents::FunctionCall { args, .. } = &parsed.ast.inner {
            let params = StockHistoryParams::from_evaluated_args(args, &mut ctx);
            assert!(params.is_some());
            let params = params.unwrap();

            assert_eq!(params.stock, "GOOG");
            assert_eq!(params.start_date, "2025-03-01");
            assert_eq!(params.end_date, "2025-03-01"); // defaults to start_date
        } else {
            panic!("Expected FunctionCall AST node");
        }
    }

    /// Test cell references in STOCKHISTORY arguments.
    #[test]
    fn test_from_evaluated_args_with_cell_references() {
        use crate::SheetPos;
        use crate::controller::GridController;
        use crate::formulas::{Ctx, ast::AstNodeContents, parse_formula};

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Formula will be "evaluated" from E1 (x=5, y=1) to avoid circular ref issues
        let formula_pos = SheetPos {
            x: 5,
            y: 1,
            sheet_id,
        };

        // Set cell values: A1 = "MSFT", B1 = "2025-02-01", C1 = "2025-02-28"
        // Note: Formula parser uses 1-based coordinates (A1 = (1,1), B1 = (2,1), etc.)
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "MSFT".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            SheetPos {
                x: 2,
                y: 1,
                sheet_id,
            },
            "2025-02-01".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            SheetPos {
                x: 3,
                y: 1,
                sheet_id,
            },
            "2025-02-28".to_string(),
            None,
            false,
        );

        let mut ctx = Ctx::new(&gc, formula_pos);

        // Parse a STOCKHISTORY formula with cell references
        let parsed =
            parse_formula("STOCKHISTORY(A1, B1, C1)", gc.a1_context(), formula_pos).unwrap();

        if let AstNodeContents::FunctionCall { args, .. } = &parsed.ast.inner {
            let params = StockHistoryParams::from_evaluated_args(args, &mut ctx);
            assert!(params.is_some(), "params should be Some");
            let params = params.unwrap();

            assert_eq!(params.stock, "MSFT");
            assert_eq!(params.start_date, "2025-02-01");
            assert_eq!(params.end_date, "2025-02-28");
        } else {
            panic!("Expected FunctionCall AST node");
        }
    }

    #[test]
    fn test_from_evaluated_args_invalid_returns_none() {
        use crate::controller::GridController;
        use crate::formulas::{Ctx, ast::AstNodeContents, parse_formula};

        let gc = GridController::new();
        let pos = gc.grid().origin_in_first_sheet();
        let mut ctx = Ctx::new(&gc, pos);

        // Empty stock symbol
        let parsed =
            parse_formula("STOCKHISTORY(\"\", \"2025-01-01\")", gc.a1_context(), pos).unwrap();
        if let AstNodeContents::FunctionCall { args, .. } = &parsed.ast.inner {
            assert!(StockHistoryParams::from_evaluated_args(args, &mut ctx).is_none());
        }

        // Invalid date format
        let parsed =
            parse_formula("STOCKHISTORY(\"AAPL\", \"invalid\")", gc.a1_context(), pos).unwrap();
        if let AstNodeContents::FunctionCall { args, .. } = &parsed.ast.inner {
            assert!(StockHistoryParams::from_evaluated_args(args, &mut ctx).is_none());
        }

        // Missing required arguments (only stock, no date)
        let parsed = parse_formula("STOCKHISTORY(\"AAPL\")", gc.a1_context(), pos).unwrap();
        if let AstNodeContents::FunctionCall { args, .. } = &parsed.ast.inner {
            assert!(StockHistoryParams::from_evaluated_args(args, &mut ctx).is_none());
        }

        // Number instead of string for stock
        let parsed =
            parse_formula("STOCKHISTORY(123, \"2025-01-01\")", gc.a1_context(), pos).unwrap();
        if let AstNodeContents::FunctionCall { args, .. } = &parsed.ast.inner {
            assert!(StockHistoryParams::from_evaluated_args(args, &mut ctx).is_none());
        }
    }
}

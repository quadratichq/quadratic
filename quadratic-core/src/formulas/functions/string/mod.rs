//! String manipulation and conversion functions for formulas.

mod conversion;
mod manipulation;

use chrono::{Datelike, Timelike};
use rust_decimal::prelude::ToPrimitive;
use smallvec::SmallVec;

use super::*;
use crate::ArraySize;
use crate::number::decimal_from_str;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "String functions",
    docs: None,
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    [manipulation::get_functions(), conversion::get_functions()]
        .into_iter()
        .flatten()
        .collect()
}

// ============================================================================
// Shared helper functions
// ============================================================================

pub(crate) fn unicode(span: Span, s: String) -> CodeResult<u32> {
    match s.chars().next() {
        Some(c) => Ok(c as u32),
        None => Err(RunErrorMsg::InvalidArgument.with_span(span)),
    }
}

pub(crate) fn unichar(span: Span, code_point: u32) -> CodeResult<char> {
    char::from_u32(code_point)
        .filter(|&c| c != '\0')
        .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))
}

pub(crate) fn try_i64_to_usize(Spanned { span, inner: n }: Spanned<i64>) -> CodeResult<usize> {
    usize::try_from(n).map_err(|_| RunErrorMsg::InvalidArgument.with_span(span))
}

pub(crate) fn try_i64_minus_1_to_usize(value: Spanned<i64>) -> CodeResult<usize> {
    try_i64_to_usize(value.map(|n| i64::saturating_sub(n, 1)))
}

pub(crate) fn floor_char_boundary(s: &str, mut byte_index: usize) -> usize {
    if byte_index >= s.len() {
        s.len()
    } else {
        while !s.is_char_boundary(byte_index) {
            byte_index -= 1;
        }
        byte_index
    }
}

pub(crate) fn ceil_char_boundary(s: &str, mut byte_index: usize) -> usize {
    if byte_index >= s.len() {
        s.len()
    } else {
        while !s.is_char_boundary(byte_index) {
            byte_index += 1;
        }
        byte_index
    }
}

pub(crate) fn first_char_of_nonempty_string(
    arg: &Option<Spanned<String>>,
) -> CodeResult<Option<char>> {
    match arg {
        Some(s) => {
            Ok(Some(s.inner.chars().next().ok_or_else(|| {
                RunErrorMsg::InvalidArgument.with_span(s.span)
            })?))
        }
        None => Ok(None),
    }
}

/// Converts full-width katakana to half-width.
pub(crate) fn full_to_half_katakana(c: char) -> Option<char> {
    match c {
        'ァ' => Some('ｧ'),
        'ア' => Some('ｱ'),
        'ィ' => Some('ｨ'),
        'イ' => Some('ｲ'),
        'ゥ' => Some('ｩ'),
        'ウ' => Some('ｳ'),
        'ェ' => Some('ｪ'),
        'エ' => Some('ｴ'),
        'ォ' => Some('ｫ'),
        'オ' => Some('ｵ'),
        'カ' => Some('ｶ'),
        'キ' => Some('ｷ'),
        'ク' => Some('ｸ'),
        'ケ' => Some('ｹ'),
        'コ' => Some('ｺ'),
        'サ' => Some('ｻ'),
        'シ' => Some('ｼ'),
        'ス' => Some('ｽ'),
        'セ' => Some('ｾ'),
        'ソ' => Some('ｿ'),
        'タ' => Some('ﾀ'),
        'チ' => Some('ﾁ'),
        'ツ' => Some('ﾂ'),
        'テ' => Some('ﾃ'),
        'ト' => Some('ﾄ'),
        'ナ' => Some('ﾅ'),
        'ニ' => Some('ﾆ'),
        'ヌ' => Some('ﾇ'),
        'ネ' => Some('ﾈ'),
        'ノ' => Some('ﾉ'),
        'ハ' => Some('ﾊ'),
        'ヒ' => Some('ﾋ'),
        'フ' => Some('ﾌ'),
        'ヘ' => Some('ﾍ'),
        'ホ' => Some('ﾎ'),
        'マ' => Some('ﾏ'),
        'ミ' => Some('ﾐ'),
        'ム' => Some('ﾑ'),
        'メ' => Some('ﾒ'),
        'モ' => Some('ﾓ'),
        'ヤ' => Some('ﾔ'),
        'ユ' => Some('ﾕ'),
        'ヨ' => Some('ﾖ'),
        'ラ' => Some('ﾗ'),
        'リ' => Some('ﾘ'),
        'ル' => Some('ﾙ'),
        'レ' => Some('ﾚ'),
        'ロ' => Some('ﾛ'),
        'ワ' => Some('ﾜ'),
        'ヲ' => Some('ｦ'),
        'ン' => Some('ﾝ'),
        'ー' => Some('ｰ'),
        '゛' => Some('ﾞ'),
        '゜' => Some('ﾟ'),
        _ => None,
    }
}

/// Converts half-width katakana to full-width.
pub(crate) fn half_to_full_katakana(c: char) -> Option<char> {
    match c {
        'ｧ' => Some('ァ'),
        'ｱ' => Some('ア'),
        'ｨ' => Some('ィ'),
        'ｲ' => Some('イ'),
        'ｩ' => Some('ゥ'),
        'ｳ' => Some('ウ'),
        'ｪ' => Some('ェ'),
        'ｴ' => Some('エ'),
        'ｫ' => Some('ォ'),
        'ｵ' => Some('オ'),
        'ｶ' => Some('カ'),
        'ｷ' => Some('キ'),
        'ｸ' => Some('ク'),
        'ｹ' => Some('ケ'),
        'ｺ' => Some('コ'),
        'ｻ' => Some('サ'),
        'ｼ' => Some('シ'),
        'ｽ' => Some('ス'),
        'ｾ' => Some('セ'),
        'ｿ' => Some('ソ'),
        'ﾀ' => Some('タ'),
        'ﾁ' => Some('チ'),
        'ﾂ' => Some('ツ'),
        'ﾃ' => Some('テ'),
        'ﾄ' => Some('ト'),
        'ﾅ' => Some('ナ'),
        'ﾆ' => Some('ニ'),
        'ﾇ' => Some('ヌ'),
        'ﾈ' => Some('ネ'),
        'ﾉ' => Some('ノ'),
        'ﾊ' => Some('ハ'),
        'ﾋ' => Some('ヒ'),
        'ﾌ' => Some('フ'),
        'ﾍ' => Some('ヘ'),
        'ﾎ' => Some('ホ'),
        'ﾏ' => Some('マ'),
        'ﾐ' => Some('ミ'),
        'ﾑ' => Some('ム'),
        'ﾒ' => Some('メ'),
        'ﾓ' => Some('モ'),
        'ﾔ' => Some('ヤ'),
        'ﾕ' => Some('ユ'),
        'ﾖ' => Some('ヨ'),
        'ﾗ' => Some('ラ'),
        'ﾘ' => Some('リ'),
        'ﾙ' => Some('ル'),
        'ﾚ' => Some('レ'),
        'ﾛ' => Some('ロ'),
        'ﾜ' => Some('ワ'),
        'ｦ' => Some('ヲ'),
        'ﾝ' => Some('ン'),
        'ｰ' => Some('ー'),
        'ﾞ' => Some('゛'),
        'ﾟ' => Some('゜'),
        _ => None,
    }
}

/// Format a date/time value using the given pattern.
pub(crate) fn format_date_time(value: &CellValue, pattern: &str) -> CodeResult<String> {
    match value {
        CellValue::Date(d) => {
            let mut result = pattern.to_string();
            result = result.replace("yyyy", &format!("{:04}", d.year()));
            result = result.replace("yy", &format!("{:02}", d.year() % 100));
            result = result.replace("mmmm", &month_name(d.month()));
            result = result.replace("mmm", &month_abbrev(d.month()));
            result = result.replace("mm", &format!("{:02}", d.month()));
            result = result.replace("dddd", &weekday_name(d.weekday()));
            result = result.replace("ddd", &weekday_abbrev(d.weekday()));
            result = result.replace("dd", &format!("{:02}", d.day()));
            Ok(result)
        }
        CellValue::DateTime(dt) => {
            let d = dt.date();
            let t = dt.time();
            let mut result = pattern.to_string();
            result = result.replace("yyyy", &format!("{:04}", d.year()));
            result = result.replace("yy", &format!("{:02}", d.year() % 100));
            result = result.replace("mmmm", &month_name(d.month()));
            result = result.replace("mmm", &month_abbrev(d.month()));
            result = result.replace("mm", &format!("{:02}", d.month()));
            result = result.replace("dddd", &weekday_name(d.weekday()));
            result = result.replace("ddd", &weekday_abbrev(d.weekday()));
            result = result.replace("dd", &format!("{:02}", d.day()));

            let hour = t.hour();
            let is_pm = hour >= 12;
            let hour_12 = if hour == 0 {
                12
            } else if hour > 12 {
                hour - 12
            } else {
                hour
            };

            if pattern.to_lowercase().contains("am") || pattern.to_lowercase().contains("pm") {
                result = result.replace("hh", &format!("{:02}", hour_12));
                result = result.replace("AM/PM", if is_pm { "PM" } else { "AM" });
                result = result.replace("am/pm", if is_pm { "pm" } else { "am" });
            } else {
                result = result.replace("hh", &format!("{:02}", hour));
            }
            result = result.replace("mm", &format!("{:02}", t.minute()));
            result = result.replace("ss", &format!("{:02}", t.second()));
            Ok(result)
        }
        CellValue::Time(t) => {
            let mut result = pattern.to_string();
            let hour = t.hour();
            let is_pm = hour >= 12;
            let hour_12 = if hour == 0 {
                12
            } else if hour > 12 {
                hour - 12
            } else {
                hour
            };

            if pattern.to_lowercase().contains("am") || pattern.to_lowercase().contains("pm") {
                result = result.replace("hh", &format!("{:02}", hour_12));
                result = result.replace("AM/PM", if is_pm { "PM" } else { "AM" });
                result = result.replace("am/pm", if is_pm { "pm" } else { "am" });
            } else {
                result = result.replace("hh", &format!("{:02}", hour));
            }
            result = result.replace("mm", &format!("{:02}", t.minute()));
            result = result.replace("ss", &format!("{:02}", t.second()));
            Ok(result)
        }
        CellValue::Number(n) => {
            let days = n.to_i64().unwrap_or(0);
            if days >= 1 {
                use chrono::NaiveDate;
                if let Some(date) = NaiveDate::from_ymd_opt(1899, 12, 30)
                    .and_then(|d| d.checked_add_days(chrono::Days::new(days as u64)))
                {
                    let temp_value = CellValue::Date(date);
                    return format_date_time(&temp_value, pattern);
                }
            }
            Ok(value.to_display())
        }
        _ => Ok(value.to_display()),
    }
}

fn month_name(month: u32) -> String {
    match month {
        1 => "January",
        2 => "February",
        3 => "March",
        4 => "April",
        5 => "May",
        6 => "June",
        7 => "July",
        8 => "August",
        9 => "September",
        10 => "October",
        11 => "November",
        12 => "December",
        _ => "",
    }
    .to_string()
}

fn month_abbrev(month: u32) -> String {
    match month {
        1 => "Jan",
        2 => "Feb",
        3 => "Mar",
        4 => "Apr",
        5 => "May",
        6 => "Jun",
        7 => "Jul",
        8 => "Aug",
        9 => "Sep",
        10 => "Oct",
        11 => "Nov",
        12 => "Dec",
        _ => "",
    }
    .to_string()
}

fn weekday_name(weekday: chrono::Weekday) -> String {
    match weekday {
        chrono::Weekday::Mon => "Monday",
        chrono::Weekday::Tue => "Tuesday",
        chrono::Weekday::Wed => "Wednesday",
        chrono::Weekday::Thu => "Thursday",
        chrono::Weekday::Fri => "Friday",
        chrono::Weekday::Sat => "Saturday",
        chrono::Weekday::Sun => "Sunday",
    }
    .to_string()
}

fn weekday_abbrev(weekday: chrono::Weekday) -> String {
    match weekday {
        chrono::Weekday::Mon => "Mon",
        chrono::Weekday::Tue => "Tue",
        chrono::Weekday::Wed => "Wed",
        chrono::Weekday::Thu => "Thu",
        chrono::Weekday::Fri => "Fri",
        chrono::Weekday::Sat => "Sat",
        chrono::Weekday::Sun => "Sun",
    }
    .to_string()
}

/// Returns text after a delimiter.
pub(crate) fn text_after<'a>(
    text: &'a str,
    delimiter: &str,
    instance: i64,
    case_insensitive: bool,
    match_end_as_delim: bool,
) -> Option<&'a str> {
    if delimiter.is_empty() {
        return Some(text);
    }

    let text_for_search = if case_insensitive {
        text.to_lowercase()
    } else {
        text.to_string()
    };
    let delim_for_search = if case_insensitive {
        delimiter.to_lowercase()
    } else {
        delimiter.to_string()
    };

    let positions: Vec<usize> = text_for_search
        .match_indices(&delim_for_search)
        .map(|(i, _)| i)
        .collect();

    if positions.is_empty() {
        if match_end_as_delim && instance == 1 {
            return Some("");
        }
        return None;
    }

    let index = if instance > 0 {
        (instance - 1) as usize
    } else {
        let abs_instance = (-instance) as usize;
        if abs_instance > positions.len() {
            return None;
        }
        positions.len() - abs_instance
    };

    if index >= positions.len() {
        if match_end_as_delim {
            return Some("");
        }
        return None;
    }

    let pos = positions[index];
    Some(&text[pos + delimiter.len()..])
}

/// Returns text before a delimiter.
pub(crate) fn text_before<'a>(
    text: &'a str,
    delimiter: &str,
    instance: i64,
    case_insensitive: bool,
    match_start_as_delim: bool,
) -> Option<&'a str> {
    if delimiter.is_empty() {
        return Some(text);
    }

    let text_for_search = if case_insensitive {
        text.to_lowercase()
    } else {
        text.to_string()
    };
    let delim_for_search = if case_insensitive {
        delimiter.to_lowercase()
    } else {
        delimiter.to_string()
    };

    let positions: Vec<usize> = text_for_search
        .match_indices(&delim_for_search)
        .map(|(i, _)| i)
        .collect();

    if positions.is_empty() {
        if match_start_as_delim && instance == 1 {
            return Some("");
        }
        return None;
    }

    let index = if instance > 0 {
        (instance - 1) as usize
    } else {
        let abs_instance = (-instance) as usize;
        if abs_instance > positions.len() {
            return None;
        }
        positions.len() - abs_instance
    };

    if index >= positions.len() {
        if match_start_as_delim {
            return Some("");
        }
        return None;
    }

    let pos = positions[index];
    Some(&text[..pos])
}

/// Splits text while keeping track of original positions (for case-insensitive splitting).
pub(crate) fn split_keeping_positions<'a>(
    original: &'a str,
    lowercase: &str,
    delimiter: &str,
    ignore_empty: bool,
) -> Vec<&'a str> {
    if delimiter.is_empty() {
        return vec![original];
    }

    let mut result = Vec::new();
    let mut last_end = 0;

    for (pos, _) in lowercase.match_indices(delimiter) {
        let part = &original[last_end..pos];
        if !ignore_empty || !part.is_empty() {
            result.push(part);
        }
        last_end = pos + delimiter.len();
    }

    let remaining = &original[last_end..];
    if !ignore_empty || !remaining.is_empty() {
        result.push(remaining);
    }

    result
}

/// Parses a text string as a number.
pub(crate) fn parse_value_text(s: &str) -> Option<f64> {
    let s = s.trim();

    if s.is_empty() {
        return Some(0.0);
    }

    if let Ok(n) = s.parse::<f64>() {
        return Some(n);
    }

    if s.ends_with('%') {
        let num_part = s.trim_end_matches('%').trim();
        if let Ok(n) = num_part.parse::<f64>() {
            return Some(n / 100.0);
        }
        let cleaned: String = num_part.chars().filter(|&c| c != ',').collect();
        if let Ok(n) = cleaned.parse::<f64>() {
            return Some(n / 100.0);
        }
    }

    let cleaned: String = s
        .chars()
        .filter(|&c| c.is_ascii_digit() || c == '.' || c == '-' || c == '+')
        .collect();

    if let Ok(n) = cleaned.parse::<f64>() {
        if s.starts_with('(') && s.ends_with(')') {
            return Some(-n);
        }
        if (s.starts_with('-') || s.contains("-$") || s.contains("-€"))
            && n > 0.0
            && !cleaned.starts_with('-')
        {
            return Some(-n);
        }
        return Some(n);
    }

    if let Ok(d) = decimal_from_str(s) {
        return d.to_f64();
    }

    None
}

use crate::grid::SheetId;
use std::collections::HashMap;

use super::A1Error;

pub type SheetNameIdMap = HashMap<String, SheetId>;

/// Gets the sheet name from an a1 string if present: either a string without
/// spaces followed by '!', or a string in single quotes followed by '!'.
pub(crate) fn simple_sheet_name<'a>(a1: &'a str) -> Result<(&'a str, Option<String>), A1Error> {
    let sheet_name_end = match a1.find('!') {
        Some(end) => end,
        None => return Ok((a1, None)),
    };
    let (sheet_name, remaining) = a1.split_at(sheet_name_end);

    let sheet_name = if sheet_name.starts_with('\'') && sheet_name.ends_with('\'') {
        // Remove single quotes if present
        &sheet_name[1..sheet_name.len() - 1]
    } else if sheet_name.contains(' ') {
        return Err(A1Error::InvalidSheetNameMissingQuotes(
            sheet_name.to_string(),
        ));
    } else {
        sheet_name
    };

    if remaining[1..].contains('!') {
        return Err(A1Error::InvalidSheetNameMissingQuotes(a1.to_string()));
    }

    Ok((&remaining[1..], Some(sheet_name.to_string())))
}

/// Gets the sheet name from an a1 string if present. Returns (the remaining
/// string, sheet name) or any error.
pub(crate) fn try_sheet_name<'a>(
    a1: &'a str,
    sheet_id: SheetId,
    sheet_name_id: &SheetNameIdMap,
) -> Result<(&'a str, Option<SheetId>), A1Error> {
    let (remaining, Some(sheet_name)) = simple_sheet_name(a1)? else {
        return Ok((a1, None));
    };

    let parsed_sheet_id = sheet_name_id
        .iter()
        .find(|(name, _)| name.to_lowercase() == sheet_name.to_lowercase())
        .map(|(_, id)| id)
        .copied()
        .ok_or_else(|| A1Error::InvalidSheetName(sheet_name.to_string()))?;

    if parsed_sheet_id == sheet_id {
        Ok((&remaining[1..], None))
    } else {
        Ok((&remaining[1..], Some(parsed_sheet_id)))
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use super::*;

    #[test]
    #[parallel]
    fn test_simple_sheet_name() {
        assert_eq!(
            simple_sheet_name("Sheet1!A1"),
            Ok(("A1", Some("Sheet1".to_string())))
        );
        assert_eq!(
            simple_sheet_name("'Sheet 1'!A1"),
            Ok(("A1", Some("Sheet 1".to_string())))
        );
        assert_eq!(simple_sheet_name("A1"), Ok(("A1", None)));
        assert_eq!(
            simple_sheet_name("'Sheet with ! mark'!A1"),
            Ok(("A1", Some("Sheet with ! mark".to_string())))
        );
        assert_eq!(
            simple_sheet_name("Sheet 1!A1"),
            Err(A1Error::InvalidSheetNameMissingQuotes(
                "Sheet 1".to_string()
            ))
        );
        assert_eq!(
            simple_sheet_name("Sheet1!Sheet2!A1"),
            Err(A1Error::InvalidSheetNameMissingQuotes(
                "Sheet1!Sheet2!A1".to_string()
            ))
        );
        assert_eq!(
            simple_sheet_name("'Sheet1!A1"),
            Ok(("A1", Some("Sheet1".to_string())))
        );
        assert_eq!(
            simple_sheet_name("Sheet1'!A1"),
            Ok(("A1", Some("Sheet1'".to_string())))
        );
    }

    #[test]
    #[parallel]
    fn test_try_sheet_name() {
        let sheet_1 = SheetId::new();
        let sheet_2 = SheetId::new();
        let map = HashMap::from([
            ("Sheet1".to_string(), sheet_1),
            ("Sheet 2".to_string(), sheet_2),
        ]);
        assert_eq!(try_sheet_name("Sheet1!A1", sheet_1, &map), Ok(("A1", None)));
        assert_eq!(
            try_sheet_name("'Sheet 2'!A1", sheet_1, &map),
            Ok(("A1", Some(sheet_2)))
        );
        assert_eq!(try_sheet_name("A1", sheet_1, &map), Ok(("A1", None)));
        assert_eq!(
            try_sheet_name("Sheet1!A1:B2", sheet_1, &map),
            Ok(("A1:B2", None))
        );
        assert_eq!(
            try_sheet_name("Sheet1!Sheet2!A1", sheet_1, &map),
            Err(A1Error::InvalidSheetNameMissingQuotes(
                "Sheet1!Sheet2!A1".to_string()
            ))
        );
        assert_eq!(
            try_sheet_name("Sheet 1!A1", sheet_1, &map),
            Err(A1Error::InvalidSheetNameMissingQuotes(
                "Sheet 1".to_string()
            ))
        );
    }
}

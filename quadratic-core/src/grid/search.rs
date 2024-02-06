use std::str::FromStr;

use crate::SheetPos;

use super::{sheet::search::SearchOptions, Grid, SheetId};

impl Grid {
    pub fn search(&self, query: &String, options: Option<SearchOptions>) -> Vec<SheetPos> {
        let mut result = Vec::new();
        if options.all_sheets.is_some_and(|a| a) {
            for sheet in self.sheets() {
                let sheet_result = sheet.search(query, options);
                result.extend(sheet_result);
            }
        } else {
            if let Some(sheetId) = options
                .shee
                .as_ref()
                .map(|id| SheetId::from_str(&id).unwrap_or_default())
            {
                if let Some(sheet) = self.try_sheet(sheetId) {
                    let sheet_result = sheet.search(query, options);
                    result.extend(sheet_result);
                }
            }
        }
        result
    }
}

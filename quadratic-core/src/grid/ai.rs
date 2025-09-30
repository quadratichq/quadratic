//! AI tool calls to get data and formats from the grid.
//!
//! Note: these functions are optimized for fast data fetching, and not for
//! fewer tool calls. We page content based on the size of the rects within a
//! selection, regardless of the amount of content w/in the rect. An alternative
//! approach would be to page it based on actual content returned. This has the
//! downside of drastically slowing queries as the page number increases, since
//! you'd have to fetch all content to find the proper page number.
//!
//! There are probably some alternate approaches, but it is difficult to keep
//! track of last page number, and the last content checked, especially since we
//! support arbitrary selections.

use crate::{
    Rect,
    a1::{A1Error, A1Selection},
    controller::GridController,
    grid::js_types::{JsCellValueRanges, JsGetAICellResult},
};

use super::GridBounds;

const MAX_POTENTIAL_CELLS_PER_PAGE: u32 = 1000;
const MAXIMUM_PAGES: u32 = 5;

impl GridController {
    /// Breaks up a rect into pages, based on the number of cells per page.
    fn breakup_rect_into_pages(rect: Rect, mut count: u32, max: u32) -> (Vec<Rect>, u32) {
        let mut pages = Vec::new();
        let rows_per_page = max / rect.width();
        let mut rows: u32 = 0;
        let mut row_start = rect.min.y as u32;
        while rows < rect.height() {
            let mut rows_this_page = rows_per_page.min(rect.height() - rows);

            // adjust the rows per page if we still have a starting count
            if count != 0 && rows_per_page > 1 {
                while rows_this_page > 1 && count != 0 {
                    rows_this_page -= 1;
                    count -= rect.width();
                }
            }
            pages.push(Rect::new(
                rect.min.x,
                row_start as i64,
                rect.max.x,
                (row_start + rows_this_page - 1) as i64,
            ));
            rows += rows_this_page;
            row_start += rows_this_page;
        }
        (pages, count)
    }

    /// Returns the rendered values of the cells in a given rect.
    pub(crate) fn get_ai_cells(
        &self,
        selection: A1Selection,
        mut page: u32,
    ) -> Result<JsGetAICellResult, A1Error> {
        let mut count = 0;
        let mut in_page = 0;
        let mut values = Vec::new();

        if let Some(sheet) = self.try_sheet(selection.sheet_id)
            && let GridBounds::NonEmpty(bounds) = sheet.bounds(true)
        {
            let total_range = selection.to_string(None, self.a1_context());
            for range in &selection.ranges {
                if let Some(rect) = range.as_rect(self.a1_context())
                    && let Some(rect) = rect.intersection(&bounds)
                {
                    let (rects, new_count) =
                        Self::breakup_rect_into_pages(rect, count, MAX_POTENTIAL_CELLS_PER_PAGE);
                    count = new_count;
                    for rect in rects {
                        if page == in_page {
                            if sheet.has_content_in_rect(rect) {
                                let value = JsCellValueRanges {
                                    total_range: total_range.clone(),
                                    range: rect.a1_string(),
                                    values: Some(sheet.cells_as_string(rect)),
                                };
                                values.push(value);
                            } else {
                                page += 1;
                            }
                        }
                        count += rect.width() * rect.height();
                        if count >= MAX_POTENTIAL_CELLS_PER_PAGE {
                            in_page += 1;
                            count = 0;
                        }
                    }
                }
            }
        }

        Ok(JsGetAICellResult {
            selection: selection.to_string(None, self.a1_context()),
            page: page as i32,
            total_pages: in_page as i32,
            values,
        })
    }

    /// Returns the rendered formats of the cells in a given rect.
    pub(crate) fn get_ai_cell_formats(
        &self,
        selection: A1Selection,
        page: u32,
    ) -> Result<String, A1Error> {
        let mut count = 0;
        let mut in_page = 0;
        let mut formats = Vec::new();
        let mut has_content = false;
        for range in &selection.ranges {
            if let Some(sheet) = self.try_sheet(selection.sheet_id) {
                // we use the bounds to limit the number of cells we need to check
                if let Some(bounds) = sheet.format_bounds().into()
                    && let Some(rect) = range.as_rect(self.a1_context())
                    && let Some(rect) = rect.intersection(&bounds)
                {
                    let (rects, new_count) =
                        Self::breakup_rect_into_pages(rect, count, MAX_POTENTIAL_CELLS_PER_PAGE);
                    count = new_count;
                    for rect in rects {
                        if page == in_page {
                            formats.extend(sheet.cell_formats_as_string(rect));
                            has_content = true;
                        }
                        count += rect.width() * rect.height();
                        if count >= MAX_POTENTIAL_CELLS_PER_PAGE {
                            in_page += 1;
                            count = 0;
                        }
                    }
                }
            }
        }
        if !has_content {
            return Ok(format!(
                "The selection {} has no formats.",
                selection.to_string(None, self.a1_context())
            ));
        }
        let mut result = String::new();
        if in_page > MAXIMUM_PAGES {
            result.push_str(&format!("IMPORTANT: There are {} pages in this result. Let the user know that there is a lot of data and it will take quite a while to process all the pages of data. Suggest ways they can work around this. You can still get additional pages by passing page = {} to this tool. After performing an operation on this data, you MUST use this tool again to get additional pages of data.\n\n",
                in_page + 1,
                page + 1,
            ));
        } else if in_page != page {
            result.push_str(&format!(
                "IMPORTANT: There are {} pages in this result. Use this tool again with page = {} for the next page. After performing an operation on this data, you MUST use this tool again to get additional pages of data.\n\n",
                in_page + 1,
                page + 1,
            ));
        }
        if in_page != page || page != 0 {
            result.push_str(&format!(
                "The selection {} for page = {} has formats: ",
                selection.to_string(None, self.a1_context()),
                page
            ));
        } else {
            result.push_str(&format!(
                "The selection {} has formats: ",
                selection.to_string(None, self.a1_context())
            ));
        }
        result.push_str(&formats.join(", "));
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use crate::test_util::*;
    use crate::{Rect, a1::A1Selection, controller::GridController};

    #[test]
    fn test_breakup_rect_into_pages() {
        // Small rect that fits in one page
        let rect = Rect::test_a1("A1:J5");
        let (pages, count) = GridController::breakup_rect_into_pages(rect, 0, 100);
        assert_eq!(count, 0);
        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0], rect);

        // Tall rect that needs multiple pages
        let rect = Rect::new(1, 1, 10, 200);
        let (pages, count) = GridController::breakup_rect_into_pages(rect, 0, 100);
        assert_eq!(count, 0);
        assert_eq!(pages.len(), 20);
        assert_eq!(pages[0], Rect::new(1, 1, 10, 10));
        assert_eq!(pages[19], Rect::new(1, 191, 10, 200));

        // Rect with initial count
        let rect = Rect::new(1, 1, 10, 100);
        let (pages, count) = GridController::breakup_rect_into_pages(rect, 50, 100);
        assert_eq!(count, 0);
        assert_eq!(pages.len(), 11);
        assert_eq!(pages[0], Rect::new(1, 1, 10, 5));
        assert_eq!(pages[10], Rect::new(1, 96, 10, 100));
    }

    #[test]
    fn test_get_ai_cells_empty() {
        let gc = test_create_gc();

        // Test empty selection
        let selection = A1Selection::test_a1("A1:B2");
        let result = gc.get_ai_cells(selection.clone(), 0).unwrap();
        assert!(result.values.is_empty());
        assert_eq!(result.page, 0);
        assert_eq!(result.total_pages, 0);
        assert_eq!(result.selection, "Sheet1!A1:B2".to_string());

        // Even large empty selections should return the empty message
        let large_selection = A1Selection::test_a1("A1:Z1000");
        let result = gc.get_ai_cells(large_selection, 0).unwrap();
        assert_eq!(result.page, 0);
        assert_eq!(result.total_pages, 0);
        assert!(result.values.is_empty());
        assert_eq!(result.selection, "Sheet1!A1:Z1000".to_string());
    }

    #[test]
    fn test_get_ai_cells_content() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_set_values(&mut gc, sheet_id, pos![a1], 10, 190);

        let selection = A1Selection::test_a1("A1:J190");
        let result = gc.get_ai_cells(selection.clone(), 0).unwrap();
        assert_eq!(result.page, 0);
        assert_eq!(result.total_pages, 1);
        assert_eq!(result.values[0].range, "A1:J100");
        assert_eq!(
            result.values[0]
                .values
                .as_ref()
                .unwrap()
                .iter()
                .flatten()
                .count(),
            1000
        );
        assert_eq!(result.selection, "Sheet1!A1:J190".to_string());

        let result = gc.get_ai_cells(selection, 1).unwrap();
        assert_eq!(result.page, 1);
        assert_eq!(result.total_pages, 1);
        assert_eq!(result.values[0].range, "A101:J190");
        assert_eq!(
            result.values[0]
                .values
                .as_ref()
                .unwrap()
                .iter()
                .flatten()
                .count(),
            900
        );
        assert_eq!(result.selection, "Sheet1!A1:J190".to_string());
    }

    #[test]
    fn test_get_ai_cell_formats_empty() {
        let gc = test_create_gc();

        // Test empty selection
        let selection = A1Selection::test_a1("A1:B2");
        let result = gc.get_ai_cell_formats(selection.clone(), 0).unwrap();
        assert!(result.contains("has no formats"));
        assert!(result.contains("A1:B2"));

        // Even large empty selections should return properly
        let large_selection = A1Selection::test_a1("A1:Z1000");
        let result = gc.get_ai_cell_formats(large_selection, 0).unwrap();
        assert!(result.contains("has no formats"));
        assert!(result.contains("A1:Z1000"));
    }

    #[test]
    fn test_get_ai_cell_formats_content() {
        let mut gc = test_create_gc();

        // Set some cell formats
        gc.set_bold(&A1Selection::test_a1("a1:j190"), Some(true), None, false)
            .unwrap();
        gc.set_italic(&A1Selection::test_a1("b1"), Some(true), None, false)
            .unwrap();
        gc.set_underline(&A1Selection::test_a1("c1"), Some(true), None, false)
            .unwrap();

        let selection = A1Selection::test_a1("A1:J190");
        let result = gc.get_ai_cell_formats(selection.clone(), 0).unwrap();
        assert!(result.contains("has formats:"));
        assert!(result.contains("bold"));
        assert!(result.contains("italic"));
        assert!(result.contains("underline"));

        let result = gc.get_ai_cell_formats(selection, 1).unwrap();
        assert!(result.contains("A1:J190 for page = 1"));
        assert!(result.contains("bold"));
        assert!(!result.contains("italic"));
        assert!(!result.contains("underline"));
    }

    #[test]
    fn test_get_ai_cell_formats_content_with_page_break() {
        let mut gc = test_create_gc();

        gc.set_bold(&A1Selection::test_a1("a1:j190"), Some(true), None, false)
            .unwrap();

        let selection = A1Selection::test_a1("a1:j190");
        let result = gc.get_ai_cell_formats(selection.clone(), 0).unwrap();
        assert!(result.contains("has formats:"));
        assert!(result.contains("bold"));
        assert!(result.contains("IMPORTANT: There are 2 pages"));
        assert!(result.contains("A1:J190 for page = 0"));
        assert!(result.contains("page = 1"));

        let result = gc.get_ai_cell_formats(selection, 1).unwrap();
        assert!(result.contains("A1:J190 for page = 1"));
        assert!(result.contains("has formats:"));
        assert!(result.contains("bold"));
    }

    #[test]
    fn test_get_ai_cell_formats_too_many_pages() {
        let mut gc = test_create_gc();
        let selection = A1Selection::test_a1("A1:J1000");

        gc.set_bold(&selection, Some(true), None, false).unwrap();
        let result = gc.get_ai_cell_formats(selection, 0).unwrap();

        // ensure we message AI that there are too many pages
        assert!(result.contains("IMPORTANT: There are 11 pages in this result. Let the user know"));
    }
}

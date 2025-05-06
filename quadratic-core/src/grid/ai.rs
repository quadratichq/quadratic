use crate::{
    Rect,
    a1::{A1Error, A1Selection},
    controller::GridController,
};

use super::GridBounds;

const MAX_POTENTIAL_CELLS_PER_PAGE: u32 = 1000;

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
                    count = count.max(0);
                }
            }
            pages.push(Rect::new(
                rect.min.x,
                row_start as i64,
                rect.max.x,
                (row_start + rows_this_page - 1) as i64,
            ));
            rows += rows_this_page as u32;
            row_start += rows_this_page;
        }
        (pages, count)
    }

    /// Returns the rendered values of the cells in a given rect.
    pub fn get_ai_cells(&self, selection: A1Selection, page: u32) -> Result<String, A1Error> {
        let mut count = 0;
        let mut in_page = 0;
        let mut cells = Vec::new();
        for range in &selection.ranges {
            if let Some(sheet) = self.try_sheet(selection.sheet_id) {
                // we use the bounds to limit the number of cells we need to check
                if let GridBounds::NonEmpty(bounds) = sheet.bounds(true) {
                    if let Some(rect) = range.to_rect(self.a1_context()) {
                        if let Some(rect) = rect.intersection(&bounds) {
                            let (rects, new_count) = Self::breakup_rect_into_pages(
                                rect,
                                count,
                                MAX_POTENTIAL_CELLS_PER_PAGE,
                            );
                            count = new_count;
                            for rect in rects {
                                if page == in_page {
                                    cells.extend(sheet.get_cells_as_string(rect));
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
            }
        }
        let mut result = String::new();
        if in_page != page {
            result.push_str(&format!(
                "IMPORTANT: There are more pages in this result. Use this tool again with page = {}. After performing an operation on this data, you MUST use this tool again to get additional pages of data.\n\n",
                page + 1,
            ));
        }
        result.push_str(&format!(
            "The selection {} has: ",
            selection.to_string(None, self.a1_context())
        ));
        result.push_str(&cells.join(", "));
        Ok(result)
    }

    /// Returns the rendered formats of the cells in a given rect.
    pub fn get_ai_cell_formats(&self, selection: A1Selection) -> Result<String, A1Error> {
        let mut formats = Vec::new();
        for range in &selection.ranges {
            if let Some(rect) = range.to_rect(self.a1_context()) {
                if let Some(sheet) = self.try_sheet(selection.sheet_id) {
                    formats.extend(sheet.get_cell_formats_as_string(rect));
                }
            }
        }
        Ok(formats.join(", "))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
}

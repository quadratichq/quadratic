use crate::{
    Pos,
    a1::{A1Selection, CellRefRange, CellRefRangeEnd},
    grid::sheet::merge_cells::MergeCells,
};

impl A1Selection {
    // adjusts the selection for merged cells, expanding or shrinking the
    // selection as needed
    pub(crate) fn adjust_for_merged_cells(
        &mut self,
        merge_cells: &MergeCells,
        last_range_grew: bool,
        _end_pos: &mut Pos,
    ) {
        for range in &mut self.ranges {
            // only sheet ranges can be affected by merged cells
            if let CellRefRange::Sheet { range } = range {
                // infinite ranges are not affected by merged cells
                if let Some(rect) = range.to_rect() {
                    let merged_cells = merge_cells.get_merge_cells(rect);
                    dbg!(&merged_cells);
                    if !merged_cells.is_empty() {
                        let mut new_rect = rect.clone();
                        for merged_rect in merged_cells {
                            // only need to change the selection if the merged
                            // cells are not already completed contained by the
                            // range
                            if !new_rect.contains_rect(&merged_rect) {
                                dbg!("adjusting for merged cells");
                                if last_range_grew {
                                    dbg!("growing selection");
                                    new_rect.union_in_place(&merged_rect);
                                } else {
                                    // todo! we need to shrink the selection so it excludes the merged cell
                                }
                            }
                        }
                        if new_rect != rect {
                            range.start = CellRefRangeEnd::new_relative_pos(new_rect.min);
                            range.end = CellRefRangeEnd::new_relative_pos(new_rect.max);
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::Rect;

    use super::*;

    #[test]
    fn test_adjust_for_merged_cells_none() {
        let mut selection = A1Selection::test_a1("B7");
        let mut end = Pos::test_a1("B7");

        let merge_cells = MergeCells::default();

        selection.adjust_for_merged_cells(&merge_cells, true, &mut end);
        assert_eq!(end, Pos::test_a1("B7:F20"));
        assert_eq!(selection.test_to_string(), "B7:F20");
    }

    #[test]
    fn test_adjust_for_merged_cells_expand() {
        let mut selection = A1Selection::test_a1("B7:C8");
        let mut end = Pos::test_a1("C8");

        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C8:E10"));

        selection.adjust_for_merged_cells(&merge_cells, true, &mut end);
        assert_eq!(selection.test_to_string(), "B7:E10");
        assert_eq!(end, Pos::test_a1("E10"));
    }

    #[test]
    fn test_adjust_for_merged_cells_shrink() {
        let mut selection = A1Selection::test_a1("B7:E10");
        let mut end = Pos::test_a1("E10");

        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C8:E10"));

        selection.adjust_for_merged_cells(&merge_cells, false, &mut end);
        assert_eq!(selection.test_to_string(), "B7:C10");
        assert_eq!(end, Pos::test_a1("C8"));
    }
}

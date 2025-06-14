use crate::a1::{A1Context, CellRefRange};

/// Expands CellRefRanges
pub fn expand_named_ranges(ranges: &[CellRefRange], context: &A1Context) -> Vec<CellRefRange> {
    let mut new_ranges = Vec::new();

    ranges.iter().for_each(|range| match range {
        CellRefRange::Sheet { .. } | CellRefRange::Table { .. } => new_ranges.push(range.clone()),
        CellRefRange::Named { range } => {
            if let Some(entry) = context.try_named(&range) {
                new_ranges.extend(entry.selection().ranges.clone());
            }
        }
    });

    new_ranges
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_expand_named_ranges() {}
}

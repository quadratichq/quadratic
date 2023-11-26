use itertools::Itertools;

use crate::grid::borders::style::BorderSelection;
use crate::Rect;

pub(super) fn vertical(rect: &Rect, selections: Vec<BorderSelection>) -> Vec<i64> {
    selections
        .iter()
        .flat_map(|&selection| vertical_selection(rect, selection))
        .sorted()
        .dedup()
        .collect()
}

fn vertical_selection(rect: &Rect, selection: BorderSelection) -> Vec<i64> {
    let first = rect.min.x;
    let last = rect.max.x + 1;
    match selection {
        BorderSelection::All => (first..=last).collect(),
        BorderSelection::Inner | BorderSelection::Vertical => (first + 1..=last - 1).collect(),
        BorderSelection::Outer => vec![first, last],
        BorderSelection::Left => vec![first],
        BorderSelection::Right => vec![last],
        BorderSelection::Horizontal | BorderSelection::Top | BorderSelection::Bottom => vec![],
        BorderSelection::Clear => (first..=last).collect(),
    }
}

pub(super) fn horizontal(rect: &Rect, selections: Vec<BorderSelection>) -> Vec<i64> {
    selections
        .iter()
        .flat_map(|&selection| horizontal_selection(rect, selection))
        .sorted()
        .dedup()
        .collect()
}

fn horizontal_selection(rect: &Rect, selection: BorderSelection) -> Vec<i64> {
    let first = rect.min.y;
    let last = rect.max.y + 1;
    match selection {
        BorderSelection::All => (first..=last).collect(),
        BorderSelection::Inner | BorderSelection::Horizontal => (first + 1..=last - 1).collect(),
        BorderSelection::Outer => vec![first, last],
        BorderSelection::Top => vec![first],
        BorderSelection::Bottom => vec![last],
        BorderSelection::Vertical | BorderSelection::Left | BorderSelection::Right => vec![],
        BorderSelection::Clear => (first..=last).collect(),
    }
}

#[cfg(test)]
mod tests {
    use crate::Pos;

    use super::*;

    #[test]
    fn horizontal_indices() {
        let rect = Rect::new_span(Pos { x: 10, y: 20 }, Pos { x: 13, y: 23 });

        assert_eq!(
            horizontal(&rect, vec![BorderSelection::All]),
            vec![20, 21, 22, 23, 24]
        );
        assert_eq!(
            horizontal(&rect, vec![BorderSelection::Inner]),
            vec![21, 22, 23]
        );
        assert_eq!(
            horizontal(&rect, vec![BorderSelection::Outer]),
            vec![20, 24]
        );
        assert_eq!(
            horizontal(&rect, vec![BorderSelection::Horizontal]),
            vec![21, 22, 23]
        );
        assert!(horizontal(&rect, vec![BorderSelection::Vertical]).is_empty());
        assert!(horizontal(&rect, vec![BorderSelection::Left]).is_empty());
        assert_eq!(horizontal(&rect, vec![BorderSelection::Top]), vec![20]);
        assert!(horizontal(&rect, vec![BorderSelection::Right]).is_empty());
        assert_eq!(horizontal(&rect, vec![BorderSelection::Bottom]), vec![24]);

        assert_eq!(
            horizontal(&rect, vec![BorderSelection::Top, BorderSelection::Bottom]),
            vec![20, 24]
        );
        assert_eq!(
            horizontal(&rect, vec![BorderSelection::Bottom, BorderSelection::Top]),
            vec![20, 24]
        );
        assert!(horizontal(&rect, vec![BorderSelection::Left, BorderSelection::Right]).is_empty());
    }

    #[test]
    fn vertical_indices() {
        let rect = Rect::new_span(Pos { x: 10, y: 20 }, Pos { x: 13, y: 23 });

        assert_eq!(
            vertical(&rect, vec![BorderSelection::All]),
            vec![10, 11, 12, 13, 14]
        );
        assert_eq!(
            vertical(&rect, vec![BorderSelection::Inner]),
            vec![11, 12, 13]
        );
        assert_eq!(vertical(&rect, vec![BorderSelection::Outer]), vec![10, 14]);
        assert!(vertical(&rect, vec![BorderSelection::Horizontal]).is_empty());
        assert_eq!(
            vertical(&rect, vec![BorderSelection::Vertical]),
            vec![11, 12, 13]
        );
        assert_eq!(vertical(&rect, vec![BorderSelection::Left]), vec![10]);
        assert!(vertical(&rect, vec![BorderSelection::Top]).is_empty());
        assert_eq!(vertical(&rect, vec![BorderSelection::Right]), vec![14]);
        assert!(vertical(&rect, vec![BorderSelection::Bottom]).is_empty());

        assert!(vertical(&rect, vec![BorderSelection::Top, BorderSelection::Bottom]).is_empty());

        assert_eq!(
            vertical(&rect, vec![BorderSelection::Left, BorderSelection::Right]),
            vec![10, 14]
        );
        assert_eq!(
            vertical(&rect, vec![BorderSelection::Right, BorderSelection::Left]),
            vec![10, 14]
        );
    }
}

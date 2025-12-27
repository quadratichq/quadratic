// Re-export the base type from quadratic-core-shared
pub use quadratic_core_shared::Rect;

use crate::{ArraySize, Pos, cell_values::CellValues};

// Import the A1 extension trait to use a1_string method
use crate::pos::PosA1Ext;

// Core-specific extension for Rect
pub trait RectCoreExt {
    fn size(self) -> ArraySize;
    fn from_pos_and_size(top_left: Pos, size: ArraySize) -> Rect;
    fn a1_string(&self) -> String;
    #[cfg(test)]
    fn test_a1(s: &str) -> Rect;
}

impl RectCoreExt for Rect {
    fn size(self) -> ArraySize {
        ArraySize::new(self.width(), self.height()).expect("empty rectangle has no size")
    }

    /// Constructs a rectangle from a top-left position and a size.
    fn from_pos_and_size(top_left: Pos, size: ArraySize) -> Rect {
        Rect {
            min: top_left,
            max: Pos {
                x: top_left.x + size.w.get() as i64 - 1,
                y: top_left.y + size.h.get() as i64 - 1,
            },
        }
    }

    fn a1_string(&self) -> String {
        format!("{}:{}", self.min.a1_string(), self.max.a1_string())
    }

    #[cfg(test)]
    fn test_a1(s: &str) -> Rect {
        use crate::a1::A1Context;

        crate::a1::CellRefRange::test_a1(s)
            .to_rect(&A1Context::default())
            .unwrap()
    }
}

impl From<&CellValues> for Rect {
    fn from(values: &CellValues) -> Self {
        Rect::from_numbers(0, 0, values.w as i64, values.h as i64)
    }
}

#[cfg(test)]
use proptest::prelude::*;
#[cfg(test)]
impl Arbitrary for Rect {
    type Parameters = ();

    fn arbitrary_with(_args: Self::Parameters) -> Self::Strategy {
        (any::<Pos>(), any::<Pos>()).prop_map(|(a, b)| Rect::new_span(a, b))
    }

    type Strategy = proptest::strategy::Map<
        (proptest::strategy::BoxedStrategy<Pos>, proptest::strategy::BoxedStrategy<Pos>),
        fn((Pos, Pos)) -> Self,
    >;
}

#[cfg(test)]
impl Arbitrary for Pos {
    type Parameters = ();

    fn arbitrary_with(_args: Self::Parameters) -> Self::Strategy {
        (
            crate::a1::PROPTEST_COORDINATE_I64,
            crate::a1::PROPTEST_COORDINATE_I64,
        )
            .prop_map(|(x, y)| Pos::new(x, y))
    }

    type Strategy = proptest::strategy::Map<
        (
            proptest::strategy::BoxedStrategy<i64>,
            proptest::strategy::BoxedStrategy<i64>,
        ),
        fn((i64, i64)) -> Self,
    >;
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{SheetRect, grid::SheetId, pos::RectA1Ext};

    #[test]
    fn test_rect_new_span() {
        let pos1 = Pos { x: 1, y: 2 };
        let pos2 = Pos { x: 3, y: 4 };
        let rect = Rect::new_span(pos1, pos2);
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 3, y: 4 });
    }

    #[test]
    fn test_to_sheet_rect() {
        let pos1 = Pos { x: 1, y: 2 };
        let pos2 = Pos { x: 3, y: 4 };
        let sheet_id = SheetId::new();
        let rect = Rect::new_span(pos1, pos2).to_sheet_rect(sheet_id);
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 3, y: 4 });
        assert_eq!(rect.sheet_id, sheet_id);
    }

    #[test]
    fn test_from_numbers() {
        let rect = Rect::from_numbers(1, 2, 3, 4);
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 3, y: 5 });
    }

    #[test]
    fn test_single_pos() {
        let rect = Rect::single_pos(Pos { x: 1, y: 2 });
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 1, y: 2 });
    }

    #[test]
    fn test_extend_to() {
        let mut rect = Rect::single_pos(Pos { x: 1, y: 2 });
        rect.extend_to(Pos { x: 3, y: 4 });
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 3, y: 4 });
    }

    #[test]
    fn test_from_ranges() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 3, y: 4 });
    }

    #[test]
    fn test_size() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert_eq!(rect.size(), crate::ArraySize::new(3, 3).unwrap());
    }

    #[test]
    fn test_from_pos_and_size() {
        let rect =
            Rect::from_pos_and_size(Pos { x: 1, y: 2 }, crate::ArraySize::new(3, 4).unwrap());
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 3, y: 5 });
    }

    #[test]
    fn test_contains() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert!(rect.contains(Pos { x: 1, y: 2 }));
        assert!(rect.contains(Pos { x: 3, y: 4 }));
        assert!(!rect.contains(Pos { x: 0, y: 2 }));
        assert!(!rect.contains(Pos { x: 1, y: 1 }));
        assert!(!rect.contains(Pos { x: 4, y: 2 }));
        assert!(!rect.contains(Pos { x: 1, y: 5 }));
    }

    #[test]
    fn test_intersects() {
        let rect = Rect::from_ranges(1..=4, 2..=5);
        assert!(rect.intersects(Rect::from_ranges(1..=3, 2..=4)));
        assert!(rect.intersects(Rect::from_ranges(2..=4, 3..=5)));
        assert!(rect.intersects(Rect::from_ranges(0..=1, 2..=4)));
        assert!(rect.intersects(Rect::from_ranges(1..=3, 0..=2)));
        assert!(rect.intersects(Rect::from_ranges(4..=5, 2..=4)));
        assert!(rect.intersects(Rect::from_ranges(1..=3, 5..=6)));
        assert!(!rect.intersects(Rect::from_ranges(0..=0, 2..=4)));
        assert!(!rect.intersects(Rect::from_ranges(1..=3, 0..=0)));
        assert!(!rect.intersects(Rect::from_ranges(5..=5, 2..=4)));
        assert!(!rect.intersects(Rect::from_ranges(1..=3, 6..=6)));
    }

    #[test]
    fn test_x_range() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert_eq!(rect.x_range(), 1..=3);
    }

    #[test]
    fn test_y_range() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert_eq!(rect.y_range(), 2..=4);
    }

    #[test]
    fn test_width() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert_eq!(rect.width(), 3);
    }

    #[test]
    fn test_height() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert_eq!(rect.height(), 3);
    }

    #[test]
    fn test_len() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert_eq!(rect.len(), 9);
    }

    #[test]
    fn test_is_empty() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert!(!rect.is_empty());
        let rect = Rect::from_numbers(0, 1, 1, 0);
        assert!(rect.is_empty());
        let rect = Rect::from_numbers(0, 1, 0, 1);
        assert!(rect.is_empty());
    }

    #[test]
    fn test_translate_in_place() {
        let mut rect = Rect::from_ranges(1..=3, 2..=4);
        rect.translate_in_place(1, 2);
        assert_eq!(rect.min, Pos { x: 2, y: 4 });
        assert_eq!(rect.max, Pos { x: 4, y: 6 });
    }

    #[test]
    fn test_iter() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        let mut iter = rect.iter();
        assert_eq!(iter.next(), Some(Pos { x: 1, y: 2 }));
        assert_eq!(iter.next(), Some(Pos { x: 2, y: 2 }));
        assert_eq!(iter.next(), Some(Pos { x: 3, y: 2 }));
        assert_eq!(iter.next(), Some(Pos { x: 1, y: 3 }));
        assert_eq!(iter.next(), Some(Pos { x: 2, y: 3 }));
        assert_eq!(iter.next(), Some(Pos { x: 3, y: 3 }));
        assert_eq!(iter.next(), Some(Pos { x: 1, y: 4 }));
        assert_eq!(iter.next(), Some(Pos { x: 2, y: 4 }));
        assert_eq!(iter.next(), Some(Pos { x: 3, y: 4 }));
        assert_eq!(iter.next(), None);
    }

    #[test]
    fn test_rect_combine() {
        let rect1 = Rect::from_numbers(1, 2, 3, 4);
        let rect2 = Rect::from_numbers(2, 3, 4, 5);
        let rect = rect1.union(&rect2);
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 5, y: 7 });
    }

    #[test]
    fn count() {
        let rect = Rect::from_numbers(1, 2, 3, 4);
        assert_eq!(rect.count(), 12);
    }

    #[test]
    fn rect_from_positions() {
        let positions = vec![Pos { x: 1, y: 1 }, Pos { x: 2, y: 2 }];
        let bounds = Rect::from_positions(positions).unwrap();
        assert_eq!(bounds.min.x, 1);
        assert_eq!(bounds.min.y, 1);
        assert_eq!(bounds.max.x, 2);
        assert_eq!(bounds.max.y, 2);
    }

    #[test]
    fn rect_from_pos() {
        let pos = Pos { x: 1, y: 2 };
        let rect: Rect = pos.into();
        assert_eq!(rect.min, pos);
        assert_eq!(rect.max, pos);
    }

    #[test]
    fn rect_new() {
        let rect = Rect::new(0, 1, 2, 3);
        assert_eq!(rect.min, Pos { x: 0, y: 1 });
        assert_eq!(rect.max, Pos { x: 2, y: 3 });
    }

    #[test]
    fn extend_x() {
        let mut rect = Rect::from_numbers(1, 2, 3, 4);
        rect.extend_x(5);
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 5, y: 5 });
    }

    #[test]
    fn extend_y() {
        let mut rect = Rect::from_numbers(1, 2, 3, 4);
        rect.extend_y(5);
        assert_eq!(rect.min, Pos { x: 1, y: 2 });
        assert_eq!(rect.max, Pos { x: 3, y: 5 });
    }

    #[test]
    fn rect_intersection() {
        let rect1 = Rect::new(1, 2, 3, 4);
        let rect2 = Rect::new(2, 3, 4, 5);
        let intersection = rect1.intersection(&rect2).unwrap();
        assert_eq!(intersection, Rect::new(2, 3, 3, 4));

        let rect3 = Rect::new(4, 5, 6, 7);
        assert!(rect1.intersection(&rect3).is_none());
        assert_eq!(rect2.intersection(&rect3).unwrap(), Rect::new(4, 5, 4, 5));
    }

    #[test]
    fn can_merge() {
        let rect = Rect::new(0, 0, 2, 2);

        assert!(rect.can_merge(&Rect::new(2, 0, 4, 2)));
        assert!(rect.can_merge(&Rect::new(0, 2, 2, 4)));
        assert!(!rect.can_merge(&Rect::new(3, 3, 5, 5)));
        assert!(rect.can_merge(&Rect::new(1, 1, 3, 3)));
        assert!(rect.can_merge(&Rect::new(0, 0, 4, 4)));
    }

    #[test]
    fn test_contains_col() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert!(rect.contains_col(2));
        assert!(!rect.contains_col(8));
    }

    #[test]
    fn test_contains_row() {
        let rect = Rect::from_ranges(1..=3, 2..=4);
        assert!(rect.contains_row(3));
        assert!(!rect.contains_row(8));
    }

    proptest! {
        #[test]
        fn test_rect_subtract(r1: Rect, r2: Rect) {
            let result = r1.subtract(r2);
            println!("result = {result:?}");

            let mut failed = false;

            for pos in crate::a1::proptest_positions_iter() {
                let expected = (r1.contains(pos) && !r2.contains(pos)) as u8;
                let mut actual = 0;
                for r in &result {
                    actual += r.contains(pos) as u8;
                }
                if actual != expected {
                    failed = true;
                    println!("failed at {pos}");
                }
            }

            if failed {
                panic!("uncomment the lines above for debugging")
            }
        }
    }

    #[test]
    fn test_new_rect_normalized() {
        let rect = Rect::new(1, 2, 0, 0);
        assert_eq!(rect.min, Pos { x: 0, y: 0 });
        assert_eq!(rect.max, Pos { x: 1, y: 2 });

        let rect = Rect::new(1, 0, 0, 2);
        assert_eq!(rect.min, Pos { x: 0, y: 0 });
        assert_eq!(rect.max, Pos { x: 1, y: 2 });

        let rect = Rect::new(0, 2, 1, 0);
        assert_eq!(rect.min, Pos { x: 0, y: 0 });
        assert_eq!(rect.max, Pos { x: 1, y: 2 });
    }

    #[test]
    fn test_union_in_place() {
        let mut rect = Rect::new(0, 0, 1, 1);
        rect.union_in_place(&Rect::new(1, 1, 2, 2));
        assert_eq!(rect, Rect::new(0, 0, 2, 2));
    }

    #[test]
    fn test_test_a1() {
        let rect = Rect::test_a1("B2:D4");
        assert_eq!(rect.min, Pos { x: 2, y: 2 });
        assert_eq!(rect.max, Pos { x: 4, y: 4 });
    }

    #[test]
    fn test_a1_string() {
        // Basic test with small coordinates
        let rect = Rect::new(1, 1, 3, 3);
        assert_eq!(rect.a1_string(), "A1:C3");

        // Test with larger column values that require multiple letters
        let rect = Rect::new(26, 1, 52, 6); // 26 = AA, 52 = BA
        assert_eq!(rect.a1_string(), "Z1:AZ6");

        // Test with larger row numbers
        let rect = Rect::new(1, 99, 3, 102);
        assert_eq!(rect.a1_string(), "A99:C102");

        // Test single cell
        let rect = Rect::single_pos(Pos { x: 1, y: 1 });
        assert_eq!(rect.a1_string(), "A1:A1");

        // Test non-sequential coordinates (should be normalized)
        let rect = Rect::new(5, 5, 2, 3); // will be normalized to (2,3) to (5,5)
        assert_eq!(rect.a1_string(), "B3:E5");
    }

    #[test]
    fn test_cols_range() {
        let rect = Rect::test_a1("B1:D4");
        assert_eq!(rect.cols_range(1, 2), vec![2]);
        assert_eq!(rect.cols_range(1, 5), vec![2, 3, 4]);
        assert_eq!(rect.cols_range(3, 4), vec![3, 4]);
        assert_eq!(rect.cols_range(6, 10), Vec::<i64>::new());
    }

    #[test]
    fn test_rows_range() {
        let rect = Rect::test_a1("A2:D4");
        assert_eq!(rect.rows_range(1, 2), vec![2]);
        assert_eq!(rect.rows_range(1, 5), vec![2, 3, 4]);
        assert_eq!(rect.rows_range(3, 4), vec![3, 4]);
        assert_eq!(rect.rows_range(6, 10), Vec::<i64>::new());
    }
}

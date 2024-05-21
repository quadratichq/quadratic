use std::str::FromStr;

use crate::{grid::SheetId, Rect};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct Selection {
    pub sheet_id: SheetId,
    pub rects: Option<Vec<Rect>>,
    pub rows: Option<Vec<i64>>,
    pub column: Option<Vec<i64>>,
    pub all: bool,
}

impl FromStr for Selection {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        serde_json::from_str::<Selection>(s).map_err(|e| {
            dbg!(e.to_string());
            ()
        })
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn selection_from_str_rects() {
        let s = r#"{"sheet_id":{"id":"00000000-0000-0000-0000-000000000000"},"rects":[{"min":{"x":0,"y":1},"max":{"x":3,"y":4}}],"rows":null,"column":null,"all":false}"#;
        let selection: Selection = Selection::from_str(s).unwrap();
        assert_eq!(
            selection,
            Selection {
                sheet_id: SheetId::test(),
                rects: Some(vec![Rect::from_numbers(0, 1, 4, 4)]),
                rows: None,
                column: None,
                all: false
            }
        );
    }

    #[test]
    fn selection_from_str_rows() {
        let s = r#"{"sheet_id":{"id":"00000000-0000-0000-0000-000000000000"},"rects":null,"rows":[3,5],"column":null,"all":false}"#;
        let selection: Selection = Selection::from_str(s).unwrap();
        assert_eq!(
            selection,
            Selection {
                sheet_id: SheetId::test(),
                rects: None,
                rows: Some(vec!(3, 5)),
                column: None,
                all: false
            }
        );
    }

    #[test]
    fn selection_from_str_columns() {
        let s = r#"{"sheet_id":{"id":"00000000-0000-0000-0000-000000000000"},"rects":null,"rows":null,"column":[7, 8, 9],"all":false}"#;
        let selection: Selection = Selection::from_str(s).unwrap();
        assert_eq!(
            selection,
            Selection {
                sheet_id: SheetId::test(),
                rects: None,
                rows: None,
                column: Some(vec!(7, 8, 9)),
                all: false
            }
        );
    }

    #[test]
    fn selection_from_str_all() {
        let s = r#"{"sheet_id":{"id":"00000000-0000-0000-0000-000000000000"},"rects":null,"rows":null,"column":null,"all":true}"#;
        let selection: Selection = Selection::from_str(s).unwrap();
        assert_eq!(
            selection,
            Selection {
                sheet_id: SheetId::test(),
                rects: None,
                rows: None,
                column: None,
                all: true
            }
        );
    }
}

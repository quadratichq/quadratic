use std::str::FromStr;

use crate::{
    grid::SheetId, A1Selection, CellRefCoord, CellRefRange, CellRefRangeEnd, Pos, RefRangeBounds,
};

use super::current;

fn import_cell_ref_coord(coord: current::CellRefCoordSchema) -> CellRefCoord {
    CellRefCoord {
        coord: coord.coord,
        is_absolute: coord.is_absolute,
    }
}

fn import_cell_ref_range(range: current::CellRefRangeSchema) -> CellRefRange {
    match range {
        current::CellRefRangeSchema::Sheet(range) => CellRefRange::Sheet {
            range: RefRangeBounds {
                start: CellRefRangeEnd {
                    col: range.start.col.map(import_cell_ref_coord),
                    row: range.start.row.map(import_cell_ref_coord),
                },
                end: range.end.map(|end| CellRefRangeEnd {
                    col: end.col.map(import_cell_ref_coord),
                    row: end.row.map(import_cell_ref_coord),
                }),
            },
        },
    }
}

pub fn import_selection(selection: current::A1SelectionSchema) -> A1Selection {
    A1Selection {
        // todo: handle error more gracefully
        sheet_id: SheetId::from_str(&selection.sheet_id.to_string()).unwrap(),
        cursor: Pos {
            x: selection.cursor.x,
            y: selection.cursor.y,
        },
        ranges: selection
            .ranges
            .into_iter()
            .map(import_cell_ref_range)
            .collect(),
    }
}

fn export_cell_ref_coord(coord: CellRefCoord) -> current::CellRefCoordSchema {
    current::CellRefCoordSchema {
        coord: coord.coord,
        is_absolute: coord.is_absolute,
    }
}

fn export_cell_ref_range(range: CellRefRange) -> current::CellRefRangeSchema {
    match range {
        CellRefRange::Sheet { range } => {
            current::CellRefRangeSchema::Sheet(current::RefRangeBoundsSchema {
                start: current::CellRefRangeEndSchema {
                    col: range.start.col.map(export_cell_ref_coord),
                    row: range.start.row.map(export_cell_ref_coord),
                },
                end: range.end.map(|end| current::CellRefRangeEndSchema {
                    col: end.col.map(export_cell_ref_coord),
                    row: end.row.map(export_cell_ref_coord),
                }),
            })
        }
    }
}

pub fn export_selection(selection: A1Selection) -> current::A1SelectionSchema {
    current::A1SelectionSchema {
        sheet_id: selection.sheet_id.to_string().into(),
        cursor: current::PosSchema {
            x: selection.cursor.x,
            y: selection.cursor.y,
        },
        ranges: selection
            .ranges
            .into_iter()
            .map(export_cell_ref_range)
            .collect(),
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use super::*;

    #[test]
    #[parallel]
    fn import_export_selection() {
        let selection = A1Selection::test("A2,C4:E6,G8:I10,1:3,D:E");
        let imported = import_selection(export_selection(selection.clone()));
        assert_eq!(selection, imported);
    }
}

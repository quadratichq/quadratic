#[cfg(test)]
use crate::controller::GridController;
#[cfg(test)]
use crate::grid::{Sheet, SheetId};

/// Gets the first sheet from a grid controller
#[cfg(test)]
pub fn first_sheet(gc: &GridController) -> &Sheet {
    gc.sheet(gc.sheet_ids()[0])
}

/// Gets a sheet from a grid controller by id
#[cfg(test)]
pub fn sheet(gc: &GridController, id: SheetId) -> &Sheet {
    gc.try_sheet(id)
        .expect(&format!("Sheet with id {} not found", id))
}

/// Gets a sheet from a grid controller by id
#[cfg(test)]
pub fn sheet_mut(gc: &mut GridController, id: SheetId) -> &mut Sheet {
    gc.try_sheet_mut(id)
        .expect(&format!("Sheet with id {} not found", id))
}

#[cfg(test)]
mod tests {
    use crate::grid::SheetId;

    use super::*;

    #[test]
    fn test_first_sheet() {
        let gc = GridController::test();
        let sheet = first_sheet(&gc);
        assert_eq!(sheet.id, SheetId::TEST);
    }

    #[test]
    fn test_sheet() {
        let gc = GridController::test();
        let sheet = sheet(&gc, SheetId::TEST);
        assert_eq!(sheet.id, SheetId::TEST);
    }

    #[test]
    #[should_panic]
    fn test_sheet_not_found() {
        let gc = GridController::test();
        let non_existent_id = SheetId::new();
        sheet(&gc, non_existent_id);
    }

    #[test]
    fn test_sheet_mut() {
        let mut gc = GridController::test();
        let sheet = sheet_mut(&mut gc, SheetId::TEST);
        assert_eq!(sheet.id, SheetId::TEST);
    }

    #[test]
    #[should_panic]
    fn test_sheet_mut_not_found() {
        let mut gc = GridController::test();
        let non_existent_id = SheetId::new();
        sheet_mut(&mut gc, non_existent_id);
    }
}

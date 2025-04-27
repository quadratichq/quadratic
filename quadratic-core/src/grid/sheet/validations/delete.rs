use crate::{
    a1::{A1Context, A1Selection},
    controller::operations::operation::Operation,
};

use super::Validations;

impl Validations {
    pub fn delete_operations(
        &mut self,
        _selection: &A1Selection,
        _a1_context: &A1Context,
    ) -> Vec<Operation> {
        // self.validations.iter().filter_map(|validation| {
        //     if let Some(to_remove) = validation.selection.intersection(selection, a1_context) {
        //         let mut selection = validation.selection.clone();
        //     }
        // });
        vec![]
    }
}

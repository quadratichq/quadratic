use pyo3::prelude::*;
use quadratic_core::controller::{
    GridController,
    execution::run_code::get_cells::{JsCellsA1Response, JsCellsA1Values},
};

// /// Rust function to handle q.cells() calls from Python
// #[pyfunction]
// pub(crate) fn cells(
//     grid_controller: &mut GridController,
//     a1: String,
// ) -> PyResult<Option<JsCellsA1Response>> {
//     println!("Rust cells() function called with: {}", a1);

//     let result = grid_controller.calculation_get_cells_a1("test".into(), a1);

//     Ok(Some(JsCellsA1Response {
//         values: Some(JsCellsA1Values {
//             cells: vec![],
//             x: 0,
//             y: 0,
//             w: 0,
//             h: 0,
//             one_dimensional: false,
//             two_dimensional: false,
//             has_headers: false,
//         }),
//         error: None,
//     }))
// }

/// Rust function to handle q.pos() calls from Python  
#[pyfunction]
pub(crate) fn pos() -> PyResult<(i32, i32)> {
    Ok((0, 0))
}

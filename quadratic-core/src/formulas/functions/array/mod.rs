//! Array manipulation and operations functions.

mod operations;
mod transform;

use std::collections::HashMap;

use smallvec::SmallVec;

use super::*;
use crate::formulas::LambdaValue;
use crate::{ArraySize, CellValueHash};

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Array functions",
    docs: None,
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    [transform::get_functions(), operations::get_functions()]
        .into_iter()
        .flatten()
        .collect()
}

// ============================================================================
// Shared helper functions
// ============================================================================

/// Checks if a cell value should be included based on ignore_blank and ignore_errors flags.
pub(crate) fn should_include_value(
    value: &CellValue,
    ignore_blank: bool,
    ignore_errors: bool,
) -> bool {
    if ignore_blank && value.is_blank() {
        return false;
    }
    if ignore_errors && matches!(value, CellValue::Error(_)) {
        return false;
    }
    true
}

/// Evaluates BYROW or BYCOL by applying a lambda function to each slice.
pub(crate) fn eval_by_slice(
    ctx: &mut Ctx<'_>,
    span: Span,
    mut args: FormulaFnArgs,
    axis: Axis,
    func_name: &'static str,
) -> CodeResult<Value> {
    let array_value = args.take_next_required("array")?;
    let array: Array = array_value.try_coerce()?.inner;

    let lambda_value = args.take_next_required("lambda")?;
    let lambda = extract_lambda(&lambda_value, func_name)?;

    args.error_if_more_args()?;

    if ctx.skip_computation {
        return Ok(Value::Single(CellValue::Blank));
    }

    if lambda.param_count() != 1 {
        return Err(RunErrorMsg::InvalidArgument.with_span(span));
    }

    let results = apply_lambda_to_slices(ctx, &array, &lambda, axis, span)?;

    let result_array = match axis {
        Axis::Y => {
            let size = ArraySize::new(1, results.len() as u32)
                .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
            Array::new_row_major(size, results)?
        }
        Axis::X => {
            let size = ArraySize::new(results.len() as u32, 1)
                .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
            Array::new_row_major(size, results)?
        }
    };

    Ok(Value::from(result_array))
}

/// Extracts a LambdaValue from a Spanned<Value>.
pub(crate) fn extract_lambda(value: &Spanned<Value>, _func_name: &str) -> CodeResult<LambdaValue> {
    match &value.inner {
        Value::Lambda(lambda) => Ok(lambda.clone()),
        Value::Single(cv) => Err(RunErrorMsg::Expected {
            expected: "lambda".into(),
            got: Some(cv.type_name().into()),
        }
        .with_span(value.span)),
        Value::Array(_) => Err(RunErrorMsg::Expected {
            expected: "lambda".into(),
            got: Some("array".into()),
        }
        .with_span(value.span)),
        Value::Tuple(_) => Err(RunErrorMsg::Expected {
            expected: "lambda".into(),
            got: Some("tuple".into()),
        }
        .with_span(value.span)),
    }
}

/// Applies a lambda function to each slice (row or column) of an array.
pub(crate) fn apply_lambda_to_slices(
    ctx: &mut Ctx<'_>,
    array: &Array,
    lambda: &LambdaValue,
    axis: Axis,
    span: Span,
) -> CodeResult<SmallVec<[CellValue; 1]>> {
    let mut results = SmallVec::new();

    for slice in array.slices(axis) {
        let slice_values: SmallVec<[CellValue; 1]> = slice.into_iter().cloned().collect();
        let slice_array = match axis {
            Axis::Y => {
                let size = ArraySize::new(slice_values.len() as u32, 1)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                Array::new_row_major(size, slice_values)?
            }
            Axis::X => {
                let size = ArraySize::new(1, slice_values.len() as u32)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                Array::new_row_major(size, slice_values)?
            }
        };

        let bindings = vec![(lambda.params[0].clone(), Value::from(slice_array))];
        let mut child_ctx = ctx.with_bindings(&bindings);
        let result = lambda.body.eval(&mut child_ctx);

        let cell_value = match result.inner {
            Value::Single(cv) => cv,
            Value::Array(a) => a
                .cell_values_slice()
                .first()
                .cloned()
                .unwrap_or(CellValue::Blank),
            Value::Tuple(t) => t
                .first()
                .and_then(|a| a.cell_values_slice().first().cloned())
                .unwrap_or(CellValue::Blank),
            Value::Lambda(_) => {
                return Err(RunErrorMsg::Expected {
                    expected: "value".into(),
                    got: Some("lambda".into()),
                }
                .with_span(span));
            }
        };

        results.push(cell_value);
    }

    Ok(results)
}

/// Calculate matrix determinant using LU decomposition.
pub(crate) fn matrix_determinant(matrix: &[f64], n: usize) -> f64 {
    if n == 1 {
        return matrix[0];
    }
    if n == 2 {
        return matrix[0] * matrix[3] - matrix[1] * matrix[2];
    }

    let mut lu: Vec<f64> = matrix.to_vec();
    let mut det = 1.0;

    for col in 0..n {
        let mut max_val = lu[col * n + col].abs();
        let mut max_row = col;
        for row in (col + 1)..n {
            let val = lu[row * n + col].abs();
            if val > max_val {
                max_val = val;
                max_row = row;
            }
        }

        if max_row != col {
            for k in 0..n {
                lu.swap(col * n + k, max_row * n + k);
            }
            det = -det;
        }

        let pivot = lu[col * n + col];
        if pivot.abs() < 1e-15 {
            return 0.0;
        }

        det *= pivot;

        for row in (col + 1)..n {
            let factor = lu[row * n + col] / pivot;
            for k in col..n {
                lu[row * n + k] -= factor * lu[col * n + k];
            }
        }
    }

    det
}

/// Calculate matrix inverse using Gauss-Jordan elimination.
pub(crate) fn matrix_inverse(matrix: &[f64], n: usize) -> Option<Vec<f64>> {
    let mut aug: Vec<f64> = vec![0.0; n * 2 * n];
    for i in 0..n {
        for j in 0..n {
            aug[i * 2 * n + j] = matrix[i * n + j];
        }
        aug[i * 2 * n + n + i] = 1.0;
    }

    for col in 0..n {
        let mut max_val = aug[col * 2 * n + col].abs();
        let mut max_row = col;
        for row in (col + 1)..n {
            let val = aug[row * 2 * n + col].abs();
            if val > max_val {
                max_val = val;
                max_row = row;
            }
        }

        if max_row != col {
            for k in 0..(2 * n) {
                aug.swap(col * 2 * n + k, max_row * 2 * n + k);
            }
        }

        let pivot = aug[col * 2 * n + col];
        if pivot.abs() < 1e-15 {
            return None;
        }

        for k in 0..(2 * n) {
            aug[col * 2 * n + k] /= pivot;
        }

        for row in 0..n {
            if row != col {
                let factor = aug[row * 2 * n + col];
                for k in 0..(2 * n) {
                    aug[row * 2 * n + k] -= factor * aug[col * 2 * n + k];
                }
            }
        }
    }

    let mut inverse: Vec<f64> = vec![0.0; n * n];
    for i in 0..n {
        for j in 0..n {
            inverse[i * n + j] = aug[i * 2 * n + n + j];
        }
    }

    Some(inverse)
}

pub(crate) fn by_column_to_axis(by_column: Option<bool>) -> Axis {
    match by_column {
        Some(true) => Axis::X,
        None | Some(false) => Axis::Y,
    }
}

use itertools::Itertools;
use smallvec::SmallVec;

use super::*;

/// Produces a constant function that takes no arguments.
macro_rules! constant_function {
    ($value:expr) => {
        |args| {
            if !args.inner.is_empty() {
                return Err(FormulaErrorMsg::BadArgumentCount.with_span(args.span));
            }
            $value
        }
    };
}

/// Constructs a thunk that calls `array_mapped()`.
macro_rules! array_mapped {
    ($closure:expr) => {
        |args| array_map(args, $closure)
    };
}

pub fn pure_function_from_name(
    s: &str,
) -> Option<fn(Spanned<Vec<Spanned<Value>>>) -> FormulaResult<Value>> {
    // When adding new functions, also update the code editor completions list
    // in `FormulaLanguageModel.ts`.
    Some(match s.to_ascii_lowercase().as_str() {
        // Comparison operators
        "=" | "==" => array_mapped!(|[a, b]| Ok(Value::Bool(a.to_string() == b.to_string()))),
        "<>" | "!=" => {
            array_mapped!(|[a, b]| Ok(Value::Bool(a.to_string() != b.to_string())))
        }
        "<" => array_mapped!(|[a, b]| Ok(Value::Bool(a.to_number()? < b.to_number()?))),
        ">" => array_mapped!(|[a, b]| Ok(Value::Bool(a.to_number()? > b.to_number()?))),
        "<=" => array_mapped!(|[a, b]| Ok(Value::Bool(a.to_number()? <= b.to_number()?))),
        ">=" => array_mapped!(|[a, b]| Ok(Value::Bool(a.to_number()? >= b.to_number()?))),

        // Mathematical operators
        "+" => |args| match args.inner.len() {
            1 => array_map(args, |[a]| Ok(Value::Number(a.to_number()?))),
            _ => array_map(args, |[a, b]| {
                Ok(Value::Number(a.to_number()? + b.to_number()?))
            }),
        },
        "-" => |args| match args.inner.len() {
            1 => array_map(args, |[a]| Ok(Value::Number(-a.to_number()?))),
            _ => array_map(args, |[a, b]| {
                Ok(Value::Number(a.to_number()? - b.to_number()?))
            }),
        },
        "*" => array_mapped!(|[a, b]| Ok(Value::Number(a.to_number()? * b.to_number()?))),
        "/" => array_mapped!(|[a, b]| Ok(Value::Number(a.to_number()? / b.to_number()?))),
        "^" | "**" => {
            array_mapped!(|[a, b]| Ok(Value::Number(a.to_number()?.powf(b.to_number()?))))
        }
        "%" => array_mapped!(|[n]| Ok(Value::Number(n.to_number()? / 100.0))),

        // Mathematics functions
        "sum" => |args| sum(&args.inner).map(Value::Number),
        "product" => |args| product(&args.inner).map(Value::Number),

        // Statistics functions
        // TODO: many of these have strange behavior when given zero arguments
        "average" => |args| Ok(Value::Number(sum(&args.inner)? / count(&args.inner) as f64)),
        "count" => |args| Ok(Value::Number(count(&args.inner) as f64)),
        "min" => |args| {
            Ok(Value::Number(
                flat_iter_numbers(&args.inner).try_fold(f64::INFINITY, |ret, next| {
                    FormulaResult::Ok(f64::min(ret, next?))
                })?,
            ))
        },
        "max" => |args| {
            Ok(Value::Number(
                flat_iter_numbers(&args.inner).try_fold(-f64::INFINITY, |ret, next| {
                    FormulaResult::Ok(f64::max(ret, next?))
                })?,
            ))
        },

        // Logic functions (non-short-circuiting)
        "true" => constant_function!(Ok(Value::Bool(true))),
        "false" => constant_function!(Ok(Value::Bool(false))),
        "not" => array_mapped!(|[a]| Ok(Value::Bool(!a.to_bool()?))),
        "and" => |args| {
            flat_iter_bools(&args.inner)
                .try_fold(true, |ret, next| FormulaResult::Ok(ret & next?))
                .map(Value::Bool)
        },
        "or" => |args| {
            flat_iter_bools(&args.inner)
                .try_fold(false, |ret, next| FormulaResult::Ok(ret | next?))
                .map(Value::Bool)
        },
        "xor" => |args| {
            flat_iter_bools(&args.inner)
                .try_fold(false, |ret, next| FormulaResult::Ok(ret ^ next?))
                .map(Value::Bool)
        },
        "if" => {
            array_mapped!(|[cond, t, f]| { Ok(if cond.to_bool()? { t.inner } else { f.inner }) })
        }

        // String functions
        "&" => {
            array_mapped!(|[a, b]| Ok(Value::String(a.to_string() + &b.to_string())))
        }
        "concat" => |args| {
            Ok(Value::String(
                flat_iter_strings(&args.inner)
                    .try_fold(String::new(), |ret, next| FormulaResult::Ok(ret + &next?))?,
            ))
        },

        _ => return None,
    })
}

fn sum(args: &[Spanned<Value>]) -> FormulaResult<f64> {
    flat_iter_numbers(args).try_fold(0.0, |sum, next| FormulaResult::Ok(sum + next?))
}
fn product(args: &[Spanned<Value>]) -> FormulaResult<f64> {
    flat_iter_numbers(args).try_fold(1.0, |prod, next| FormulaResult::Ok(prod * next?))
}
fn count(args: &[Spanned<Value>]) -> usize {
    args.iter().map(|v| v.inner.count()).sum()
}

fn flat_iter_numbers<'a>(
    args: &'a [Spanned<Value>],
) -> impl 'a + Iterator<Item = FormulaResult<f64>> {
    args.iter().map(|v| v.to_numbers()).flatten_ok()
}
fn flat_iter_bools<'a>(
    args: &'a [Spanned<Value>],
) -> impl 'a + Iterator<Item = FormulaResult<bool>> {
    args.iter().map(|v| v.to_bools()).flatten_ok()
}
fn flat_iter_strings<'a>(
    args: &'a [Spanned<Value>],
) -> impl 'a + Iterator<Item = FormulaResult<String>> {
    args.iter().map(|v| v.to_strings()).flatten_ok()
}

/// Maps a fixed-argument-count function over arguments that may be arrays.
pub fn array_map<const N: usize>(
    args: Spanned<Vec<Spanned<Value>>>,
    mut op: impl FnMut([Spanned<Value>; N]) -> FormulaResult<Value>,
) -> FormulaResult<Value> {
    let (args, array_size) = args_with_common_array_size(args)?;
    match array_size {
        // Compute the results. If any argument is not an array, pretend it's an
        // array of one element repeated with the right size.
        Some((rows, cols)) => {
            let mut output_array = Vec::with_capacity(rows);
            for row in 0..rows {
                let mut output_row = SmallVec::with_capacity(cols);
                for col in 0..cols {
                    let output_value = op(args
                        .iter()
                        .map(|arg| arg.get_array_value(row, col))
                        .collect::<FormulaResult<Vec<_>>>()?
                        .try_into()
                        .unwrap())?;
                    output_row.push(output_value);
                }
                output_array.push(output_row);
            }
            Ok(Value::Array(output_array))
        }

        // No operands are arrays, so just do the operation once.
        None => op(args),
    }
}

/// Returns the common `(rows, cols)` of several arguments, or `None` if no
/// arguments are arrays.
pub fn args_with_common_array_size<const N: usize>(
    args: Spanned<Vec<Spanned<Value>>>,
) -> FormulaResult<([Spanned<Value>; N], Option<(usize, usize)>)> {
    // Check argument count.
    let args: [Spanned<Value>; N] = args
        .inner
        .try_into()
        .map_err(|_| FormulaErrorMsg::BadArgumentCount.with_span(args.span))?;

    let mut array_sizes_iter = args
        .iter()
        .filter_map(|arg| Some((arg.span, arg.inner.array_size()?)));

    if let Some((_span, array_size)) = array_sizes_iter.next() {
        // Check that all the arrays are the same size.
        for (error_span, other_array_size) in array_sizes_iter {
            if array_size != other_array_size {
                return Err(FormulaErrorMsg::ArraySizeMismatch {
                    expected: array_size,
                    got: other_array_size,
                }
                .with_span(error_span));
            }
        }

        Ok((args, Some(array_size)))
    } else {
        Ok((args, None))
    }
}

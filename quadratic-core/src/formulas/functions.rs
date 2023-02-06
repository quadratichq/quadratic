use itertools::Itertools;

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
        |args| array_mapped(args.inner, $closure)
    };
}

pub fn function_from_name(
    s: &str,
) -> Option<fn(Spanned<Vec<Spanned<Value>>>) -> FormulaResult<Value>> {
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
        "sum" => |args| sum(&args.inner).map(Value::Number),
        "+" => array_mapped!(|[a, b]| Ok(Value::Number(a.to_number()? + b.to_number()?))),
        "-" => array_mapped!(|[a, b]| Ok(Value::Number(a.to_number()? - b.to_number()?))),
        "product" => |args| product(&args.inner).map(Value::Number),
        "*" => array_mapped!(|[a, b]| Ok(Value::Number(a.to_number()? * b.to_number()?))),
        "/" => array_mapped!(|[a, b]| Ok(Value::Number(a.to_number()? / b.to_number()?))),
        "^" | "**" => {
            array_mapped!(|[a, b]| Ok(Value::Number(a.to_number()?.powf(b.to_number()?))))
        }
        "%" => array_mapped!(|[n]| Ok(Value::Number(n.to_number()? / 100.0))),

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

/// Produces a function that takes a fixed argument count and can be mapped over
/// arrays.
fn array_mapped<const N: usize>(
    args: Vec<Spanned<Value>>,
    op: fn([Spanned<Value>; N]) -> FormulaResult<Value>,
) -> FormulaResult<Value> {
    // Check argument count.
    let args: [Spanned<Value>; N] = args
        .try_into()
        .map_err(|_| FormulaErrorMsg::BadArgumentCount)?;

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

        // Compute the results. If any argument is not an array, pretend it's an
        // array of one element repeated with the right size.
        let (rows, cols) = array_size;
        Ok(Value::Array(
            (0..rows)
                .map(|row| {
                    (0..cols)
                        .map(|col| {
                            op(args
                                .iter()
                                .map(|arg| arg.get_array_value(row, col))
                                .collect::<FormulaResult<Vec<_>>>()?
                                .try_into()
                                .unwrap())
                        })
                        .try_collect()
                })
                .try_collect()?,
        ))
    } else {
        // No operands are arrays, so just do the operation once.
        op(args)
    }
}

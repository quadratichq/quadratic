use itertools::Itertools;

use super::*;

macro_rules! fixed_arg_count {
    ($n:tt, |$args_pat:tt| $result:expr) => {
        |args| {
            let $args_pat: [Spanned<Value>; $n] = args
                .try_into()
                .map_err(|_| FormulaErrorMsg::BadArgumentCount)?;
            $result
        }
    };
}

pub fn function_from_name(s: &str) -> Option<fn(Vec<Spanned<Value>>) -> FormulaResult<Value>> {
    Some(match s.to_ascii_lowercase().as_str() {
        // Comparison operators
        "=" | "==" => fixed_arg_count!(2, |[a, b]| Ok(Value::Bool(a.to_string() == b.to_string()))),
        "<>" | "!=" => {
            fixed_arg_count!(2, |[a, b]| Ok(Value::Bool(a.to_string() != b.to_string())))
        }
        "<" => fixed_arg_count!(2, |[a, b]| Ok(Value::Bool(a.to_number()? < b.to_number()?))),
        ">" => fixed_arg_count!(2, |[a, b]| Ok(Value::Bool(a.to_number()? > b.to_number()?))),
        "<=" => fixed_arg_count!(2, |[a, b]| Ok(Value::Bool(
            a.to_number()? <= b.to_number()?
        ))),
        ">=" => fixed_arg_count!(2, |[a, b]| Ok(Value::Bool(
            a.to_number()? >= b.to_number()?
        ))),

        // Mathematical operators
        "sum" => |args| sum(&args).map(Value::Number),
        "+" => fixed_arg_count!(2, |[a, b]| Ok(Value::Number(
            a.to_number()? + b.to_number()?
        ))),
        "-" => fixed_arg_count!(2, |[a, b]| Ok(Value::Number(
            a.to_number()? - b.to_number()?
        ))),
        "product" => |args| product(&args).map(Value::Number),
        "*" => fixed_arg_count!(2, |[a, b]| Ok(Value::Number(
            a.to_number()? * b.to_number()?
        ))),
        "/" => fixed_arg_count!(2, |[a, b]| Ok(Value::Number(
            a.to_number()? / b.to_number()?
        ))),
        "^" | "**" => fixed_arg_count!(2, |[a, b]| Ok(Value::Number(
            a.to_number()?.powf(b.to_number()?)
        ))),
        "%" => fixed_arg_count!(1, |[n]| Ok(Value::Number(n.to_number()? / 100.0))),

        // Logic functions (non-short-circuiting)
        "true" => fixed_arg_count!(0, |_| Ok(Value::Bool(true))),
        "false" => fixed_arg_count!(0, |_| Ok(Value::Bool(false))),
        "not" => fixed_arg_count!(1, |[a]| Ok(Value::Bool(!a.to_bool()?))),
        "and" => |args| {
            flat_iter_bools(&args)
                .try_fold(true, |ret, next| FormulaResult::Ok(ret & next?))
                .map(Value::Bool)
        },
        "or" => |args| {
            flat_iter_bools(&args)
                .try_fold(false, |ret, next| FormulaResult::Ok(ret | next?))
                .map(Value::Bool)
        },
        "xor" => |args| {
            flat_iter_bools(&args)
                .try_fold(false, |ret, next| FormulaResult::Ok(ret ^ next?))
                .map(Value::Bool)
        },
        "if" => fixed_arg_count!(3, |[cond, t, f]| {
            Ok(if cond.to_bool()? { t.inner } else { f.inner })
        }),

        // Statistics functions
        // TODO: many of these have strange behavior when given zero arguments
        "average" => |args| Ok(Value::Number(sum(&args)? / count(&args) as f64)),
        "count" => |args| Ok(Value::Number(count(&args) as f64)),
        "min" => |args| {
            Ok(Value::Number(
                flat_iter_numbers(&args).try_fold(f64::INFINITY, |ret, next| {
                    FormulaResult::Ok(f64::min(ret, next?))
                })?,
            ))
        },
        "max" => |args| {
            Ok(Value::Number(
                flat_iter_numbers(&args).try_fold(-f64::INFINITY, |ret, next| {
                    FormulaResult::Ok(f64::max(ret, next?))
                })?,
            ))
        },

        // String functions
        "&" => fixed_arg_count!(2, |[left, right]| Ok(Value::String(
            left.to_string() + &right.to_string()
        ))),
        "concat" => |args| {
            Ok(Value::String(
                flat_iter_strings(&args)
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

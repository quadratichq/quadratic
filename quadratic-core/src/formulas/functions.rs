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
        "+" | "sum" => |args| sum(&args).map(Value::Number),
        "-" => |args| minus(&args).map(Value::Number),
        "*" | "product" => fixed_arg_count!(2, |[a, b]| Ok(Value::Number(
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
            args.into_iter()
                .try_fold(true, |ret, next| FormulaResult::Ok(ret & next.to_bool()?))
                .map(Value::Bool)
        },
        "or" => |args| {
            args.into_iter()
                .try_fold(false, |ret, next| FormulaResult::Ok(ret | next.to_bool()?))
                .map(Value::Bool)
        },
        "xor" => |args| {
            args.into_iter()
                .try_fold(false, |ret, next| FormulaResult::Ok(ret ^ next.to_bool()?))
                .map(Value::Bool)
        },
        "if" => fixed_arg_count!(3, |[cond, t, f]| {
            Ok(if cond.to_bool()? { t.inner } else { f.inner })
        }),

        // Statistics functions
        // TODO: many of these have strange behavior when given zero arguments
        "average" => |args| Ok(Value::Number(sum(&args)? / args.len() as f64)),
        "count" => |args| Ok(Value::Number(args.len() as f64)),
        "min" => |args| {
            Ok(Value::Number(
                args.into_iter().try_fold(f64::INFINITY, |ret, next| {
                    FormulaResult::Ok(f64::min(ret, next.to_number()?))
                })?,
            ))
        },
        "max" => |args| {
            Ok(Value::Number(
                args.into_iter().try_fold(-f64::INFINITY, |ret, next| {
                    FormulaResult::Ok(f64::max(ret, next.to_number()?))
                })?,
            ))
        },

        // String functions
        "&" | "concat" => |args| Ok(Value::String(args.into_iter().join(""))),

        _ => return None,
    })
}

fn sum(args: &[Spanned<Value>]) -> FormulaResult<f64> {
    Ok(args
        .into_iter()
        .try_fold(0.0, |sum, next| FormulaResult::Ok(sum + next.to_number()?))?)
}

fn minus(args: &[Spanned<Value>]) -> FormulaResult<f64> {
    if args.len() == 0 {
        Ok(0.0)
    } else if args.len() == 1 {
        Ok(-args[0].to_number()?)
    } else {
        let mut ret = args[0].to_number()?;
        for arg in &args[1..] {
            ret -= arg.to_number()?;
        }
        Ok(ret)
    }
}

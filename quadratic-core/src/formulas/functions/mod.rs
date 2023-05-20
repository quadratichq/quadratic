use futures::{future::LocalBoxFuture, FutureExt};
use itertools::Itertools;
use lazy_static::lazy_static;
use std::collections::HashMap;

#[macro_use]
mod util;
mod logic;
mod lookup;
mod mathematics;
mod operators;
mod statistics;
mod string;
mod trigonometry;

use super::{Ctx, FormulaErrorMsg, FormulaResult, Span, Spanned, Value};

pub fn lookup_function(name: &str) -> Option<&'static FormulaFunction> {
    ALL_FUNCTIONS.get(name.to_ascii_uppercase().as_str())
}

pub const CATEGORIES: &[FormulaFunctionCategory] = &[
    operators::CATEGORY,
    mathematics::CATEGORY,
    trigonometry::CATEGORY,
    statistics::CATEGORY,
    logic::CATEGORY,
    string::CATEGORY,
    lookup::CATEGORY,
];

lazy_static! {
    pub static ref ALL_FUNCTIONS: HashMap<&'static str, FormulaFunction> = {
        CATEGORIES
            .iter()
            .flat_map(|category| (category.get_functions)())
            .map(|function| (function.name, function))
            .collect()
    };
}

pub type FormulaFn = Box<
    dyn 'static
        + Send
        + Sync
        + for<'a> Fn(
            &'a mut Ctx<'_>,
            Spanned<Vec<Spanned<Value>>>,
        ) -> LocalBoxFuture<'a, FormulaResult>,
>;

type NonVariadicPureFn<const N: usize> = fn([Spanned<Value>; N]) -> FormulaResult;
type NonVariadicFn<const N: usize> = fn(&mut Ctx<'_>, [Spanned<Value>; N]) -> FormulaResult;

pub struct FormulaFunction {
    pub name: &'static str,
    pub arg_completion: &'static str,
    pub usages: &'static [&'static str],
    pub examples: &'static [&'static str],
    pub doc: &'static str,
    pub eval: FormulaFn,
}
impl FormulaFunction {
    /// Constructs a function for an operator that can be called with one or two
    /// arguments.
    fn variadic_operator<const N1: usize, const N2: usize>(
        name: &'static str,
        eval_monadic: Option<NonVariadicFn<N1>>,
        eval_dyadic: Option<NonVariadicFn<N2>>,
    ) -> Self {
        FormulaFunction {
            name,
            arg_completion: "",
            usages: &[],
            examples: &[],
            doc: "",
            eval: Box::new(move |ctx, args| {
                async move {
                    if args.inner.len() == N1 {
                        let Some(eval_fn) = eval_monadic else {
                            return Err(FormulaErrorMsg::BadArgumentCount.with_span(args.span));
                        };
                        ctx.array_map(args, eval_fn).await
                    } else {
                        let Some(eval_fn) = eval_dyadic else {
                            return Err(FormulaErrorMsg::BadArgumentCount.with_span(args.span));
                        };
                        ctx.array_map(args, eval_fn).await
                    }
                }
                .boxed_local()
            }),
        }
    }

    /// Constructs an operator that can be called with a fixed number of
    /// arguments.
    fn operator<const N: usize>(name: &'static str, eval_fn: NonVariadicPureFn<N>) -> Self {
        Self {
            name,
            arg_completion: "",
            usages: &[],
            examples: &[],
            doc: "",
            eval: util::array_mapped(eval_fn),
        }
    }

    /// Returns a user-friendly string containing the usages of this function,
    /// delimited by newlines.
    pub fn usages_strings(&self) -> impl Iterator<Item = String> {
        let name = self.name;
        self.usages
            .iter()
            .map(move |args| format!("{name}({args})"))
    }

    /// Returns the autocomplete snippet for this function.
    pub fn autocomplete_snippet(&self) -> String {
        let name = self.name;
        let arg_completion = self.arg_completion;
        format!("{name}({arg_completion})")
    }

    /// Returns the Markdown documentation for this function that should appear
    /// in the formula editor via the language server.
    pub fn lsp_full_docs(&self) -> String {
        let mut ret = String::new();
        if !self.doc.is_empty() {
            ret.push_str(&format!("# Description\n\n{}\n\n", self.doc));
        }
        if !self.examples.is_empty() {
            let examples = self.examples.iter().map(|s| format!("- `{s}`\n")).join("");
            ret.push_str(&format!("# Examples\n\n{examples}\n\n"));
        }
        ret
    }
}

pub struct FormulaFunctionCategory {
    pub include_in_docs: bool,
    pub include_in_completions: bool,
    pub name: &'static str,
    pub docs: &'static str,
    pub get_functions: fn() -> Vec<FormulaFunction>,
}

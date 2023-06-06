use futures::{future::LocalBoxFuture, FutureExt};
use itertools::Itertools;
use lazy_static::lazy_static;
use std::collections::{HashMap, VecDeque};

#[macro_use]
mod macros;
mod logic;
mod lookup;
mod mathematics;
mod operators;
mod statistics;
mod string;
mod trigonometry;
mod util;

use super::{
    Array, BasicValue, CellRef, CoerceInto, Criterion, Ctx, FormulaErrorMsg, FormulaResult, Param,
    ParamKind, Span, Spanned, SpannedIterExt, Value,
};

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
    /// Map containing all functions.
    pub static ref ALL_FUNCTIONS: HashMap<&'static str, FormulaFunction> = {
        let functions_list = CATEGORIES
            .iter()
            .flat_map(|category| (category.get_functions)())
            .map(|function| (function.name, function))
            .collect_vec();
        let count = functions_list.len();
        let functions_hashmap = functions_list.into_iter().collect::<HashMap<_,_>>();

        // Check that there's no duplicate names, which would show up as
        // missing/overwritten entries in the hashmap.
        assert_eq!(count, functions_hashmap.len(), "duplicate function names!");

        functions_hashmap
    };
}

/// Argument values passed to a formula function.
pub struct FormulaFnArgs {
    pub span: Span,
    values: VecDeque<Spanned<Value>>,
    func_name: &'static str,
    args_popped: usize,
}
impl FormulaFnArgs {
    /// Constructs a set of arguments values.
    pub fn new(
        values: impl Into<VecDeque<Spanned<Value>>>,
        span: Span,
        func_name: &'static str,
    ) -> Self {
        Self {
            span,
            values: values.into(),
            func_name,
            args_popped: 0,
        }
    }
    /// Takes the next argument, or returns `None` if there is none.
    pub fn take_next_optional(&mut self) -> Option<Spanned<Value>> {
        if !self.values.is_empty() {
            self.args_popped += 1;
        }
        self.values.pop_front()
    }
    /// Takes the next argument, or returns an error if there is none.
    pub fn take_next_required(&mut self, arg_name: &'static str) -> FormulaResult<Spanned<Value>> {
        self.take_next_optional().ok_or_else(|| {
            FormulaErrorMsg::MissingRequiredArgument {
                func_name: self.func_name,
                arg_name,
            }
            .with_span(self.span)
        })
    }
    /// Takes the rest of the arguments and iterates over them.
    pub fn take_rest(&mut self) -> impl Iterator<Item = Spanned<Value>> {
        std::mem::take(&mut self.values).into_iter()
    }

    /// Returns an error if there are any arguments that have not been taken.
    pub fn error_if_more_args(&self) -> FormulaResult<()> {
        if let Some(next_arg) = self.values.front() {
            Err(FormulaErrorMsg::TooManyArguments {
                func_name: self.func_name,
                max_arg_count: self.args_popped,
            }
            .with_span(next_arg.span))
        } else {
            Ok(())
        }
    }
}

/// Function pointer that represents the body of a formula function.
pub type FormulaFn =
    for<'a> fn(&'a mut Ctx<'_>, FormulaFnArgs) -> LocalBoxFuture<'a, FormulaResult<Value>>;

/// Formula function with associated metadata.
pub struct FormulaFunction {
    pub name: &'static str,
    pub arg_completion: &'static str,
    pub usage: &'static str,
    pub examples: &'static [&'static str],
    pub doc: &'static str,
    pub eval: FormulaFn,
}
impl FormulaFunction {
    /// Returns a user-friendly string containing the usages of this function,
    /// delimited by newlines.
    pub fn usages_string(&self) -> String {
        let name = self.name;
        let args = self.usage;
        format!("{name}({args})")
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

/// Formula function category with associated metadata, plus a function pointer
/// to generate a list of all the functions in the category.
pub struct FormulaFunctionCategory {
    pub include_in_docs: bool,
    pub include_in_completions: bool,
    pub name: &'static str,
    pub docs: &'static str,
    pub get_functions: fn() -> Vec<FormulaFunction>,
}

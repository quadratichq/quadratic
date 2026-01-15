use std::borrow::Cow;
use std::collections::{HashMap, VecDeque};

use itertools::Itertools;
use lazy_static::lazy_static;

#[macro_use]
mod macros;
mod array;
mod database;
mod datetime;
mod engineering;
pub mod excel;
mod financial;
mod logic;
mod lookup;
mod mathematics;
mod operators;
mod statistics;
mod string;
mod tests;
mod trigonometry;

use super::{Criterion, Ctx, Param, ParamKind, util};
use crate::{
    Array, Axis, CellValue, CodeResult, CoerceInto, Duration, IsBlank, RunError, RunErrorMsg, Span,
    Spanned, SpannedIterExt, Value, cellvalue::TextSpan,
};

pub use lookup::IndexFunctionArgs;

#[inline]
pub fn lookup_function(name: &str) -> Option<&'static FormulaFunction> {
    ALL_FUNCTIONS.get(
        excel::remove_excel_function_prefix(name)
            .to_ascii_uppercase()
            .as_str(),
    )
}

pub const CATEGORIES: &[FormulaFunctionCategory] = &[
    operators::CATEGORY,
    mathematics::CATEGORY,
    trigonometry::CATEGORY,
    statistics::CATEGORY,
    logic::CATEGORY,
    string::CATEGORY,
    array::CATEGORY,
    datetime::CATEGORY,
    lookup::CATEGORY,
    financial::CATEGORY,
    engineering::CATEGORY,
    database::CATEGORY,
    #[cfg(test)]
    tests::CATEGORY,
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
    /// Constructs a list of arguments values.
    #[inline]
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
    /// Returns whether there is another argument.
    #[inline]
    pub fn has_next(&self) -> bool {
        !self.values.is_empty()
    }
    /// Takes the next argument.
    #[inline]
    fn take_next(&mut self) -> Option<Spanned<Value>> {
        if !self.values.is_empty() {
            self.args_popped += 1;
        }
        self.values.pop_front()
    }
    /// Takes the next argument, or returns `None` if there is none or the
    /// argument is blank˙.
    #[inline]
    pub fn take_next_optional(&mut self) -> Option<Spanned<Value>> {
        self.take_next()
            .filter(|v| v.inner != Value::Single(CellValue::Blank))
    }
    /// Takes the next argument, or returns an error if there is none.
    #[inline]
    pub fn take_next_required(
        &mut self,
        arg_name: impl Into<Cow<'static, str>>,
    ) -> CodeResult<Spanned<Value>> {
        self.take_next().ok_or_else(|| {
            RunErrorMsg::MissingRequiredArgument {
                func_name: self.func_name.into(),
                arg_name: arg_name.into(),
            }
            .with_span(self.span)
        })
    }
    /// Takes the rest of the arguments and iterates over them.
    #[inline]
    pub fn take_rest(&mut self) -> impl Iterator<Item = Spanned<Value>> + use<> {
        std::mem::take(&mut self.values).into_iter()
    }

    /// Returns an error if there are no more arguments.
    #[inline]
    pub fn error_if_no_more_args(&self, arg_name: impl Into<Cow<'static, str>>) -> CodeResult<()> {
        if !self.values.is_empty() {
            Ok(())
        } else {
            Err(RunErrorMsg::MissingRequiredArgument {
                func_name: self.func_name.into(),
                arg_name: arg_name.into(),
            }
            .with_span(self.span))
        }
    }

    /// Returns an error if there are any arguments that have not been taken.
    #[inline]
    pub fn error_if_more_args(&self) -> CodeResult<()> {
        if let Some(next_arg) = self.values.front() {
            Err(RunErrorMsg::TooManyArguments {
                func_name: self.func_name.into(),
                max_arg_count: self.args_popped,
            }
            .with_span(next_arg.span))
        } else {
            Ok(())
        }
    }
}

/// Function pointer that represents the body of a formula function.
pub type FormulaFn = for<'a> fn(&'a mut Ctx<'_>, FormulaFnArgs) -> CodeResult<Value>;

/// Formula function with associated metadata.
pub struct FormulaFunction {
    pub name: &'static str,
    pub arg_completion: Option<&'static str>,
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

    /// Returns the documentation string after stripping leading spaces. Leading
    /// spaces show up because we define formula docs using `/// stuff` syntax.
    pub fn docs_string(&self) -> String {
        self.doc.trim_start().replace("\n ", "\n")
    }

    /// Returns the autocomplete snippet for this function.
    pub fn autocomplete_snippet(&self) -> String {
        let name = self.name;
        match self.arg_completion {
            Some(arg_completion) => format!("{name}({arg_completion})"),
            None => name.to_string(),
        }
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
    pub docs: Option<&'static str>,
    pub get_functions: fn() -> Vec<FormulaFunction>,
}

#[test]
fn test_autocomplete_snippet() {
    assert_eq!(
        "TRUE",
        ALL_FUNCTIONS.get("TRUE").unwrap().autocomplete_snippet(),
    );
    assert_eq!(
        "PI()",
        ALL_FUNCTIONS.get("PI").unwrap().autocomplete_snippet(),
    );
    assert_eq!(
        "NOT(${1:boolean})",
        ALL_FUNCTIONS.get("NOT").unwrap().autocomplete_snippet(),
    );
    assert_eq!(
        "IF(${1:condition}, ${2:t}, ${3:f})",
        ALL_FUNCTIONS.get("IF").unwrap().autocomplete_snippet(),
    );
    assert_eq!(
        "IF(${1:condition}, ${2:t}, ${3:f})",
        ALL_FUNCTIONS.get("IF").unwrap().autocomplete_snippet(),
    );

    // Optional
    assert_eq!(
        "SUMIF(${1:eval_range}, ${2:criteria}${3:, ${4:[sum_range]}})",
        ALL_FUNCTIONS.get("SUMIF").unwrap().autocomplete_snippet(),
    );
}

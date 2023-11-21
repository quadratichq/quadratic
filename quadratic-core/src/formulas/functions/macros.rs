//! Macros for defining formula functions.
//!
//! `formula_fn!` is the entry point; other macros generally should not be
//! called by outside code.

/// Outputs a string containing a sentence linking to the documentation for
/// user-specification of criteria used in `SUMIF`, `COUNTIF`, and `AVERAGEIF`.
/// The string begins with a space.
///
/// This is a macro instead of a constant so that it can be used with `concat!`
/// or `#[doc]`.
macro_rules! see_docs_for_more_about_criteria {
    () => { " See [the documentation](https://docs.quadratichq.com/formulas) for more details about how criteria work in formulas." };
}

/// Outputs a string containing a sentence linking to the documentation for
/// user-specification of wildcards used in `SUMIF`, `COUNTIF`, `AVERAGEIF`, and
/// `XLOOKUP`. The string begins with a space.
///
/// This is a macro instead of a constant so that it can be used with `concat!`
/// or `#[doc]`.
macro_rules! see_docs_for_more_about_wildcards {
    () => {
        " See [the documentation](https://docs.quadratichq.com/formulas#31e708d41a1a497f8677ff01dddff38b) for more details about how wildcards work in formulas."
    };
}

/// Macro to generate a `FormulaFunction` which contains an implementation of a
/// function along with its documentation. This macro also generates code to
/// check the number of arguments passed to the function at runtime.
///
/// The return value of the function is automatically converted to a `Value` and
/// given the appropriate span.
///
/// # Examples
///
/// ```ignore
/// formula_fn!(
///     /// Adds all values.
///     /// Returns `0` if given no values.
///     #[example("SUM(B2:C6, 15, E1)")]
///     fn SUM(numbers: (Iter<f64>)) {
///         numbers.sum::<CodeResult<f64>>()
///     }
/// );
/// ```
///
/// ```ignore
/// formula_fn!(
///     /// Returns the square root of a number.
///     #[example("SQRT(2)")]
///     #[zip_map]
///     fn SQRT([number]: f64) {
///         number.sqrt()
///     }
/// );
/// ```
///
/// # Workarounds
///
/// If you ever need to do something wacky that this macro doesn't support, you
/// can just manually construct a `FormulaFunction` instead. If you're stuck on
/// what to put for `eval`, start with this:
///
/// ```ignore
/// Box::new(move |ctx, args| ...)
/// ```
///
/// Remember to write a check that all required arguments are present and that
/// there are no extraneous arguments.
///
/// # Attributes
///
/// Attributes must be specified in the order listed below.
///
/// - `#[doc = "..."]` (or doc comments using `///`) - user-facing documentation
/// - `#[operator]` - removes the function from documentation
/// - `#[examples("EXAMPLE()", "EXAMPLE(A, B)")]` - example usages
/// - `#[zip_map]` - if certain arguments are arrays, **zip** them together
///                       and **map** a **pure** function over them.
///
/// # Parameter syntax
///
/// **Parameter types that are more than just a single token must be surrounded
/// by parens.** (This is due to limitations in the Rust macro system; the type
/// must be parsed as a single `tt` because `ty` makes the original tokens
/// inaccessible.)
///
/// Primitive types:
/// - `Value` - keep as `Value` (do not coerce)
/// - `CellValue` - coerce to `CellValue` (reject or flatten arrays)
/// - `Array` - coerce to `Array`
/// - `String` - coerce to `String`
/// - `f64` - coerce to `f64`
/// - `bool` - coerce to `bool`
///
/// Generic types:
/// - `arg: Option< ... >` - optional argument (type is `Option< ... >`)
/// - `arg: Iter< ... >` - repeating argument (type is `impl Iterator<Item= ... >`)
/// - `arg: Spanned< ... >` - include span information (type is `Spanned< ...
///                           >`)
/// - `arg: Spanned<Option< ... >>` - optional argument with span information
///                                   (type is `Option<Spanned< ... >>`)
///
/// Special types:
/// - `Ctx` - context (type is `Ctx<'_>`)
/// - `Span` - span of the function call (type is `Span`)
///
/// Additionally, if the parameter name is surrounded by square brackets (such
/// as `[arg]: f64`) then if the argument is an array then the function will be
/// mapped over all values in that array. If multiple parameters are surrounded
/// by square brackets (or the parameter surrounded by square brackets is a
/// repeating parameter) then the repeating arguments will be zipped together
/// first. The `#[zip_map]` attribute is required for this to work.
macro_rules! formula_fn {
    (
        #[operator]
        $(#[$($attr:tt)*])*
        fn $fn_name:literal( $($params:tt)* ) { $($body:tt)* }
    ) => {
        $crate::formulas::functions::FormulaFunction {
            name: $fn_name,
            arg_completion: None,
            usage: "",
            examples: &[],
            doc: "",
            eval: formula_fn_eval!(
                { $($body)* };
                $(#[$($attr)*])*
                $($params)*
            ),
        }
    };

    (
        #[doc = $doc:expr]
        $(#[doc = $additional_doc:expr])*
        $(#[include_args_in_completion($include_args_in_completion:expr)])?
        #[examples($($example_str:expr),+ $(,)?)]
        $(#[$($attr:tt)*])*
        fn $fn_name:ident( $($params:tt)* ) { $($body:tt)* }
    ) => {{
        let params_list = params_list!($($params)*);

        // Default to `true`
        let include_args_in_completion = [$($include_args_in_completion, )? true][0];

        $crate::formulas::functions::FormulaFunction {
            name: stringify!($fn_name),
            arg_completion: include_args_in_completion.then(|| {
                $crate::formulas::params::arg_completion_string(&params_list)
            }),
            usage: $crate::formulas::params::usage_string(&params_list),
            examples: &[$($example_str),+],
            doc: concat!($doc $(, "\n", $additional_doc)*),
            eval: formula_fn_eval!(
                { $($body)* };
                $(#[$($attr)*])*
                $($params)*
            ),
        }
    }};
}

/// Constructs the `eval` function for a `FormulaFunction`.
macro_rules! formula_fn_eval {
    ($($tok:tt)*) => {{
        #[allow(unused_mut)]
        let ret: FormulaFn = |_ctx: &mut Ctx<'_>, mut _args: FormulaFnArgs| -> CodeResult<Value> {
            formula_fn_eval_inner!(_ctx, _args, $($tok)*)
        };
        ret
    }};
}

/// Constructs the body of the `eval` function for a `FormulaFunction`.
macro_rules! formula_fn_eval_inner {
    (
        $ctx:ident, $args:ident, $body:expr;
        #[zip_map]
        $($params:tt)*
    ) => {{
        // Arguments that should be zip-mapped. (See `Ctx::zip_map()`.)
        let mut args_to_zip_map = vec![];

        // Check number of arguments and assign arguments to variables.
        formula_fn_args!(@zip($ctx, $args, args_to_zip_map); $($params)*);
        $args.error_if_more_args()?;

        $ctx.zip_map(
            &args_to_zip_map,
            move |_ctx, zipped_args| -> CodeResult<CellValue> {
                formula_fn_args!(@unzip(_ctx, zipped_args); $($params)*);

                // Evaluate the body of the function.
                CodeResult::Ok(CellValue::from($body))
            },
        )
    }};

    (
        $ctx:ident, $args:ident, $body:expr;
        #[zip_map]
        $($params:tt)*
    ) => {{
        // Arguments that should be zip-mapped. (See `Ctx::zip_map()`.)
        let mut args_to_zip_map = vec![];

        // Check number of arguments and assign arguments to variables.
        formula_fn_args!(@zip($ctx, $args, args_to_zip_map); $($params)*);
        $args.error_if_more_args()?;

        $ctx.zip_map(
            &args_to_zip_map,
            move |ctx, zipped_args| {
                formula_fn_args!(@unzip(ctx, zipped_args); $($params)*);

                // Evaluate the body of the function.
                CodeResult::Ok(CellValue::from($body))
            },
        )
    }};

    (
        $ctx:ident, $args:ident, $body:expr;
        $($params:tt)*
    ) => {{
        // Check number of arguments and assign arguments to variables.
        formula_fn_args!(@assign($ctx, $args); $($params)*);
        $args.error_if_more_args()?;

        // Evaluate the body of the function.
        Ok(Value::from($body))
    }};
}

macro_rules! formula_fn_args {
    (@$instruction:tt $data:tt; $($arg_name:tt: $arg_type:tt),* $(,)?) => {
        $(
            formula_fn_arg!(@$instruction $data; $arg_name: $arg_type);
        )*
    };
    (@$instruction:tt $data:tt; $($arg_tok:tt)*) => {
        compile_error!(
            "bad parameter syntax. complex types must be surrounded \
             by parens (e.g., `(Iter<f64>)` instead of `Iter<f64>`) \
             due to macro parsing limitations."
        )
    }
}

/// Fetches an argument, converts it to a specific type, and stores it in a
/// variable for use by the caller.
///
/// The spaces inside `< ... >` in this macro are often necessary; we don't want
/// Rust to treat `>>` as a single token.
macro_rules! formula_fn_arg {
    // Remove unnecessary parens
    (@$instruction:tt $data:tt; $arg_name:tt: ($($arg_type:tt)*)) => {
        formula_fn_arg!(@$instruction $data; $arg_name: $($arg_type)*)
    };

    // Missing `#[zip_map]` attribute
    (@assign $data:tt; [$arg_name:ident]: $($arg_type:tt)*) => {
        compile_error!("add #[zip_map] attribute to your formula function")
    };

    // Context argument
    (@assign($ctx:ident, $args:ident); $arg_name:ident: Ctx) => {
        let $arg_name: &mut Ctx<'_> = &mut *$ctx; // Reborrow context
    };
    // Span argument
    (@assign($ctx:ident, $args:ident); $arg_name:ident: Span) => {
        let $arg_name = $args.span;
    };

    // Zip-mapped context argument
    (@zip($ctx:ident, $args:ident, $args_to_zip_map:ident); $arg_name:ident: Ctx) => {
        // Do nothing; we will assign this argument only when unzipping.
    };
    (@unzip($ctx:ident, $zipped_args:ident); $arg_name:ident: Ctx) => {
        let $arg_name: &mut Ctx<'_> = &mut *$ctx; // Reborrow context
    };

    // Non zip-mapped argument in zip-mapped function
    (@zip($ctx:ident, $args:ident, $args_to_zip_map:ident); $arg_name:ident: Iter< $($arg_type:tt)*) => {
        formula_fn_arg!(@assign($ctx, $args); $arg_name: Iter< $($arg_type)*);
        let $arg_name = $arg_name.collect::<CodeResult<Vec<_>>>()?;
    };
    (@zip($ctx:ident, $args:ident, $args_to_zip_map:ident); $arg_name:ident: $($arg_type:tt)*) => {
        formula_fn_arg!(@assign($ctx, $args); $arg_name: $($arg_type)*)
    };
    (@unzip($ctx:ident, $zipped_args:ident); $arg_name:ident: $($arg_type:tt)*) => {
        // Only a reference should be accessible, because this code may be
        // executed many times.
        let $arg_name = &$arg_name;
    };

    // Repeating argument
    (@assign($ctx:ident, $args:ident); $arg_name:ident: Iter< Spanned< Value > >) => {
        // Do not flatten `Value`s.
        let mut $arg_name = $args.take_rest().map(CodeResult::Ok);
    };
    (@assign($ctx:ident, $args:ident); $arg_name:ident: Iter< Spanned< Array > >) => {
        // Do not flatten arrays.
        let mut $arg_name = $args.take_rest().map(Array::from).map(CodeResult::Ok);
    };
    (@assign($ctx:ident, $args:ident); $arg_name:ident: Iter< Spanned< $($arg_type:tt)*) => {
        // Flatten into iterator over non-array type.
        let remaining_args = $args.take_rest();
        let $arg_name = remaining_args.flat_map(|arg_value| {
            formula_fn_convert_arg!(arg_value, Value -> Iter< Spanned< $($arg_type)*)
        });
    };
    (@assign($ctx:ident, $args:ident); $arg_name:ident: Iter< $($arg_type:tt)*) => {
        // $($arg_type)* will include an extra `>` at the end, and that's ok.
        formula_fn_arg!(@assign($ctx, $args); $arg_name: Iter< Spanned< $($arg_type)* >);
        let mut $arg_name = $arg_name.without_spans();
    };

    // Optional argument
    (@assign($ctx:ident, $args:ident); $arg_name:ident: Option< $($arg_type:tt)*) => {
        let $arg_name = match $args.take_next_optional() {
            // $($arg_type)* will include an extra `>` at the end, and that's ok.
            Some(arg_value) => Some(formula_fn_convert_arg!(arg_value, Value -> $($arg_type)*)),
            None => None,
        };
    };

    // Required argument
    (@assign($ctx:ident, $args:ident); $arg_name:ident: $($arg_type:tt)*) => {
        let arg_value = $args.take_next_required(stringify!($arg_name))?;
        let $arg_name = formula_fn_convert_arg!(arg_value, Value -> $($arg_type)*);
    };

    // Zip-mapped repeating argument
    (@zip($ctx:ident, $args:ident, $args_to_zip_map:ident); [$arg_name:ident]: Iter< $($arg_type:tt)*) => {
        formula_fn_arg!(@assign($ctx, $args); $arg_name: Iter< _ >);
        let i = $args_to_zip_map.len();
        $args_to_zip_map.extend($arg_name);
        let j = $args_to_zip_map.len();
        // Store the range in `$arg_name`.
        let $arg_name = i..j;
    };
    (@unzip($ctx:ident, $zipped_args:ident); [$arg_name:ident]: Iter< $($arg_type:tt)*) => {
        // Grab the range stored above and unpack the argument into `$arg_name`
        // where the user of the macro expects it to be.
        let $arg_name = $zipped_args[$arg_name].iter().map(|arg_value| {
            // There's an extra trailing `>` in `$($arg_type)*` but that's ok.
            formula_fn_convert_arg!(arg_value, CellValue -> $($arg_type)*)
        });
    };

    // Zip-mapped optional argument
    (@zip($ctx:ident, $args:ident, $args_to_zip_map:ident); [$arg_name:ident]: Option< $($arg_type:tt)*) => {
        // If the argument is present, store it in `$args_to_zip_map` and store
        // the index in `$arg_name`.
        let $arg_name: Option<usize>;
        match $args.take_next_optional() {
            Some(arg_value) => {
                $arg_name = Some($args_to_zip_map.len());
                $args_to_zip_map.push(arg_value);
            }
            None => $arg_name = None,
        }
    };
    (@unzip($ctx:ident, $zipped_args:ident); [$arg_name:ident]: Option< $($arg_type:tt)*) => {
        // Grab the index stored above and unpack the argument into `$arg_name`
        // where the user of the macro expects it to be.
        let $arg_name = match $arg_name {
            // There's an extra trailing `>` in `$($arg_type)*` but that's ok.
            Some(i) => Some(formula_fn_convert_arg!(&$zipped_args[i], CellValue -> $($arg_type)*)),
            None => None,
        };
    };

    // Zip-mapped required argument
    (@zip($ctx:ident, $args:ident, $args_to_zip_map:ident); [$arg_name:ident]: $($arg_type:tt)*) => {
        // Store the actual argument in `$args_to_zip_map`, and store its index
        // in `$arg_name`.
        let $arg_name = $args_to_zip_map.len();
        $args_to_zip_map.push($args.take_next_required(stringify!($arg_name))?);
    };
    (@unzip($ctx:ident, $zipped_args:ident); [$arg_name:ident]: $($arg_type:tt)*) => {
        // Grab the index stored above and unpack the argument into `$arg_name`
        // where the user of the macro expects it to be.
        let arg_value = &$zipped_args[$arg_name];
        let $arg_name = formula_fn_convert_arg!(arg_value, CellValue -> $($arg_type)*);
    };
}

/// Converts a value to a specific type.
///
/// The spaces inside `< ... >` in this macro are often necessary; it's
/// important that Rust doesn't see `>>` and think it's a single token.
macro_rules! formula_fn_convert_arg {
    ($value:expr, $($arg_type:tt)*) => {
        formula_fn_convert_arg!(@retokenize ($value,) $($arg_type)*)
    };

    // Convert `>>` to two separate tokens `> >`. I don't like that we have to
    // do this.
    (@retokenize ($($done:tt)*) >> $($rest:tt)*) => {
        formula_fn_convert_arg!(@retokenize ($($done)* > >) $($rest)*)
    };
    (@retokenize ($($done:tt)*) $tok:tt $($rest:tt)*) => {
        formula_fn_convert_arg!(@retokenize ($($done)* $tok) $($rest)*)
    };
    (@retokenize ($($done:tt)*)) => {
        formula_fn_convert_arg!(@convert $($done)*)
    };

    // No conversion
    (@convert $value:expr, Value -> Spanned< Value > $(>)?) => {
        $value
    };
    (@convert $value:expr, CellValue -> Spanned< CellValue > $(>)?) => {
        $value
    };
    (@convert $value:expr, CellValue -> Spanned< Value > $(>)?) => {
        compile_error!("unnecessary conversion from `CellValue` to `Value`; \
                        change the argument to have type `CellValue`")
    };

    // Iterate
    (@convert $value:expr, Value -> Iter< Spanned< CellValue > > $(>)*) => {
        $value.into_iter_cell_values()
    };
    (@convert $value:expr, Value -> Iter< Spanned< $inner_type:ty > > $(>)*) => {
        $value.into_iter::<$inner_type>()
    };
    (@convert $value:expr, Value -> Iter< $($inner_type:tt)* $(>)*) => {
        formula_fn_convert_arg!(@convert $value, Iter< Spanned< $inner_type > >).unspanned()
    };

    // Generic conversion
    (@convert $value:expr, Value -> Spanned< CellValue > $(>)?) => {
        $value.into_cell_value()?
    };
    (@convert $value:expr, Value -> Spanned< Array > $(>)?) => {
        $value.map(Array::from)
    };
    (@convert $value:expr, Value -> Spanned< $arg_type:ty > $(>)?) => {
        $value.try_coerce::<$arg_type>()?
    };
    (@convert $value:expr, CellValue -> Spanned< $arg_type:ty > $(>)?) => {
        $value.try_coerce::<$arg_type>()?
    };

    // Unspanned conversion
    (@convert $value:expr, $orig:tt -> Spanned< $($arg_type:tt)*) => {
        compile_error!(concat!("invalid type: ", stringify!($($arg_type)*)))
    };
    (@convert $value:expr, $orig:tt -> $($arg_type:tt)*) => {
        formula_fn_convert_arg!(@convert $value, $orig -> Spanned< $($arg_type)* >).inner
    };
}

macro_rules! params_list {
    // Remove square brackets
    (@append($result:ident, [$arg_name:ident], $($arg_type:tt)*)) => {
        params_list!(@append($result, $arg_name, $($arg_type)*))
    };

    // Context argument (not user-visible)
    (@append($result:ident, $name:ident, Ctx)) => {};
    // Span argument (not user-visible)
    (@append($result:ident, $name:ident, Span)) => {};

    // Normal argument
    (@append($result:ident, $arg_name:ident, $($arg_type:tt)*)) => {
        $result.push(Param {
            name: stringify!($arg_name),
            kind: params_list!(@get_kind $($arg_type)*),
            zip_mapped: params_list!(@get_is_zip_mapped $arg_name),
        })
    };

    (@get_kind (Iter<$($rest:tt)*)) => { ParamKind::Repeating };
    (@get_kind (Option<$($rest:tt)*)) => { ParamKind::Optional };
    (@get_kind $arg_type:tt) => { ParamKind::Required };

    (@get_is_zip_mapped [$arg_name:ident]) => { true };
    (@get_is_zip_mapped $arg_name:ident) => { false };

    // Entry points (at the bottom so that the other rules take priority)
    () => { vec![] };
    ($($arg_name:tt: $arg_type:tt),+ $(,)?) => {{
        let mut result = vec![];

        $(
            params_list!(@append(result, $arg_name, $arg_type));
        )*
        result
    }};
}

use std::borrow::Cow;

use itertools::Itertools;
use serde::{Deserialize, Serialize};
use smallvec::smallvec;

use super::*;
use crate::{
    Array, ArraySize, CellValue, CodeResult, CoerceInto, Pos, RunErrorMsg, SheetRect, Spanned,
    Value,
    a1::{
        CellRefCoord, CellRefRange, CellRefRangeEnd, RefRangeBounds, SheetCellRefRange, UNBOUNDED,
        column_name,
    },
    formulas::LambdaValue,
    grid::SheetId,
};

/// Abstract syntax tree of a formula expression.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Formula {
    pub ast: AstNode,
}

pub type AstNode = Spanned<AstNodeContents>;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum AstNodeContents {
    Empty,
    FunctionCall {
        func: Spanned<String>,
        args: Vec<AstNode>,
    },
    Paren(Vec<AstNode>),
    Array(Vec<Vec<AstNode>>),
    CellRef(Option<SheetId>, RefRangeBounds),
    RangeRef(SheetCellRefRange),
    String(String),
    Number(f64),
    Bool(bool),
    Error(RunErrorMsg),
}
impl AstNodeContents {
    fn type_string(&self) -> &'static str {
        match self {
            AstNodeContents::Empty => "empty expression",
            AstNodeContents::FunctionCall { func, .. } => match func.inner.as_str() {
                "=" | "==" | "<>" | "!=" | "<" | ">" | "<=" | ">=" => "comparison",
                s if s.chars().all(|c| c.is_alphanumeric() || c == '_') => "function call",
                _ => "expression", // could be improved to say what kind of expression
            },
            AstNodeContents::Paren(contents) => match contents.len() {
                0 => "empty tuple", // shouldn't ever happen
                1 => contents[0].inner.type_string(),
                _ => "tuple",
            },
            AstNodeContents::Array(_) => "array literal",
            AstNodeContents::CellRef(_, _) => "cell reference",
            AstNodeContents::RangeRef(_) => "cell range reference",
            AstNodeContents::String(_) => "string literal",
            AstNodeContents::Number(_) => "numeric literal",
            AstNodeContents::Bool(_) => "boolean literal",
            AstNodeContents::Error(_) => "error literal",
        }
    }

    /// Tries to extract an identifier name from this AST node.
    ///
    /// This is used for LAMBDA parameter names. A valid identifier is:
    /// - A CellRef that represents a column-only reference (e.g., "X" becomes column 24)
    /// - A String literal
    ///
    /// Returns `None` if the node cannot be interpreted as an identifier.
    fn try_as_identifier(&self) -> Option<String> {
        match self {
            AstNodeContents::CellRef(None, bounds) => {
                // Check if this is a column-only reference (no row number)
                // A column reference has:
                // - start.col and end.col are the same (single column)
                // - start.row = 1, end.row = UNBOUNDED (full column range)
                // - col is not UNBOUNDED
                if bounds.start.col == bounds.end.col
                    && bounds.start.col.coord != UNBOUNDED
                    && bounds.start.row.coord == 1
                    && bounds.end.row.coord == UNBOUNDED
                {
                    Some(column_name(bounds.start.col.coord))
                } else {
                    None
                }
            }
            AstNodeContents::String(s) => Some(s.clone()),
            _ => None,
        }
    }
}

impl Formula {
    /// Evaluates a formula.
    pub fn eval(&self, ctx: &mut Ctx<'_>) -> Spanned<Value> {
        self.ast.eval(ctx)
    }
}

impl AstNode {
    /// Evaluates an AST node. Errors are converted to [`CellValue::Error`].
    pub(crate) fn eval<'expr, 'ctx: 'expr>(
        &'expr self,
        ctx: &'expr mut Ctx<'ctx>,
    ) -> Spanned<Value> {
        self.eval_to_result(ctx).unwrap_or_else(|e| Spanned {
            span: self.span,
            inner: e.into(),
        })
    }

    /// Helper function used by `eval()` so that we can use `?` for error
    /// propagation.
    fn eval_to_result<'expr, 'ctx: 'expr>(&'expr self, ctx: &'expr mut Ctx<'ctx>) -> CodeResult {
        let value: Value = match &self.inner {
            AstNodeContents::Empty => Value::Single(CellValue::Blank),

            AstNodeContents::FunctionCall { func, .. } if func.inner == ":" => {
                let range = self.to_ref_range(ctx)?;
                let rect = ctx.resolve_range_ref(&range, self.span, true)?;
                let array = ctx.get_cell_array(rect.inner, self.span)?;

                Value::Array(array.inner)
            }

            // Special handling for LAMBDA
            AstNodeContents::FunctionCall { func, args }
                if func.inner.eq_ignore_ascii_case("LAMBDA") =>
            {
                // LAMBDA(param1, param2, ..., body)
                // All arguments except the last are parameter names
                // The last argument is the body expression (kept unevaluated)
                if args.is_empty() {
                    return Err(RunErrorMsg::MissingRequiredArgument {
                        func_name: "LAMBDA".into(),
                        arg_name: "body".into(),
                    }
                    .with_span(self.span));
                }

                let (param_nodes, body_node) = args.split_at(args.len() - 1);

                // Extract parameter names from the first N-1 arguments
                let mut params = Vec::with_capacity(param_nodes.len());
                for param_node in param_nodes {
                    let param_name = param_node.inner.try_as_identifier().ok_or_else(|| {
                        RunErrorMsg::Expected {
                            expected: "parameter name".into(),
                            got: Some(param_node.inner.type_string().into()),
                        }
                        .with_span(param_node.span)
                    })?;
                    params.push(param_name);
                }

                // The body is the last argument (kept as unevaluated AST)
                let body = body_node[0].clone();

                Value::Lambda(LambdaValue::new(params, body))
            }

            // Special handling for ISOMITTED
            AstNodeContents::FunctionCall { func, args }
                if func.inner.eq_ignore_ascii_case("ISOMITTED") =>
            {
                // ISOMITTED(parameter_name)
                // Returns TRUE if the parameter was omitted in a LAMBDA call, FALSE otherwise
                if args.is_empty() {
                    return Err(RunErrorMsg::MissingRequiredArgument {
                        func_name: "ISOMITTED".into(),
                        arg_name: "value".into(),
                    }
                    .with_span(self.span));
                }
                if args.len() > 1 {
                    return Err(RunErrorMsg::TooManyArguments {
                        func_name: "ISOMITTED".into(),
                        max_arg_count: 1,
                    }
                    .with_span(args[1].span));
                }

                // Check if the argument is a variable reference that was omitted
                let arg = &args[0];
                let is_omitted = match &arg.inner {
                    AstNodeContents::CellRef(None, _) => {
                        // Try to extract the identifier name
                        if let Some(identifier) = arg.inner.try_as_identifier() {
                            ctx.is_variable_omitted(&identifier)
                        } else {
                            false
                        }
                    }
                    _ => false,
                };

                Value::from(is_omitted)
            }

            // Special handling for LET
            AstNodeContents::FunctionCall { func, args }
                if func.inner.eq_ignore_ascii_case("LET") =>
            {
                // LET(name1, value1, name2, value2, ..., calculation)
                // Arguments come in pairs (name, value) followed by final calculation
                // Minimum: LET(name, value, calculation) = 3 arguments
                if args.len() < 3 {
                    return Err(RunErrorMsg::MissingRequiredArgument {
                        func_name: "LET".into(),
                        arg_name: if args.is_empty() {
                            "name1".into()
                        } else if args.len() == 1 {
                            "value1".into()
                        } else {
                            "calculation".into()
                        },
                    }
                    .with_span(self.span));
                }

                // Must have odd number of arguments: pairs + calculation
                if args.len() % 2 == 0 {
                    return Err(RunErrorMsg::MissingRequiredArgument {
                        func_name: "LET".into(),
                        arg_name: "calculation".into(),
                    }
                    .with_span(self.span));
                }

                // Build bindings from name-value pairs
                let mut bindings: Vec<(String, Value)> = Vec::new();
                let num_pairs = (args.len() - 1) / 2;

                for i in 0..num_pairs {
                    let name_node = &args[i * 2];
                    let value_node = &args[i * 2 + 1];

                    // Extract variable name
                    let var_name = name_node.inner.try_as_identifier().ok_or_else(|| {
                        RunErrorMsg::Expected {
                            expected: "variable name".into(),
                            got: Some(name_node.inner.type_string().into()),
                        }
                        .with_span(name_node.span)
                    })?;

                    // Evaluate value with current bindings (allows referencing earlier variables)
                    let mut child_ctx = ctx.with_bindings(&bindings);
                    let value = value_node.eval(&mut child_ctx).inner;

                    bindings.push((var_name, value));
                }

                // Evaluate calculation with all bindings
                let calculation_node = &args[args.len() - 1];
                let mut child_ctx = ctx.with_bindings(&bindings);
                calculation_node.eval(&mut child_ctx).inner
            }

            // Special handling for lambda invocation
            // __LAMBDA_INVOKE__(callee, arg1, arg2, ...) - generated by parser for expr(args) syntax
            AstNodeContents::FunctionCall { func, args } if func.inner == "__LAMBDA_INVOKE__" => {
                if args.is_empty() {
                    return Err(RunErrorMsg::MissingRequiredArgument {
                        func_name: "lambda invocation".into(),
                        arg_name: "callee".into(),
                    }
                    .with_span(self.span));
                }

                // Evaluate the callee (first argument)
                let callee_value = args[0].eval(&mut *ctx).inner;

                match callee_value {
                    Value::Lambda(lambda) => {
                        // Check argument count - allow fewer arguments (for ISOMITTED support)
                        // but not more arguments than parameters
                        let call_args = &args[1..];
                        if call_args.len() > lambda.param_count() {
                            return Err(RunErrorMsg::TooManyArguments {
                                func_name: "LAMBDA".into(),
                                max_arg_count: lambda.param_count(),
                            }
                            .with_span(self.span));
                        }

                        // Evaluate the call arguments
                        let arg_values: Vec<Value> = call_args
                            .iter()
                            .map(|arg| arg.eval(&mut *ctx).inner)
                            .collect();

                        // Create bindings from parameters to argument values
                        // Parameters without arguments get a blank value and are marked as omitted
                        let mut bindings: Vec<(String, Value)> = Vec::new();
                        let mut omitted: Vec<String> = Vec::new();

                        for (i, param) in lambda.params.iter().enumerate() {
                            if let Some(value) = arg_values.get(i) {
                                bindings.push((param.clone(), value.clone()));
                            } else {
                                // Parameter is omitted - bind to blank value
                                bindings.push((param.clone(), Value::Single(CellValue::Blank)));
                                omitted.push(param.clone());
                            }
                        }

                        // Create child context with bindings and omitted variables, then evaluate body
                        let mut child_ctx = ctx.with_bindings_and_omitted(&bindings, &omitted);
                        lambda.body.eval(&mut child_ctx).inner
                    }
                    _ => {
                        return Err(RunErrorMsg::Expected {
                            expected: "lambda".into(),
                            got: Some(match callee_value {
                                Value::Single(cv) => cv.type_name().into(),
                                Value::Array(_) => "array".into(),
                                Value::Tuple(_) => "tuple".into(),
                                Value::Lambda(_) => unreachable!(),
                            }),
                        }
                        .with_span(args[0].span));
                    }
                }
            }

            // Other operator/function
            AstNodeContents::FunctionCall { func, args } => {
                let func_name = &func.inner;
                match functions::lookup_function(func_name) {
                    Some(f) => {
                        let arg_values = args.iter().map(|arg| arg.eval(&mut *ctx)).collect_vec();
                        let args = FormulaFnArgs::new(arg_values, self.span, f.name);
                        (f.eval)(&mut *ctx, args)?
                    }
                    None => {
                        if functions::excel::is_valid_excel_function(func_name) {
                            return Err(RunErrorMsg::Unimplemented(func_name.clone().into())
                                .with_span(func.span));
                        } else {
                            return Err(RunErrorMsg::BadFunctionName.with_span(func.span));
                        }
                    }
                }
            }

            AstNodeContents::Paren(contents) => {
                let mut expressions = contents
                    .iter()
                    .flat_map(|expr| expr.eval(ctx).inner.into_arrays())
                    .collect_vec();
                if expressions.len() == 1 {
                    expressions
                        .pop()
                        .ok_or(RunErrorMsg::InternalError("empty parens".into()))?
                        .into()
                } else {
                    Value::Tuple(expressions)
                }
            }

            AstNodeContents::Array(a) => {
                let is_empty = a.iter().flatten().next().is_none();
                if is_empty {
                    return Err(RunErrorMsg::EmptyArray.with_span(self.span));
                }
                let width = a[0].len();
                let height = a.len();

                let mut flat_array = smallvec![];
                for row in a {
                    if row.len() != width {
                        return Err(RunErrorMsg::NonRectangularArray.with_span(self.span));
                    }
                    for elem_expr in row {
                        flat_array.push(elem_expr.eval(ctx).into_cell_value()?.inner);
                    }
                }

                let size = ArraySize::new_or_err(width as u32, height as u32)?;
                Array::new_row_major(size, flat_array)?.into()
            }

            // Single cell references: first check if it's a variable, then treat as cell reference
            AstNodeContents::CellRef(sheet_id, _) => {
                // Check if this CellRef could be a variable reference
                if sheet_id.is_none()
                    && let Some(identifier) = self.inner.try_as_identifier()
                    && let Some(value) = ctx.lookup_variable(&identifier)
                {
                    return Ok(Spanned {
                        span: self.span,
                        inner: value.clone(),
                    });
                }
                // Not a variable, treat as cell reference
                let ref_range = self.to_ref_range(ctx)?;
                let sheet_rect = ctx.resolve_range_ref(&ref_range, self.span, true)?.inner;
                ctx.get_cell_array(sheet_rect, self.span)?.inner.into()
            }

            AstNodeContents::RangeRef(_) => {
                let ref_range = self.to_ref_range(ctx)?;
                let sheet_rect = ctx.resolve_range_ref(&ref_range, self.span, true)?.inner;
                ctx.get_cell_array(sheet_rect, self.span)?.inner.into()
            }

            AstNodeContents::String(s) => Value::from(s.to_string()),
            AstNodeContents::Number(n) => Value::from(*n),
            AstNodeContents::Bool(b) => Value::from(*b),
            AstNodeContents::Error(e) => {
                Value::Single(CellValue::Error(Box::new(e.clone().with_span(self.span))))
            }
        };

        Ok(Spanned {
            span: self.span,
            inner: value,
        })
    }

    /// Evaluates the expression to a tuple of range references, or returns an
    /// error if this cannot be done
    fn to_range_ref_tuple<'expr>(
        &'expr self,
        ctx: &mut Ctx<'_>,
    ) -> CodeResult<Vec<Cow<'expr, SheetCellRefRange>>> {
        match &self.inner {
            AstNodeContents::Paren(contents) => contents
                .iter()
                .map(|expr| expr.to_range_ref_tuple(ctx))
                .flatten_ok()
                .try_collect(),
            _ => Ok(vec![self.to_ref_range(ctx)?]),
        }
    }

    /// Evaluates the expression to a cell range reference, or returns an error
    /// if this cannot be done.
    fn to_ref_range<'expr>(
        &'expr self,
        ctx: &mut Ctx<'_>,
    ) -> CodeResult<Cow<'expr, SheetCellRefRange>> {
        match &self.inner {
            AstNodeContents::FunctionCall { func, args } if func.inner == ":" => {
                if args.len() != 2 {
                    internal_error!("invalid arguments to cell range operator");
                }

                let (sheet1, range1) = args[0].to_ref_range_bounds(ctx)?;
                let (sheet2, range2) = args[1].to_ref_range_bounds(ctx)?;

                let sheet_id = match (sheet1, sheet2) {
                    (None, None) => ctx.sheet_pos.sheet_id,
                    (Some(id1), Some(id2)) if id1 != id2 => {
                        // conflicting sheet IDs
                        return Err(RunErrorMsg::BadCellReference.with_span(self.span));
                    }
                    (_, Some(id)) | (Some(id), _) => id,
                };

                let range = RefRangeBounds::combined_bounding_box(range1, range2);
                let cells = CellRefRange::Sheet { range };
                Ok(Cow::Owned(SheetCellRefRange {
                    sheet_id,
                    cells,
                    explicit_sheet_name: sheet1.is_some() || sheet2.is_some(),
                }))
            }
            AstNodeContents::Paren(contents) if contents.len() == 1 => {
                contents[0].to_ref_range(ctx)
            }
            AstNodeContents::CellRef(sheet_id, bounds) => {
                let ref_range = SheetCellRefRange {
                    sheet_id: sheet_id.unwrap_or(ctx.sheet_pos.sheet_id),
                    cells: CellRefRange::Sheet { range: *bounds },
                    explicit_sheet_name: sheet_id.is_some(),
                };
                Ok(Cow::Owned(ref_range))
            }
            AstNodeContents::RangeRef(ref_range) => Ok(Cow::Borrowed(ref_range)),
            _ => Err(RunErrorMsg::Expected {
                expected: "cell range reference".into(),
                got: Some(self.inner.type_string().into()),
            }
            .with_span(self.span)),
        }
    }

    /// Evaluates the expression to a range bound with an optional sheet ID, or
    /// returns an error if this cannot be done.
    fn to_ref_range_bounds<'expr, 'ctx: 'expr>(
        &'expr self,
        ctx: &'expr mut Ctx<'ctx>,
    ) -> CodeResult<(Option<SheetId>, RefRangeBounds)> {
        match &self.inner {
            AstNodeContents::CellRef(sheet_id, bounds) => Ok((*sheet_id, *bounds)),
            AstNodeContents::Paren(contents) if contents.len() == 1 => {
                contents[0].to_ref_range_bounds(ctx)
            }
            AstNodeContents::FunctionCall { func, args }
                if func.inner.eq_ignore_ascii_case("INDEX") =>
            {
                // Get ranges
                let range_rects: Vec<Spanned<SheetRect>> = args
                    .first()
                    .ok_or(
                        RunErrorMsg::MissingRequiredArgument {
                            func_name: "INDEX".into(),
                            arg_name: "range".into(),
                        }
                        .with_span(func.span),
                    )?
                    .to_range_ref_tuple(ctx)?
                    .into_iter()
                    .map(|range_ref| ctx.resolve_range_ref(&range_ref, self.span, true))
                    .try_collect()?;

                // Get other arguments
                let arg_values = args
                    .iter()
                    .skip(1)
                    .map(|arg| arg.eval(&mut *ctx))
                    .collect_vec();
                let mut args = FormulaFnArgs::new(arg_values, self.span, "INDEX");
                let row = args
                    .take_next_optional()
                    .map(CoerceInto::try_coerce)
                    .transpose()?;
                let column = args
                    .take_next_optional()
                    .map(CoerceInto::try_coerce)
                    .transpose()?;
                let range_num = args
                    .take_next_optional()
                    .map(CoerceInto::try_coerce)
                    .transpose()?;
                args.error_if_more_args()?;

                if ctx.skip_computation {
                    // Don't evaluate; just return a dummy value to let the
                    // caller know that this expression is valid.
                    return Ok((None, RefRangeBounds::new_relative_pos(Pos::ORIGIN)));
                }

                let args = super::functions::IndexFunctionArgs::from_values(
                    |i| Some(range_rects.get(i)?.inner.size()),
                    row,
                    column,
                    range_num,
                )?;

                let indexed_pos = &range_rects[args.tuple_index]
                    .inner
                    .index_cell(args.x, args.y)
                    .ok_or(RunErrorMsg::IndexOutOfBounds.with_span(self.span))?;

                let sheet = ctx
                    .grid_controller
                    .try_sheet(indexed_pos.sheet_id)
                    .ok_or(RunErrorMsg::IndexOutOfBounds.with_span(self.span))?;

                let range_end = CellRefRangeEnd {
                    col: CellRefCoord::new_abs(indexed_pos.x),
                    row: CellRefCoord::new_abs(indexed_pos.y),
                };

                Ok((
                    Some(sheet.id),
                    RefRangeBounds {
                        start: range_end,
                        end: range_end,
                    },
                ))
            }
            _ => Err(RunErrorMsg::Expected {
                expected: "cell reference".into(),
                got: Some(self.inner.type_string().into()),
            }
            .with_span(self.span)),
        }
    }
}

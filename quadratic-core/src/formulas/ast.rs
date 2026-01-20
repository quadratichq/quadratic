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
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Formula {
    pub ast: AstNode,
}

pub type AstNode = Spanned<AstNodeContents>;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
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
    #[inline]
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
    #[inline]
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
    #[inline]
    pub fn eval(&self, ctx: &mut Ctx<'_>) -> Spanned<Value> {
        self.ast.eval(ctx)
    }

    /// Converts the formula AST back to an A1-style formula string.
    ///
    /// This is used to display the formula in the UI. The `default_sheet_id` is
    /// used to determine when to include sheet names in cell references (if the
    /// reference is to a different sheet, the sheet name is included).
    pub fn to_a1_string(
        &self,
        default_sheet_id: Option<SheetId>,
        a1_context: &crate::a1::A1Context,
    ) -> String {
        self.ast.inner.to_a1_string(default_sheet_id, a1_context)
    }
}

impl AstNodeContents {
    /// Checks if a function name is an infix operator (binary operator between operands).
    #[inline]
    fn is_infix_operator(name: &str) -> bool {
        matches!(
            name,
            "=" | "=="
                | "<>"
                | "!="
                | "<"
                | ">"
                | "<="
                | ">="
                | "+"
                | "-"
                | "*"
                | "/"
                | "^"
                | "&"
                | ".."
        )
    }

    /// Converts the AST node back to an A1-style formula string.
    pub fn to_a1_string(
        &self,
        default_sheet_id: Option<SheetId>,
        a1_context: &crate::a1::A1Context,
    ) -> String {
        match self {
            AstNodeContents::Empty => String::new(),
            AstNodeContents::FunctionCall { func, args } => {
                // Handle range operator `:` (no spaces around it, e.g., A1:B2)
                if func.inner == ":" && args.len() == 2 {
                    let left = args[0].inner.to_a1_string(default_sheet_id, a1_context);
                    let right = args[1].inner.to_a1_string(default_sheet_id, a1_context);
                    return format!("{}:{}", left, right);
                }

                // Handle infix operators (binary operators like +, -, *, /, =, <, >, etc.)
                if Self::is_infix_operator(&func.inner) && args.len() == 2 {
                    let left = args[0].inner.to_a1_string(default_sheet_id, a1_context);
                    let right = args[1].inner.to_a1_string(default_sheet_id, a1_context);
                    return format!("{} {} {}", left, func.inner, right);
                }

                // Handle unary prefix operators (+ and - with single arg)
                if matches!(func.inner.as_str(), "+" | "-") && args.len() == 1 {
                    let operand = args[0].inner.to_a1_string(default_sheet_id, a1_context);
                    return format!("{}{}", func.inner, operand);
                }

                // Handle suffix operators (% with single arg: 50% = 0.5)
                if func.inner == "%" && args.len() == 1 {
                    let operand = args[0].inner.to_a1_string(default_sheet_id, a1_context);
                    return format!("{}%", operand);
                }

                // Regular function call
                let args_str = args
                    .iter()
                    .map(|arg| arg.inner.to_a1_string(default_sheet_id, a1_context))
                    .collect::<Vec<_>>()
                    .join(", ");
                format!("{}({})", func.inner, args_str)
            }
            AstNodeContents::Paren(contents) => {
                let inner = contents
                    .iter()
                    .map(|node| node.inner.to_a1_string(default_sheet_id, a1_context))
                    .collect::<Vec<_>>()
                    .join(", ");
                format!("({})", inner)
            }
            AstNodeContents::Array(rows) => {
                let rows_str = rows
                    .iter()
                    .map(|row| {
                        row.iter()
                            .map(|cell| cell.inner.to_a1_string(default_sheet_id, a1_context))
                            .collect::<Vec<_>>()
                            .join(", ")
                    })
                    .collect::<Vec<_>>()
                    .join("; ");
                format!("{{{}}}", rows_str)
            }
            AstNodeContents::CellRef(sheet_id, bounds) => {
                if let Some(sid) = sheet_id {
                    // Include sheet name if different from default or if default is None
                    if default_sheet_id.is_none_or(|default| default != *sid)
                        && let Some(sheet_name) = a1_context.try_sheet_id(*sid)
                    {
                        return format!("{}!{}", crate::a1::quote_sheet_name(sheet_name), bounds);
                    }
                }
                format!("{}", bounds)
            }
            AstNodeContents::RangeRef(range) => range.to_a1_string(default_sheet_id, a1_context),
            AstNodeContents::String(s) => {
                // Escape the string for formula syntax
                crate::formulas::escape_string(s)
            }
            AstNodeContents::Number(n) => {
                // Format number, avoiding unnecessary decimal points
                if n.fract() == 0.0 && n.abs() < 1e15 {
                    format!("{}", *n as i64)
                } else {
                    format!("{}", n)
                }
            }
            AstNodeContents::Bool(b) => {
                if *b {
                    "TRUE".to_string()
                } else {
                    "FALSE".to_string()
                }
            }
            AstNodeContents::Error(e) => format!("{}", e),
        }
    }
}

impl AstNode {
    /// Evaluates an AST node. Errors are converted to [`CellValue::Error`].
    #[inline]
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
    #[inline]
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
                        // TODO: consider lazy evaluation for LAMBDA args - currently all
                        // arguments are eagerly evaluated even if unused (e.g., with
                        // ISOMITTED or conditional logic), which may cause performance
                        // issues with expensive unused arguments
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
                        // Check if func_name is a variable containing a lambda
                        if let Some(Value::Lambda(lambda)) = ctx.lookup_variable(func_name).cloned()
                        {
                            // Check argument count
                            if args.len() > lambda.param_count() {
                                return Err(RunErrorMsg::TooManyArguments {
                                    func_name: "LAMBDA".into(),
                                    max_arg_count: lambda.param_count(),
                                }
                                .with_span(self.span));
                            }

                            // Evaluate the call arguments
                            // TODO: consider lazy evaluation for LAMBDA args (see other TODO above)
                            let arg_values: Vec<Value> =
                                args.iter().map(|arg| arg.eval(&mut *ctx).inner).collect();

                            // Create bindings from parameters to argument values
                            let mut bindings: Vec<(String, Value)> = Vec::new();
                            let mut omitted: Vec<String> = Vec::new();

                            for (i, param) in lambda.params.iter().enumerate() {
                                if let Some(value) = arg_values.get(i) {
                                    bindings.push((param.clone(), value.clone()));
                                } else {
                                    bindings.push((param.clone(), Value::Single(CellValue::Blank)));
                                    omitted.push(param.clone());
                                }
                            }

                            // Create child context and evaluate lambda body
                            let mut child_ctx = ctx.with_bindings_and_omitted(&bindings, &omitted);
                            lambda.body.eval(&mut child_ctx).inner
                        } else if functions::excel::is_valid_excel_function(func_name) {
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
    #[inline]
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
    #[inline]
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
    #[inline]
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::a1::{A1Context, CellRefCoord, CellRefRangeEnd};
    use crate::formulas::parser::simple_parse_formula;

    /// Helper to create a column-only reference bounds (e.g., "X" = column 24)
    fn column_ref_bounds(col: i64) -> RefRangeBounds {
        RefRangeBounds {
            start: CellRefRangeEnd {
                col: CellRefCoord::new_rel(col),
                row: CellRefCoord::new_rel(1),
            },
            end: CellRefRangeEnd {
                col: CellRefCoord::new_rel(col),
                row: CellRefCoord::REL_UNBOUNDED,
            },
        }
    }

    #[test]
    fn test_try_as_identifier_column_reference() {
        // Column A (1) should return "A"
        let node = AstNodeContents::CellRef(None, column_ref_bounds(1));
        assert_eq!(node.try_as_identifier(), Some("A".to_string()));

        // Column X (24) should return "X"
        let node = AstNodeContents::CellRef(None, column_ref_bounds(24));
        assert_eq!(node.try_as_identifier(), Some("X".to_string()));

        // Column Z (26) should return "Z"
        let node = AstNodeContents::CellRef(None, column_ref_bounds(26));
        assert_eq!(node.try_as_identifier(), Some("Z".to_string()));

        // Column AA (27) should return "AA"
        let node = AstNodeContents::CellRef(None, column_ref_bounds(27));
        assert_eq!(node.try_as_identifier(), Some("AA".to_string()));
    }

    #[test]
    fn test_try_as_identifier_string_literal() {
        // String literals should return the string
        let node = AstNodeContents::String("myVar".to_string());
        assert_eq!(node.try_as_identifier(), Some("myVar".to_string()));

        let node = AstNodeContents::String("".to_string());
        assert_eq!(node.try_as_identifier(), Some("".to_string()));

        let node = AstNodeContents::String("hello_world".to_string());
        assert_eq!(node.try_as_identifier(), Some("hello_world".to_string()));
    }

    #[test]
    fn test_try_as_identifier_cell_ref_with_sheet_id() {
        // CellRef with a sheet ID should return None
        let sheet_id = crate::grid::SheetId::TEST;
        let node = AstNodeContents::CellRef(Some(sheet_id), column_ref_bounds(1));
        assert_eq!(node.try_as_identifier(), None);
    }

    #[test]
    fn test_try_as_identifier_non_column_ref() {
        // Cell reference like A1 (specific cell, not column-only)
        let bounds = RefRangeBounds {
            start: CellRefRangeEnd::new_relative_xy(1, 1),
            end: CellRefRangeEnd::new_relative_xy(1, 1),
        };
        let node = AstNodeContents::CellRef(None, bounds);
        assert_eq!(node.try_as_identifier(), None);

        // Range like A1:B5
        let bounds = RefRangeBounds {
            start: CellRefRangeEnd::new_relative_xy(1, 1),
            end: CellRefRangeEnd::new_relative_xy(2, 5),
        };
        let node = AstNodeContents::CellRef(None, bounds);
        assert_eq!(node.try_as_identifier(), None);

        // Column range like A:C (multiple columns)
        let bounds = RefRangeBounds {
            start: CellRefRangeEnd {
                col: CellRefCoord::new_rel(1),
                row: CellRefCoord::new_rel(1),
            },
            end: CellRefRangeEnd {
                col: CellRefCoord::new_rel(3),
                row: CellRefCoord::REL_UNBOUNDED,
            },
        };
        let node = AstNodeContents::CellRef(None, bounds);
        assert_eq!(node.try_as_identifier(), None);

        // Row reference like 1:1
        let bounds = RefRangeBounds {
            start: CellRefRangeEnd {
                col: CellRefCoord::new_rel(1),
                row: CellRefCoord::new_rel(1),
            },
            end: CellRefRangeEnd {
                col: CellRefCoord::REL_UNBOUNDED,
                row: CellRefCoord::new_rel(1),
            },
        };
        let node = AstNodeContents::CellRef(None, bounds);
        assert_eq!(node.try_as_identifier(), None);

        // Unbounded column reference
        let bounds = RefRangeBounds {
            start: CellRefRangeEnd {
                col: CellRefCoord::REL_UNBOUNDED,
                row: CellRefCoord::new_rel(1),
            },
            end: CellRefRangeEnd {
                col: CellRefCoord::REL_UNBOUNDED,
                row: CellRefCoord::REL_UNBOUNDED,
            },
        };
        let node = AstNodeContents::CellRef(None, bounds);
        assert_eq!(node.try_as_identifier(), None);
    }

    #[test]
    fn test_try_as_identifier_other_node_types() {
        // Other node types should return None
        assert_eq!(AstNodeContents::Empty.try_as_identifier(), None);
        assert_eq!(AstNodeContents::Number(42.0).try_as_identifier(), None);
        assert_eq!(AstNodeContents::Bool(true).try_as_identifier(), None);
        assert_eq!(
            AstNodeContents::Error(RunErrorMsg::DivideByZero).try_as_identifier(),
            None
        );
        assert_eq!(AstNodeContents::Paren(vec![]).try_as_identifier(), None);
        assert_eq!(AstNodeContents::Array(vec![]).try_as_identifier(), None);
    }

    // =========================================================================
    // Tests for to_a1_string - converting AST back to formula string
    // =========================================================================

    /// Helper to parse a formula and convert it back to a string
    fn roundtrip_formula(input: &str) -> String {
        let formula = simple_parse_formula(input).expect("Failed to parse formula");
        let a1_context = A1Context::default();
        formula.to_a1_string(None, &a1_context)
    }

    #[test]
    fn test_to_a1_string_literals() {
        // Numbers
        assert_eq!(roundtrip_formula("=42"), "42");
        assert_eq!(roundtrip_formula("=3.14"), "3.14");
        assert_eq!(roundtrip_formula("=0"), "0");
        assert_eq!(roundtrip_formula("=-5"), "-5");

        // Booleans
        assert_eq!(roundtrip_formula("=true"), "TRUE");
        assert_eq!(roundtrip_formula("=FALSE"), "FALSE");

        // Strings
        assert_eq!(roundtrip_formula(r#"="hello""#), r#""hello""#);
        assert_eq!(roundtrip_formula(r#"="hello world""#), r#""hello world""#);
        assert_eq!(roundtrip_formula(r#"="""#), r#""""#);
    }

    #[test]
    fn test_to_a1_string_cell_references() {
        // Simple cell references
        assert_eq!(roundtrip_formula("=A1"), "A1");
        assert_eq!(roundtrip_formula("=B2"), "B2");
        assert_eq!(roundtrip_formula("=Z100"), "Z100");
        assert_eq!(roundtrip_formula("=AA1"), "AA1");

        // Absolute references
        assert_eq!(roundtrip_formula("=$A$1"), "$A$1");
        assert_eq!(roundtrip_formula("=$A1"), "$A1");
        assert_eq!(roundtrip_formula("=A$1"), "A$1");

        // Ranges
        assert_eq!(roundtrip_formula("=A1:B2"), "A1:B2");
        assert_eq!(roundtrip_formula("=$A$1:$B$2"), "$A$1:$B$2");
    }

    #[test]
    fn test_to_a1_string_comparison_operators() {
        assert_eq!(roundtrip_formula("=A1 = 10"), "A1 = 10");
        assert_eq!(roundtrip_formula("=A1 > 10"), "A1 > 10");
        assert_eq!(roundtrip_formula("=A1 < 10"), "A1 < 10");
        assert_eq!(roundtrip_formula("=A1 >= 10"), "A1 >= 10");
        assert_eq!(roundtrip_formula("=A1 <= 10"), "A1 <= 10");
        assert_eq!(roundtrip_formula("=A1 <> 10"), "A1 <> 10");
    }

    #[test]
    fn test_to_a1_string_arithmetic_operators() {
        assert_eq!(roundtrip_formula("=A1 + B1"), "A1 + B1");
        assert_eq!(roundtrip_formula("=A1 - B1"), "A1 - B1");
        assert_eq!(roundtrip_formula("=A1 * B1"), "A1 * B1");
        assert_eq!(roundtrip_formula("=A1 / B1"), "A1 / B1");
        assert_eq!(roundtrip_formula("=A1 ^ 2"), "A1 ^ 2");
    }

    #[test]
    fn test_to_a1_string_string_concat_operator() {
        assert_eq!(
            roundtrip_formula(r#"="Hello" & " World""#),
            r#""Hello" & " World""#
        );
        assert_eq!(roundtrip_formula("=A1 & B1"), "A1 & B1");
    }

    #[test]
    fn test_to_a1_string_unary_operators() {
        // Unary minus
        assert_eq!(roundtrip_formula("=-A1"), "-A1");
        // Unary plus
        assert_eq!(roundtrip_formula("=+A1"), "+A1");
        // Percentage
        assert_eq!(roundtrip_formula("=50%"), "50%");
        assert_eq!(roundtrip_formula("=A1%"), "A1%");
    }

    #[test]
    fn test_to_a1_string_range_operator() {
        assert_eq!(roundtrip_formula("=1..10"), "1 .. 10");
    }

    #[test]
    fn test_to_a1_string_function_calls() {
        // Simple functions
        assert_eq!(roundtrip_formula("=SUM(A1:A10)"), "SUM(A1:A10)");
        assert_eq!(roundtrip_formula("=AVERAGE(A1:A10)"), "AVERAGE(A1:A10)");
        assert_eq!(roundtrip_formula("=COUNT(A1:A10)"), "COUNT(A1:A10)");

        // Multiple arguments
        assert_eq!(
            roundtrip_formula("=IF(A1 > 10, TRUE, FALSE)"),
            "IF(A1 > 10, TRUE, FALSE)"
        );
        assert_eq!(roundtrip_formula("=MAX(1, 2, 3)"), "MAX(1, 2, 3)");

        // Nested functions
        assert_eq!(
            roundtrip_formula("=SUM(ABS(A1), ABS(B1))"),
            "SUM(ABS(A1), ABS(B1))"
        );

        // No arguments
        assert_eq!(roundtrip_formula("=NOW()"), "NOW()");
        assert_eq!(roundtrip_formula("=TODAY()"), "TODAY()");
    }

    #[test]
    fn test_to_a1_string_parentheses() {
        assert_eq!(roundtrip_formula("=(A1 + B1) * C1"), "(A1 + B1) * C1");
        assert_eq!(roundtrip_formula("=A1 * (B1 + C1)"), "A1 * (B1 + C1)");
    }

    #[test]
    fn test_to_a1_string_arrays() {
        assert_eq!(roundtrip_formula("={1, 2, 3}"), "{1, 2, 3}");
        assert_eq!(roundtrip_formula("={1; 2; 3}"), "{1; 2; 3}");
        assert_eq!(roundtrip_formula("={1, 2; 3, 4}"), "{1, 2; 3, 4}");
    }

    #[test]
    fn test_to_a1_string_complex_formulas() {
        // Conditional formatting style formulas
        assert_eq!(roundtrip_formula("=A1 > 10"), "A1 > 10");
        assert_eq!(roundtrip_formula("=$A1 > $B$1"), "$A1 > $B$1");

        // Complex expressions
        assert_eq!(
            roundtrip_formula("=IF(AND(A1 > 0, B1 < 100), A1 * B1, 0)"),
            "IF(AND(A1 > 0, B1 < 100), A1 * B1, 0)"
        );

        // Nested arithmetic
        assert_eq!(
            roundtrip_formula("=(A1 + B1) / (C1 - D1)"),
            "(A1 + B1) / (C1 - D1)"
        );
    }

    #[test]
    fn test_to_a1_string_number_formatting() {
        // Integers should not have decimal points
        assert_eq!(roundtrip_formula("=1"), "1");
        assert_eq!(roundtrip_formula("=100"), "100");
        assert_eq!(roundtrip_formula("=1000000"), "1000000");

        // Floats should preserve decimals
        assert_eq!(roundtrip_formula("=1.5"), "1.5");
        assert_eq!(roundtrip_formula("=3.14159"), "3.14159");
    }

    #[test]
    fn test_to_a1_string_operator_precedence() {
        // The AST structure inherently encodes operator precedence through nesting.
        // Higher-precedence operations are nested deeper in the tree.
        // When the parser encounters explicit parentheses, it creates a Paren node,
        // which is preserved during serialization. Without explicit parens, the
        // AST structure follows natural precedence, and round-tripping is correct.

        // Test that formulas without parens serialize correctly
        // (precedence is encoded in AST nesting, not in the string)
        assert_eq!(roundtrip_formula("=1 + 2 * 3"), "1 + 2 * 3");
        assert_eq!(roundtrip_formula("=1 * 2 + 3"), "1 * 2 + 3");
        assert_eq!(roundtrip_formula("=A1 + B1 * C1"), "A1 + B1 * C1");

        // Test that formulas WITH explicit parens preserve them
        assert_eq!(roundtrip_formula("=(1 + 2) * 3"), "(1 + 2) * 3");
        assert_eq!(roundtrip_formula("=1 * (2 + 3)"), "1 * (2 + 3)");
        assert_eq!(roundtrip_formula("=(A1 + B1) * C1"), "(A1 + B1) * C1");

        // Verify that re-parsing produces the same result by evaluating both
        // (This confirms round-trip semantics are preserved)
        let test_cases = [
            "=1 + 2 * 3",   // Should be 7, not 9
            "=(1 + 2) * 3", // Should be 9
            "=2 ^ 3 + 1",   // Should be 9 (8 + 1)
            "=2 ^ (3 + 1)", // Should be 16 (2^4)
        ];
        for formula_str in test_cases {
            let formula1 = simple_parse_formula(formula_str).expect("Failed to parse formula");
            let a1_str = formula1.to_a1_string(None, &A1Context::default());
            let formula2 =
                simple_parse_formula(&format!("={}", a1_str)).expect("Failed to reparse formula");
            // The AST structures should be equal after round-trip
            assert_eq!(
                formula1.ast, formula2.ast,
                "AST mismatch for formula: {} -> {}",
                formula_str, a1_str
            );
        }
    }

    /// Verifies that operator precedence is correct when evaluating formulas
    /// after round-tripping through to_a1_string. This proves that precedence
    /// is correctly preserved and the concern about missing parenthesization
    /// in serialization is NOT valid.
    #[test]
    fn test_operator_precedence_evaluation_after_roundtrip() {
        use crate::Pos;
        use crate::controller::GridController;
        use crate::formulas::parse_formula;
        use rust_decimal::prelude::ToPrimitive;

        let gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let pos = Pos::ORIGIN.to_sheet_pos(sheet_id);

        // Helper to evaluate a formula and return the numeric result
        let evaluate = |formula: &str| -> f64 {
            use crate::formulas::Ctx;
            let mut ctx = Ctx::new(&gc, pos);
            let parsed = parse_formula(formula, gc.a1_context(), pos).unwrap();
            let result = parsed.eval(&mut ctx).inner;
            match result {
                crate::Value::Single(crate::CellValue::Number(n)) => n.to_f64().expect("number"),
                _ => panic!("Expected number, got {:?}", result),
            }
        };

        // Test cases: (formula, expected_value)
        let test_cases: &[(&str, f64)] = &[
            ("=1 + 2 * 3", 7.0),      // Multiplication before addition
            ("=(1 + 2) * 3", 9.0),    // Parens force addition first
            ("=2 ^ 3 + 1", 9.0),      // Power before addition (8 + 1)
            ("=2 ^ (3 + 1)", 16.0),   // Parens force addition first (2^4)
            ("=10 / 2 + 3", 8.0),     // Division before addition
            ("=10 / (2 + 3)", 2.0),   // Parens force addition first
            ("=2 * 3 + 4 * 5", 26.0), // (2*3) + (4*5) = 6 + 20
        ];

        for (formula, expected) in test_cases {
            // First, evaluate the original formula
            let original_result = evaluate(formula);
            assert_eq!(
                original_result, *expected,
                "Original formula {} evaluated incorrectly",
                formula
            );

            // Now round-trip through to_a1_string and re-evaluate
            let parsed = parse_formula(formula, gc.a1_context(), pos).unwrap();
            let a1_str = parsed.to_a1_string(Some(sheet_id), gc.a1_context());
            let roundtrip_formula = format!("={}", a1_str);

            let roundtrip_result = evaluate(&roundtrip_formula);
            assert_eq!(
                roundtrip_result, *expected,
                "Round-tripped formula {} (from {}) evaluated incorrectly",
                roundtrip_formula, formula
            );
        }
    }
}

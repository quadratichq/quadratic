use itertools::Itertools;
use serde::{Deserialize, Serialize};
use smallvec::smallvec;

use super::*;
use crate::{
    Array, ArraySize, CellValue, CodeResult, CodeResultExt, CoerceInto, RunErrorMsg, SheetRect,
    Span, Spanned, Value,
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
    CellRef(CellRef),
    String(String),
    Number(f64),
    Bool(bool),
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
            AstNodeContents::CellRef(_) => "cell reference",
            AstNodeContents::String(_) => "string literal",
            AstNodeContents::Number(_) => "numeric literal",
            AstNodeContents::Bool(_) => "boolean literal",
        }
    }
}

impl Formula {
    /// Evaluates a formula.
    pub fn eval(&self, ctx: &mut Ctx<'_>) -> Spanned<Value> {
        self.ast.eval(ctx).unwrap_or_else(|e| Spanned {
            span: self.ast.span,
            inner: e.into(),
        })
    }
}

impl AstNode {
    fn eval<'expr, 'ctx: 'expr>(&'expr self, ctx: &'expr mut Ctx<'ctx>) -> CodeResult {
        let value: Value = match &self.inner {
            AstNodeContents::Empty => Value::Single(CellValue::Blank),

            AstNodeContents::FunctionCall { func, .. } if func.inner == ":" => {
                let range = self.to_range_ref(ctx)?;
                let rect = ctx.resolve_range_ref(&range.inner, self.span)?;
                Value::Array(ctx.get_cell_array(rect.inner, self.span)?.inner)
            }

            // Other operator/function
            AstNodeContents::FunctionCall { func, args } => {
                let func_name = &func.inner;
                match functions::lookup_function(func_name) {
                    Some(f) => {
                        let arg_values: Vec<Spanned<Value>> =
                            args.iter().map(|arg| arg.eval(&mut *ctx)).try_collect()?;
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
                let mut expressions: Vec<Array> = contents
                    .iter()
                    .map(|expr| CodeResult::Ok(expr.eval(ctx)?.inner.into_arrays()))
                    .flatten_ok()
                    .try_collect()?;
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
                        flat_array.push(elem_expr.eval(ctx)?.into_cell_value()?.inner);
                    }
                }

                let size = ArraySize::new_or_err(width as u32, height as u32)?;
                Array::new_row_major(size, flat_array)?.into()
            }

            // Single cell references return 1x1 arrays for Excel compatibility.
            AstNodeContents::CellRef(cell_ref) => {
                let pos = ctx.resolve_ref(cell_ref, self.span)?.inner;
                Array::from(ctx.get_cell(pos, self.span).inner).into()
            }

            AstNodeContents::String(s) => Value::from(s.to_string()),
            AstNodeContents::Number(n) => Value::from(*n),
            AstNodeContents::Bool(b) => Value::from(*b),
        };

        Ok(Spanned {
            span: self.span,
            inner: value,
        })
    }

    /// Evaluates the expression to a tuple of range references, or returns an
    /// error if this cannot be done
    fn to_range_ref_tuple<'expr, 'ctx: 'expr>(
        &'expr self,
        ctx: &'expr mut Ctx<'ctx>,
    ) -> CodeResult<Vec<Spanned<RangeRef>>> {
        match &self.inner {
            AstNodeContents::Paren(contents) => contents
                .iter()
                .map(|expr| expr.to_range_ref_tuple(ctx))
                .flatten_ok()
                .try_collect(),
            _ => Ok(vec![self.to_range_ref(ctx)?]),
        }
    }

    /// Evaluates the expression to a cell range reference, or returns an error
    /// if this cannot be done.
    fn to_range_ref<'expr, 'ctx: 'expr>(
        &'expr self,
        ctx: &'expr mut Ctx<'ctx>,
    ) -> CodeResult<Spanned<RangeRef>> {
        match &self.inner {
            AstNodeContents::FunctionCall { func, args } if func.inner == ":" => {
                eval_cell_range_op(ctx, args, self.span)
            }
            AstNodeContents::Paren(contents) if contents.len() == 1 => {
                contents[0].to_range_ref(ctx)
            }
            AstNodeContents::CellRef(cell_ref) => Ok(RangeRef::Cell {
                pos: cell_ref.clone(),
            })
            .with_span(self.span),
            _ => Err(RunErrorMsg::Expected {
                expected: "cell range reference".into(),
                got: Some(self.inner.type_string().into()),
            }
            .with_span(self.span)),
        }
    }

    /// Evaluates the expression to a cell reference, or returns an error if this cannot be done.
    fn to_cell_ref<'expr, 'ctx: 'expr>(
        &'expr self,
        ctx: &'expr mut Ctx<'ctx>,
    ) -> CodeResult<CellRef> {
        match &self.inner {
            AstNodeContents::CellRef(cellref) => Ok(cellref.clone()),
            AstNodeContents::Paren(contents) if contents.len() == 1 => contents[0].to_cell_ref(ctx),
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
                    .map(|range_ref| ctx.resolve_range_ref(&range_ref.inner, self.span))
                    .try_collect()?;

                // Get other arguments
                let arg_values: Vec<Spanned<Value>> = args
                    .iter()
                    .skip(1)
                    .map(|arg| arg.eval(&mut *ctx))
                    .try_collect()?;
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
                    return Ok(CellRef {
                        sheet: None,
                        x: CellRefCoord::Relative(0),
                        y: CellRefCoord::Relative(0),
                    });
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
                    .grid
                    .try_sheet(indexed_pos.sheet_id)
                    .ok_or(RunErrorMsg::IndexOutOfBounds.with_span(self.span))?;

                Ok(CellRef {
                    sheet: Some(sheet.name.clone()),
                    x: CellRefCoord::Absolute(indexed_pos.x),
                    y: CellRefCoord::Absolute(indexed_pos.y),
                })
            }
            _ => Err(RunErrorMsg::Expected {
                expected: "cell reference".into(),
                got: Some(self.inner.type_string().into()),
            }
            .with_span(self.span)),
        }
    }
}

fn eval_cell_range_op(
    ctx: &mut Ctx<'_>,
    args: &[AstNode],
    span: Span,
) -> CodeResult<Spanned<RangeRef>> {
    if args.len() != 2 {
        internal_error!("invalid arguments to cell range operator");
    }

    let ref1 = args[0].to_cell_ref(ctx)?;
    let ref2 = args[1].to_cell_ref(ctx)?;
    Ok(RangeRef::CellRange {
        start: ref1,
        end: ref2,
    })
    .with_span(span)
}

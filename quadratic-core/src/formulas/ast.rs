use std::borrow::Cow;

use itertools::Itertools;
use serde::{Deserialize, Serialize};
use smallvec::smallvec;

use super::*;
use crate::{
    Array, ArraySize, CellValue, CodeResult, CoerceInto, Pos, RunErrorMsg, SheetRect, Spanned,
    Value,
    a1::{CellRefCoord, CellRefRange, CellRefRangeEnd, RefRangeBounds, SheetCellRefRange},
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
}

impl Formula {
    /// Evaluates a formula.
    pub(crate) fn eval(&self, ctx: &mut Ctx<'_>) -> Spanned<Value> {
        self.ast.eval(ctx)
    }
}

impl AstNode {
    /// Evaluates an AST node. Errors are converted to [`CellValue::Error`].
    fn eval<'expr, 'ctx: 'expr>(&'expr self, ctx: &'expr mut Ctx<'ctx>) -> Spanned<Value> {
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

            // Single cell references return 1x1 arrays for Excel compatibility.
            AstNodeContents::CellRef(_, _) | AstNodeContents::RangeRef(_) => {
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

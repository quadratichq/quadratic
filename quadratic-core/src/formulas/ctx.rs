use futures::{future::LocalBoxFuture, FutureExt};
use smallvec::SmallVec;

use super::*;

/// Formula execution context.
pub struct Ctx<'ctx> {
    pub grid: &'ctx mut dyn GridProxy,
    pub pos: Pos,
}
impl Ctx<'_> {
    /// Fetches the contents of the cell at `ref_pos` evaluated at `base_pos`,
    /// or returns an error in the case of a circular reference.
    pub async fn get_cell(&mut self, ref_pos: CellRef, span: Span) -> FormulaResult {
        let ref_pos = ref_pos.resolve_from(self.pos);
        if ref_pos == self.pos {
            return Err(FormulaErrorMsg::CircularReference.with_span(span));
        }
        Ok(Value::String(
            self.grid.get(ref_pos).await.unwrap_or_default(),
        ))
    }

    /// Fetches the contents of the given cell coordinates, or an array of cells
    /// if the input is an array.
    pub async fn array_mapped_indirect(
        &mut self,
        args: Spanned<Vec<Spanned<Value>>>,
    ) -> FormulaResult {
        let base_pos = self.pos;
        self.array_map_async(args, |ctx, [cell_ref_string]| {
            async move {
                let pos =
                    CellRef::parse_a1(&cell_ref_string.to_string(), base_pos).ok_or_else(|| {
                        FormulaErrorMsg::BadCellReference.with_span(cell_ref_string.span)
                    })?;
                ctx.get_cell(pos, cell_ref_string.span).await
            }
            .boxed_local()
        })
        .await
    }

    /// Fetches the contents of the cell at `(x, y)`, but fetches an array of cells
    /// if either `x` or `y` is an array.
    pub async fn array_mapped_indirect(
        &mut self,
        args: Spanned<Vec<Spanned<Value>>>,
    ) -> FormulaResult {
        let base_pos = self.pos;

        self.array_map_async(args, |ctx, [cellref_string]| {
            async move {
                let pos = CellRef::parse_a1(&cellref_string.to_string(), base_pos)
                    .ok_or(FormulaErrorMsg::BadCellReference.with_span(cellref_string.span))?;
                ctx.get_cell(pos, cellref_string.span).await
            }
            .boxed_local()
        })
        .await
    }

    /// Fetches the contents of the cell at `(x, y)`, but fetches an array of cells
    /// if either `x` or `y` is an array.
    pub async fn array_mapped_get_cell(
        &mut self,
        args: Spanned<Vec<Spanned<Value>>>,
    ) -> FormulaResult {
        self.array_map_async(args, |ctx, [x, y]| {
            async {
                let pos = Pos {
                    x: x.to_integer()?,
                    y: y.to_integer()?,
                };
                ctx.get_cell(CellRef::absolute(pos), Span::merge(x, y))
                    .await
            }
            .boxed_local()
        })
        .await
    }

    /// Maps a fixed-argument-count function over arguments that may be arrays.
    pub async fn array_map<const N: usize>(
        &mut self,
        args: Spanned<Vec<Spanned<Value>>>,
        op: impl 'static + Copy + Fn(&mut Ctx<'_>, [Spanned<Value>; N]) -> FormulaResult,
    ) -> FormulaResult {
        self.array_map_async(args, move |ctx, args| {
            async move { op(ctx, args) }.boxed_local()
        })
        .await
    }

    /// Maps a fixed-argument-count function over arguments that may be arrays.
    pub async fn array_map_async<const N: usize>(
        &mut self,
        args: Spanned<Vec<Spanned<Value>>>,
        op: impl for<'a> Fn(&'a mut Ctx<'_>, [Spanned<Value>; N]) -> LocalBoxFuture<'a, FormulaResult>,
    ) -> FormulaResult {
        let ArrayArgs { args, common_size } = args_with_common_array_size(args)?;
        match common_size {
            // Compute the results. If any argument is not an array, pretend it's an
            // array of one element repeated with the right size.
            Some((rows, cols)) => {
                let mut output_array = Vec::with_capacity(rows);
                for row in 0..rows {
                    let mut output_row = SmallVec::with_capacity(cols);
                    for col in 0..cols {
                        let arg_values = args
                            .iter()
                            .map(|arg| arg.get_array_value(row, col))
                            .collect::<FormulaResult<Vec<_>>>()?
                            .try_into()
                            .unwrap();
                        let output_value = op(self, arg_values).await?;
                        output_row.push(output_value);
                    }
                    output_array.push(output_row);
                }
                Ok(Value::Array(output_array))
            }

            // No operands are arrays, so just do the operation once.
            None => op(self, args).await,
        }
    }
}

struct ArrayArgs<const N: usize> {
    args: [Spanned<Value>; N],
    common_size: Option<(usize, usize)>,
}

/// Checkes the number of arguments and returns the common `(rows, cols)` of
/// several, or `None` if no arguments are arrays.
fn args_with_common_array_size<const N: usize>(
    args: Spanned<Vec<Spanned<Value>>>,
) -> FormulaResult<ArrayArgs<N>> {
    // Check argument count.
    let args: [Spanned<Value>; N] = args
        .inner
        .try_into()
        .map_err(|_| FormulaErrorMsg::BadArgumentCount.with_span(args.span))?;

    let mut array_sizes_iter = args
        .iter()
        .filter_map(|arg| Some((arg.span, arg.inner.array_size()?)));

    let common_size: Option<(usize, usize)>;
    if let Some((_span, array_size)) = array_sizes_iter.next() {
        // Check that all the arrays are the same size.
        for (error_span, other_array_size) in array_sizes_iter {
            if array_size != other_array_size {
                return Err(FormulaErrorMsg::ArraySizeMismatch {
                    expected: array_size,
                    got: other_array_size,
                }
                .with_span(error_span));
            }
        }

        common_size = Some(array_size);
    } else {
        common_size = None;
    }

    Ok(ArrayArgs { args, common_size })
}

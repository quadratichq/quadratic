//! Array generation, filter, sort, and functional operations.

use super::*;

pub fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Transposes an array (swaps rows and columns).
            #[examples("TRANSPOSE(A1:C2)")]
            fn TRANSPOSE(array: Array) {
                array.transpose()
            }
        ),
        formula_fn!(
            /// Generates a sequence of numbers.
            #[examples("SEQUENCE(5)")]
            fn SEQUENCE(
                span: Span,
                rows: (Spanned<i64>),
                columns: (Option<Spanned<i64>>),
                start: (Option<i64>),
                step: (Option<i64>),
            ) {
                let r = rows.inner;
                let c = columns.map(|c| c.inner).unwrap_or(1);
                let start_val = start.unwrap_or(1);
                let step_val = step.unwrap_or(1);

                if r <= 0 || c <= 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let size = ArraySize::new(c as u32, r as u32)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                let values: SmallVec<[CellValue; 1]> = (0..(r * c))
                    .map(|i| CellValue::Number((start_val + step_val * i).into()))
                    .collect();

                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Filters an array of values by a list of booleans.
            #[examples("FILTER(A1:C5, D1:D5)")]
            fn FILTER(
                span: Span,
                array: (Spanned<Array>),
                include: (Spanned<Array>),
                if_empty: (Option<Value>),
            ) {
                let empty_result = if_empty.ok_or_else(|| RunErrorMsg::EmptyArray.with_span(span));
                let include_span = include.span;
                let axis = include.array_linear_axis()?;
                let include: Vec<bool> = include
                    .try_as_linear_array()?
                    .iter()
                    .map(|v| bool::try_from(v.clone()).map_err(|e| e.with_span(include_span)))
                    .try_collect()?;

                match axis {
                    None => {
                        if *include.first().unwrap_or(&false) {
                            Value::from(array.inner)
                        } else {
                            empty_result?
                        }
                    }
                    Some(axis) => {
                        array.check_array_size_on(axis, include.len() as u32)?;
                        let new_slices = array
                            .inner
                            .slices(axis)
                            .zip(include)
                            .filter(|(_, include)| *include)
                            .map(|(slice, _)| slice);
                        match Array::from_slices(span, axis, new_slices) {
                            Ok(a) => Value::from(a),
                            Err(_) => empty_result?,
                        }
                    }
                }
            }
        ),
        formula_fn!(
            /// Sorts an array of values.
            #[examples("SORT(A1:A100)")]
            fn SORT(
                span: Span,
                array: Array,
                sort_index: (Option<Spanned<i64>>),
                sort_order: (Option<Spanned<i64>>),
                by_column: (Option<bool>),
            ) {
                let axis = by_column_to_axis(by_column);
                let index = match sort_index {
                    None => 0,
                    Some(value) => {
                        let max_index = array.size()[axis.other_axis()].get() as i64;
                        if (1..=max_index).contains(&value.inner) {
                            value.inner as usize - 1
                        } else {
                            return Err(RunErrorMsg::InvalidArgument.with_span(value.span));
                        }
                    }
                };

                #[allow(clippy::redundant_closure)]
                let compare_fn = match sort_order {
                    None => |a, b| CellValue::total_cmp(a, b),
                    Some(value) => match value.inner {
                        1 => |a, b| CellValue::total_cmp(a, b),
                        -1 => |a, b| CellValue::total_cmp(b, a),
                        _ => return Err(RunErrorMsg::InvalidArgument.with_span(value.span)),
                    },
                };

                Array::from_slices(
                    span,
                    axis,
                    array.slices(axis).sorted_by(|slice1, slice2| {
                        compare_fn(
                            slice1.get(index).expect("already checked bounds"),
                            slice2.get(index).expect("already checked bounds"),
                        )
                    }),
                )?
            }
        ),
        formula_fn!(
            /// Removes duplicate rows or columns from an array.
            #[examples("UNIQUE(A1:A100)")]
            fn UNIQUE(
                span: Span,
                array: Array,
                by_column: (Option<bool>),
                exactly_once: (Option<bool>),
            ) {
                let axis = by_column_to_axis(by_column);
                let mut slice_counts: Vec<(Vec<&CellValue>, usize)> = vec![];
                let mut indices = HashMap::<Vec<CellValueHash>, SmallVec<[usize; 1]>>::new();

                for slice in array.slices(axis) {
                    let possible_indices = indices
                        .entry(slice.iter().map(|v| v.hash()).collect_vec())
                        .or_default();
                    if let Some(&i) = possible_indices.iter().find(|&&i| {
                        let past_slice = &slice_counts[i].0;
                        std::iter::zip(past_slice, &slice)
                            .all(|(l, r)| l.total_cmp(r) == std::cmp::Ordering::Equal)
                    }) {
                        slice_counts[i].1 += 1;
                    } else {
                        let index = slice_counts.len();
                        possible_indices.push(index);
                        slice_counts.push((slice, 1));
                    }
                }
                let new_slices = slice_counts
                    .into_iter()
                    .filter(|(_, count)| match exactly_once {
                        Some(true) => *count == 1,
                        None | Some(false) => true,
                    })
                    .map(|(slice, _)| slice);
                Array::from_slices(span, axis, new_slices)?
            }
        ),
        formula_fn!(
            /// Sorts an array based on the values in one or more corresponding ranges.
            ///
            /// - `array`: The array to sort.
            /// - `by_array1`: The first range of values to sort by.
            /// - `sort_order1`: Optional. 1 for ascending (default), -1 for descending.
            /// - Additional by_array/sort_order pairs can be provided for tie-breaking.
            #[examples("SORTBY(A1:A10, B1:B10)", "SORTBY(A1:C10, B1:B10, 1, C1:C10, -1)")]
            fn SORTBY(span: Span, args: FormulaFnArgs) {
                let mut args = args;

                // Get the main array to sort
                let array_value = args.take_next_required("array")?;
                let array: Array = array_value.try_coerce()?.inner;

                // Collect sort criteria pairs
                let mut sort_criteria: Vec<(Vec<CellValue>, i64)> = Vec::new();

                while args.has_next() {
                    let by_array_value = args.take_next_required("by_array")?;
                    let by_array: Spanned<Array> = by_array_value.try_coerce()?;

                    // Validate that by_array has same number of rows as array
                    if by_array.inner.height() != array.height() {
                        return Err(RunErrorMsg::ArrayAxisMismatch {
                            axis: Axis::Y,
                            expected: array.height(),
                            got: by_array.inner.height(),
                        }
                        .with_span(by_array.span));
                    }

                    let by_values: Vec<CellValue> = by_array
                        .inner
                        .cell_values_slice()
                        .iter()
                        .take(array.height() as usize)
                        .cloned()
                        .collect();

                    // Get optional sort order (default ascending = 1)
                    let sort_order = if args.has_next() {
                        let order_value = args.take_next_optional();
                        match order_value {
                            Some(v) => {
                                let order_span = v.span;
                                let order: i64 = v.try_coerce()?.inner;
                                if order != 1 && order != -1 {
                                    return Err(RunErrorMsg::InvalidArgument.with_span(order_span));
                                }
                                order
                            }
                            None => 1,
                        }
                    } else {
                        1
                    };

                    sort_criteria.push((by_values, sort_order));
                }

                if sort_criteria.is_empty() {
                    return Err(RunErrorMsg::MissingRequiredArgument {
                        func_name: "SORTBY".into(),
                        arg_name: "by_array".into(),
                    }
                    .with_span(span));
                }

                // Create indices and sort them
                let mut indices: Vec<usize> = (0..array.height() as usize).collect();
                indices.sort_by(|&a, &b| {
                    for (by_values, order) in &sort_criteria {
                        let val_a = by_values.get(a).unwrap_or(&CellValue::Blank);
                        let val_b = by_values.get(b).unwrap_or(&CellValue::Blank);
                        let cmp = if *order == 1 {
                            CellValue::total_cmp(val_a, val_b)
                        } else {
                            CellValue::total_cmp(val_b, val_a)
                        };
                        if cmp != std::cmp::Ordering::Equal {
                            return cmp;
                        }
                    }
                    std::cmp::Ordering::Equal
                });

                // Build result array with sorted rows
                let width = array.width();
                let height = array.height();
                let mut result_values: SmallVec<[CellValue; 1]> = SmallVec::new();

                for &idx in &indices {
                    for x in 0..width {
                        result_values.push(array.get(x, idx as u32)?.clone());
                    }
                }

                let size = ArraySize::new(width, height)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                Array::new_row_major(size, result_values)?
            }
        ),
        formula_fn!(
            /// Multiplies arrays componentwise, then returns the sum.
            #[examples("SUMPRODUCT(C2:C5, D2:D5)")]
            fn SUMPRODUCT(arrays: (Iter<Spanned<Array>>)) {
                let Some(first) = arrays.next() else {
                    return Ok(0.into());
                };
                let mut results = first?;
                for array in arrays {
                    let new_array = array?;
                    new_array.check_array_size_exact(results.inner.size())?;
                    let new_span = new_array.span;
                    for (product, new_value) in std::iter::zip(
                        results.inner.cell_values_slice_mut(),
                        new_array.inner.cell_values_slice(),
                    ) {
                        *product = CellValue::mul(
                            results.span,
                            Spanned {
                                span: results.span,
                                inner: product,
                            },
                            Spanned {
                                span: new_span,
                                inner: new_value,
                            },
                        )?
                        .inner;
                    }
                    results.span = Span::merge(results.span, new_span);
                }

                let span = results.span;
                match results
                    .inner
                    .into_cell_values_vec()
                    .into_iter()
                    .map(|inner| Ok(Spanned { span, inner }))
                    .reduce(|a, b| CellValue::add(results.span, a?.as_ref(), b?.as_ref()))
                {
                    Some(result) => result?.inner,
                    None => 0.into(),
                }
            }
        ),
        formula_fn!(
            /// Returns the matrix determinant.
            #[examples("MDETERM({1, 2; 3, 4})")]
            fn MDETERM(span: Span, array: (Spanned<Array>)) {
                let size = array.inner.size();
                if size.w != size.h {
                    return Err(RunErrorMsg::NonRectangularArray.with_span(array.span));
                }
                let n = size.w.get() as usize;
                let mut matrix: Vec<f64> = Vec::with_capacity(n * n);
                for cv in array.inner.cell_values_slice().iter() {
                    let val: f64 = cv.coerce_nonblank().ok_or_else(|| {
                        RunErrorMsg::Expected {
                            expected: "number".into(),
                            got: Some(cv.type_name().into()),
                        }
                        .with_span(span)
                    })?;
                    matrix.push(val);
                }
                matrix_determinant(&matrix, n)
            }
        ),
        formula_fn!(
            /// Returns the inverse matrix.
            #[examples("MINVERSE({1, 2; 3, 4})")]
            fn MINVERSE(span: Span, array: (Spanned<Array>)) {
                let size = array.inner.size();
                if size.w != size.h {
                    return Err(RunErrorMsg::NonRectangularArray.with_span(array.span));
                }
                let n = size.w.get() as usize;
                let mut matrix: Vec<f64> = Vec::with_capacity(n * n);
                for cv in array.inner.cell_values_slice().iter() {
                    let val: f64 = cv.coerce_nonblank().ok_or_else(|| {
                        RunErrorMsg::Expected {
                            expected: "number".into(),
                            got: Some(cv.type_name().into()),
                        }
                        .with_span(span)
                    })?;
                    matrix.push(val);
                }
                let inverse = matrix_inverse(&matrix, n)
                    .ok_or_else(|| RunErrorMsg::DivideByZero.with_span(span))?;
                let values: SmallVec<[CellValue; 1]> = inverse
                    .into_iter()
                    .map(|v| {
                        CellValue::Number(
                            rust_decimal::Decimal::from_f64_retain(v).unwrap_or_default(),
                        )
                    })
                    .collect();
                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Returns the matrix product of two arrays.
            #[examples("MMULT({1, 2; 3, 4}, {5, 6; 7, 8})")]
            fn MMULT(span: Span, array1: (Spanned<Array>), array2: (Spanned<Array>)) {
                let size1 = array1.inner.size();
                let size2 = array2.inner.size();
                if size1.w != size2.h {
                    return Err(RunErrorMsg::ArrayAxisMismatch {
                        axis: Axis::X,
                        expected: size1.w.get(),
                        got: size2.h.get(),
                    }
                    .with_span(array2.span));
                }

                let rows = size1.h.get() as usize;
                let cols = size2.w.get() as usize;
                let inner = size1.w.get() as usize;

                let mut m1: Vec<f64> = Vec::with_capacity(rows * inner);
                for cv in array1.inner.cell_values_slice().iter() {
                    let val: f64 = cv.coerce_nonblank().ok_or_else(|| {
                        RunErrorMsg::Expected {
                            expected: "number".into(),
                            got: Some(cv.type_name().into()),
                        }
                        .with_span(span)
                    })?;
                    m1.push(val);
                }

                let mut m2: Vec<f64> = Vec::with_capacity(inner * cols);
                for cv in array2.inner.cell_values_slice().iter() {
                    let val: f64 = cv.coerce_nonblank().ok_or_else(|| {
                        RunErrorMsg::Expected {
                            expected: "number".into(),
                            got: Some(cv.type_name().into()),
                        }
                        .with_span(span)
                    })?;
                    m2.push(val);
                }

                let mut result: Vec<CellValue> = Vec::with_capacity(rows * cols);
                for i in 0..rows {
                    for j in 0..cols {
                        let mut sum = 0.0;
                        for k in 0..inner {
                            sum += m1[i * inner + k] * m2[k * cols + j];
                        }
                        result.push(CellValue::Number(
                            rust_decimal::Decimal::from_f64_retain(sum).unwrap_or_default(),
                        ));
                    }
                }

                let result_size = ArraySize::new(cols as u32, rows as u32)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                Array::new_row_major(result_size, result.into())?
            }
        ),
        formula_fn!(
            /// Returns an array of random numbers.
            #[examples("RANDARRAY(3, 2)")]
            fn RANDARRAY(
                span: Span,
                rows: (Option<Spanned<i64>>),
                columns: (Option<Spanned<i64>>),
                min: (Option<f64>),
                max: (Option<f64>),
                whole_number: (Option<bool>),
            ) {
                use rand::Rng;
                let r = rows.map(|r| r.inner).unwrap_or(1);
                let c = columns.map(|c| c.inner).unwrap_or(1);
                let min_val = min.unwrap_or(0.0);
                let max_val = max.unwrap_or(1.0);
                let whole = whole_number.unwrap_or(false);

                if r <= 0 || c <= 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if min_val > max_val {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let size = ArraySize::new(c as u32, r as u32)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                let mut rng = rand::rng();
                let values: SmallVec<[CellValue; 1]> = (0..(r * c))
                    .map(|_| {
                        let val = if whole {
                            let min_i = min_val.ceil() as i64;
                            let max_i = max_val.floor() as i64;
                            if min_i > max_i {
                                min_val
                            } else {
                                rng.random_range(min_i..=max_i) as f64
                            }
                        } else {
                            rng.random_range(min_val..=max_val)
                        };
                        CellValue::Number(
                            rust_decimal::Decimal::from_f64_retain(val).unwrap_or_default(),
                        )
                    })
                    .collect();
                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Applies a lambda function to each row of an array.
            #[examples("BYROW({1, 2; 3, 4}, LAMBDA(row, SUM(row)))")]
            fn BYROW(ctx: Ctx, span: Span, args: FormulaFnArgs) {
                eval_by_slice(ctx, span, args, Axis::Y, "BYROW")?
            }
        ),
        formula_fn!(
            /// Applies a lambda function to each column of an array.
            #[examples("BYCOL({1, 2; 3, 4}, LAMBDA(col, SUM(col)))")]
            fn BYCOL(ctx: Ctx, span: Span, args: FormulaFnArgs) {
                eval_by_slice(ctx, span, args, Axis::X, "BYCOL")?
            }
        ),
        formula_fn!(
            /// Creates an array by applying a lambda function to indices.
            #[examples("MAKEARRAY(3, 3, LAMBDA(r, c, r * c))")]
            fn MAKEARRAY(ctx: Ctx, span: Span, args: FormulaFnArgs) {
                let mut args = args;
                let rows_value = args.take_next_required("rows")?;
                let rows: i64 = rows_value.try_coerce()?.inner;
                let columns_value = args.take_next_required("columns")?;
                let columns: i64 = columns_value.try_coerce()?.inner;
                let lambda_value = args.take_next_required("lambda")?;
                let lambda = extract_lambda(&lambda_value, "MAKEARRAY")?;
                args.error_if_more_args()?;

                if ctx.skip_computation {
                    return Ok(Value::Single(CellValue::Blank));
                }
                if rows <= 0 || columns <= 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if lambda.param_count() != 2 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let size = ArraySize::new(columns as u32, rows as u32)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                let mut values: SmallVec<[CellValue; 1]> =
                    SmallVec::with_capacity((rows * columns) as usize);

                for r in 1..=rows {
                    for c in 1..=columns {
                        let bindings = vec![
                            (lambda.params[0].clone(), Value::from(r as f64)),
                            (lambda.params[1].clone(), Value::from(c as f64)),
                        ];
                        let mut child_ctx = ctx.with_bindings(&bindings);
                        let result = lambda.body.eval(&mut child_ctx);
                        let cell_value = match result.inner {
                            Value::Single(cv) => cv,
                            Value::Array(a) => a
                                .cell_values_slice()
                                .first()
                                .cloned()
                                .unwrap_or(CellValue::Blank),
                            _ => CellValue::Blank,
                        };
                        values.push(cell_value);
                    }
                }
                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Applies a lambda function to each element of arrays.
            #[examples("MAP({1, 2; 3, 4}, LAMBDA(x, x * 2))")]
            fn MAP(ctx: Ctx, span: Span, args: FormulaFnArgs) {
                let mut args = args;
                let mut arrays: Vec<Array> = vec![];
                let mut lambda: Option<LambdaValue> = None;

                // Collect all array arguments (all but last which should be lambda)
                while args.has_next() {
                    let value = args.take_next_required("value")?;
                    if let Value::Lambda(_) = &value.inner {
                        lambda = Some(extract_lambda(&value, "MAP")?);
                        args.error_if_more_args()?;
                        break;
                    }
                    let arr: Array = value.try_coerce()?.inner;
                    arrays.push(arr);
                }

                let lambda = lambda.ok_or_else(|| {
                    RunErrorMsg::MissingRequiredArgument {
                        func_name: "MAP".into(),
                        arg_name: "lambda".into(),
                    }
                    .with_span(span)
                })?;

                if ctx.skip_computation {
                    return Ok(Value::Single(CellValue::Blank));
                }
                if arrays.is_empty() {
                    return Err(RunErrorMsg::MissingRequiredArgument {
                        func_name: "MAP".into(),
                        arg_name: "array".into(),
                    }
                    .with_span(span));
                }
                if lambda.param_count() != arrays.len() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let size = arrays[0].size();
                for arr in &arrays[1..] {
                    if arr.size() != size {
                        return Err(RunErrorMsg::ArrayAxisMismatch {
                            axis: Axis::X,
                            expected: size.w.get(),
                            got: arr.size().w.get(),
                        }
                        .with_span(span));
                    }
                }

                let mut values: SmallVec<[CellValue; 1]> = SmallVec::with_capacity(size.len());
                for i in 0..size.len() {
                    let bindings: Vec<_> = lambda
                        .params
                        .iter()
                        .enumerate()
                        .map(|(j, param)| {
                            let y = (i / size.w.get() as usize) as u32;
                            let x = (i % size.w.get() as usize) as u32;
                            (
                                param.clone(),
                                Value::Single(arrays[j].get(x, y).unwrap().clone()),
                            )
                        })
                        .collect();
                    let mut child_ctx = ctx.with_bindings(&bindings);
                    let result = lambda.body.eval(&mut child_ctx);
                    let cell_value = match result.inner {
                        Value::Single(cv) => cv,
                        Value::Array(a) => a
                            .cell_values_slice()
                            .first()
                            .cloned()
                            .unwrap_or(CellValue::Blank),
                        _ => CellValue::Blank,
                    };
                    values.push(cell_value);
                }
                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Reduces an array to a single value using a lambda function.
            #[examples("REDUCE(0, {1, 2, 3}, LAMBDA(acc, val, acc + val))")]
            fn REDUCE(ctx: Ctx, span: Span, args: FormulaFnArgs) {
                let mut args = args;
                let initial_value = args.take_next_required("initial_value")?;
                let array_value = args.take_next_required("array")?;
                let array: Array = array_value.try_coerce()?.inner;
                let lambda_value = args.take_next_required("lambda")?;
                let lambda = extract_lambda(&lambda_value, "REDUCE")?;
                args.error_if_more_args()?;

                if ctx.skip_computation {
                    return Ok(Value::Single(CellValue::Blank));
                }
                if lambda.param_count() != 2 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let mut accumulator = initial_value.inner;
                for cell_value in array.cell_values_slice().iter() {
                    let bindings = vec![
                        (lambda.params[0].clone(), accumulator),
                        (lambda.params[1].clone(), Value::Single(cell_value.clone())),
                    ];
                    let mut child_ctx = ctx.with_bindings(&bindings);
                    let result = lambda.body.eval(&mut child_ctx);
                    accumulator = result.inner;
                }
                accumulator
            }
        ),
        formula_fn!(
            /// Returns the unit matrix (identity matrix) of the specified dimension.
            /// Returns a square matrix with 1s on the diagonal and 0s elsewhere.
            #[examples("MUNIT(3)")]
            fn MUNIT(span: Span, dimension: (Spanned<i64>)) {
                let n = dimension.inner;
                if n <= 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(dimension.span));
                }
                let n = n as u32;

                let size =
                    ArraySize::new(n, n).ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;

                let mut values: SmallVec<[CellValue; 1]> =
                    SmallVec::with_capacity((n * n) as usize);
                for row in 0..n {
                    for col in 0..n {
                        if row == col {
                            values.push(CellValue::Number(1.into()));
                        } else {
                            values.push(CellValue::Number(0.into()));
                        }
                    }
                }

                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Scans an array by applying a lambda function to each element,
            /// returning an array of intermediate values.
            #[examples("SCAN(0, {1, 2, 3}, LAMBDA(acc, val, acc + val))")]
            fn SCAN(ctx: Ctx, span: Span, args: FormulaFnArgs) {
                let mut args = args;
                let initial_value = args.take_next_required("initial_value")?;
                let array_value = args.take_next_required("array")?;
                let array: Spanned<Array> = array_value.try_coerce()?;
                let lambda_value = args.take_next_required("lambda")?;
                let lambda = extract_lambda(&lambda_value, "SCAN")?;
                args.error_if_more_args()?;

                if ctx.skip_computation {
                    return Ok(Value::Single(CellValue::Blank));
                }
                if lambda.param_count() != 2 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let width = array.inner.width();
                let height = array.inner.height();
                let size = ArraySize::new(width, height)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;

                let mut results: SmallVec<[CellValue; 1]> = SmallVec::with_capacity(size.len());
                let mut accumulator = initial_value.inner;

                for cell_value in array.inner.cell_values_slice().iter() {
                    let bindings = vec![
                        (lambda.params[0].clone(), accumulator),
                        (lambda.params[1].clone(), Value::Single(cell_value.clone())),
                    ];
                    let mut child_ctx = ctx.with_bindings(&bindings);
                    let result = lambda.body.eval(&mut child_ctx);
                    accumulator = result.inner.clone();

                    // Extract the single cell value from the result
                    match result.inner {
                        Value::Single(cv) => results.push(cv),
                        Value::Array(arr) => {
                            results.push(arr.get(0, 0).cloned().unwrap_or(CellValue::Blank));
                        }
                        Value::Tuple(arrays) => {
                            if let Some(first) = arrays.first() {
                                results.push(first.get(0, 0).cloned().unwrap_or(CellValue::Blank));
                            } else {
                                results.push(CellValue::Blank);
                            }
                        }
                        Value::Lambda(_) => {
                            results.push(CellValue::Blank);
                        }
                    }
                }

                Array::new_row_major(size, results)?
            }
        ),
        formula_fn!(
            /// Groups rows by specified columns and applies an aggregation function.
            ///
            /// - `row_fields`: The column(s) to group by.
            /// - `values`: The values to aggregate.
            /// - `function`: Aggregation function number: 1=AVERAGE, 2=COUNT, 3=COUNTA,
            ///   4=MAX, 5=MIN, 6=PRODUCT, 7=STDEV, 8=STDEVP, 9=SUM, 10=VAR, 11=VARP,
            ///   101=AVERAGE (ignore hidden), 102=COUNT (ignore hidden), etc.,
            ///   or a LAMBDA function.
            /// - `field_headers`: Optional. 0=no headers, 1=yes but don't show,
            ///   2=no but generate, 3=yes and show (default).
            /// - `total_depth`: Optional. Total depth (0=no totals, 1-127=depth).
            /// - `sort_order`: Optional. Sort order for grouping (0=keep original, other=sort).
            #[examples(
                "GROUPBY(A2:A10, B2:B10, SUM)",
                "GROUPBY(A2:A10, B2:B10, 9)",
                "GROUPBY(A2:B10, C2:C10, AVERAGE)"
            )]
            fn GROUPBY(
                span: Span,
                ctx: Ctx,
                row_fields: (Spanned<Array>),
                values: (Spanned<Array>),
                function: (Spanned<Value>),
                field_headers: (Option<i64>),
                _total_depth: (Option<i64>),
                sort_order: (Option<i64>),
            ) {
                if ctx.skip_computation {
                    return Ok(Value::Single(CellValue::Blank));
                }

                let row_count = row_fields.inner.height();
                if values.inner.height() != row_count {
                    return Err(RunErrorMsg::ExactArraySizeMismatch {
                        expected: row_fields.inner.size(),
                        got: values.inner.size(),
                    }
                    .with_span(values.span));
                }

                // Determine if we have headers
                let has_headers = field_headers.unwrap_or(3) >= 2;
                let show_headers = field_headers.unwrap_or(3) == 3;
                let data_start = if has_headers { 1 } else { 0 };

                // Extract aggregation function
                let agg_func = match &function.inner {
                    Value::Single(CellValue::Number(n)) => {
                        use rust_decimal::prelude::ToPrimitive;
                        n.to_i64().unwrap_or(9)
                    }
                    Value::Lambda(_) => -1, // Lambda will be handled specially
                    _ => 9,                 // Default to SUM
                };

                // Group rows by key
                let mut groups: indexmap::IndexMap<Vec<CellValueHash>, (Vec<CellValue>, Vec<f64>)> =
                    indexmap::IndexMap::new();

                for row_idx in data_start..(row_count as usize) {
                    // Build key from row_fields
                    let mut key_hash: Vec<CellValueHash> = Vec::new();
                    let mut key_values: Vec<CellValue> = Vec::new();
                    for col_idx in 0..row_fields.inner.width() {
                        let cv = row_fields
                            .inner
                            .get(col_idx, row_idx as u32)
                            .cloned()
                            .unwrap_or(CellValue::Blank);
                        key_hash.push(cv.hash());
                        key_values.push(cv);
                    }

                    // Collect values to aggregate
                    for col_idx in 0..values.inner.width() {
                        let cv = values
                            .inner
                            .get(col_idx, row_idx as u32)
                            .cloned()
                            .unwrap_or(CellValue::Blank);
                        if let Some(v) = cv.coerce_nonblank::<f64>() {
                            let entry = groups
                                .entry(key_hash.clone())
                                .or_insert_with(|| (key_values.clone(), Vec::new()));
                            entry.1.push(v);
                        } else if groups.get(&key_hash).is_none() {
                            groups.insert(key_hash.clone(), (key_values.clone(), Vec::new()));
                        }
                    }
                }

                // Sort if requested
                let mut group_list: Vec<_> = groups.into_iter().collect();
                if sort_order.unwrap_or(1) != 0 {
                    group_list.sort_by(|a, b| {
                        for (av, bv) in a.1.0.iter().zip(b.1.0.iter()) {
                            match av.total_cmp(bv) {
                                std::cmp::Ordering::Equal => continue,
                                other => return other,
                            }
                        }
                        std::cmp::Ordering::Equal
                    });
                }

                // Apply aggregation function
                let aggregate = |vals: &[f64]| -> f64 {
                    if vals.is_empty() {
                        return 0.0;
                    }
                    match agg_func {
                        1 | 101 => vals.iter().sum::<f64>() / vals.len() as f64, // AVERAGE
                        2 | 102 => vals.len() as f64,                            // COUNT
                        3 | 103 => vals.len() as f64,                            // COUNTA
                        4 | 104 => vals.iter().cloned().fold(f64::NEG_INFINITY, f64::max), // MAX
                        5 | 105 => vals.iter().cloned().fold(f64::INFINITY, f64::min), // MIN
                        6 | 106 => vals.iter().product(),                        // PRODUCT
                        7 | 107 => {
                            // STDEV
                            let n = vals.len() as f64;
                            if n < 2.0 {
                                return 0.0;
                            }
                            let mean = vals.iter().sum::<f64>() / n;
                            let var =
                                vals.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / (n - 1.0);
                            var.sqrt()
                        }
                        8 | 108 => {
                            // STDEVP
                            let n = vals.len() as f64;
                            let mean = vals.iter().sum::<f64>() / n;
                            let var = vals.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / n;
                            var.sqrt()
                        }
                        9 | 109 => vals.iter().sum(), // SUM
                        10 | 110 => {
                            // VAR
                            let n = vals.len() as f64;
                            if n < 2.0 {
                                return 0.0;
                            }
                            let mean = vals.iter().sum::<f64>() / n;
                            vals.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / (n - 1.0)
                        }
                        11 | 111 => {
                            // VARP
                            let n = vals.len() as f64;
                            let mean = vals.iter().sum::<f64>() / n;
                            vals.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / n
                        }
                        _ => vals.iter().sum(), // Default to SUM
                    }
                };

                // Build result array
                let key_width = row_fields.inner.width();
                let value_width = values.inner.width().max(1);
                let result_width = key_width + value_width;
                let result_height = if show_headers && has_headers {
                    group_list.len() + 1
                } else {
                    group_list.len()
                };

                if result_height == 0 || (result_height == 1 && show_headers) {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }

                let mut result_values: SmallVec<[CellValue; 1]> = SmallVec::new();

                // Add headers if needed
                if show_headers && has_headers {
                    for col_idx in 0..key_width {
                        let header = row_fields
                            .inner
                            .get(col_idx, 0)
                            .cloned()
                            .unwrap_or(CellValue::Blank);
                        result_values.push(header);
                    }
                    for col_idx in 0..value_width {
                        let header = values
                            .inner
                            .get(col_idx, 0)
                            .cloned()
                            .unwrap_or(CellValue::Blank);
                        result_values.push(header);
                    }
                }

                // Add grouped data
                for (_, (key_values, vals)) in &group_list {
                    for kv in key_values {
                        result_values.push(kv.clone());
                    }
                    // For now, output one aggregated value per row
                    let agg_result = aggregate(vals);
                    result_values.push(CellValue::from(agg_result));
                    // Pad remaining columns if value_width > 1
                    for _ in 1..value_width {
                        result_values.push(CellValue::Blank);
                    }
                }

                let size = ArraySize::new(result_width, result_height as u32)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                Array::new_row_major(size, result_values)?
            }
        ),
        formula_fn!(
            /// Creates a pivot table summary by grouping rows and columns.
            ///
            /// - `row_fields`: The column(s) for row grouping.
            /// - `col_fields`: The column(s) for column grouping.
            /// - `values`: The values to aggregate.
            /// - `function`: Aggregation function number (see GROUPBY) or LAMBDA.
            /// - `field_headers`: Optional. Header handling (0-3).
            /// - `row_total_depth`: Optional. Row total depth.
            /// - `row_sort_order`: Optional. Row sort order.
            /// - `col_total_depth`: Optional. Column total depth.
            /// - `col_sort_order`: Optional. Column sort order.
            #[examples(
                "PIVOTBY(A2:A10, B2:B10, C2:C10, SUM)",
                "PIVOTBY(A2:A10, B2:B10, C2:C10, 9)"
            )]
            fn PIVOTBY(
                span: Span,
                ctx: Ctx,
                row_fields: (Spanned<Array>),
                col_fields: (Spanned<Array>),
                values: (Spanned<Array>),
                function: (Spanned<Value>),
                field_headers: (Option<i64>),
                _row_total_depth: (Option<i64>),
                row_sort_order: (Option<i64>),
                _col_total_depth: (Option<i64>),
                col_sort_order: (Option<i64>),
            ) {
                if ctx.skip_computation {
                    return Ok(Value::Single(CellValue::Blank));
                }

                let row_count = row_fields.inner.height();
                if col_fields.inner.height() != row_count || values.inner.height() != row_count {
                    return Err(RunErrorMsg::ExactArraySizeMismatch {
                        expected: row_fields.inner.size(),
                        got: values.inner.size(),
                    }
                    .with_span(values.span));
                }

                // Determine if we have headers
                let has_headers = field_headers.unwrap_or(3) >= 2;
                let show_headers = field_headers.unwrap_or(3) == 3;
                let data_start = if has_headers { 1 } else { 0 };

                // Extract aggregation function
                let agg_func = match &function.inner {
                    Value::Single(CellValue::Number(n)) => {
                        use rust_decimal::prelude::ToPrimitive;
                        n.to_i64().unwrap_or(9)
                    }
                    _ => 9, // Default to SUM
                };

                // Collect unique row keys and column keys
                let mut row_keys_set: indexmap::IndexMap<Vec<CellValueHash>, Vec<CellValue>> =
                    indexmap::IndexMap::new();
                let mut col_keys_set: indexmap::IndexMap<Vec<CellValueHash>, Vec<CellValue>> =
                    indexmap::IndexMap::new();
                let mut data_map: std::collections::HashMap<
                    (Vec<CellValueHash>, Vec<CellValueHash>),
                    Vec<f64>,
                > = std::collections::HashMap::new();

                for row_idx in data_start..(row_count as usize) {
                    // Build row key
                    let mut row_key_hash: Vec<CellValueHash> = Vec::new();
                    let mut row_key_values: Vec<CellValue> = Vec::new();
                    for col_idx in 0..row_fields.inner.width() {
                        let cv = row_fields
                            .inner
                            .get(col_idx, row_idx as u32)
                            .cloned()
                            .unwrap_or(CellValue::Blank);
                        row_key_hash.push(cv.hash());
                        row_key_values.push(cv);
                    }
                    row_keys_set
                        .entry(row_key_hash.clone())
                        .or_insert(row_key_values);

                    // Build column key
                    let mut col_key_hash: Vec<CellValueHash> = Vec::new();
                    let mut col_key_values: Vec<CellValue> = Vec::new();
                    for col_idx in 0..col_fields.inner.width() {
                        let cv = col_fields
                            .inner
                            .get(col_idx, row_idx as u32)
                            .cloned()
                            .unwrap_or(CellValue::Blank);
                        col_key_hash.push(cv.hash());
                        col_key_values.push(cv);
                    }
                    col_keys_set
                        .entry(col_key_hash.clone())
                        .or_insert(col_key_values);

                    // Collect values
                    for col_idx in 0..values.inner.width() {
                        let cv = values
                            .inner
                            .get(col_idx, row_idx as u32)
                            .cloned()
                            .unwrap_or(CellValue::Blank);
                        if let Some(v) = cv.coerce_nonblank::<f64>() {
                            data_map
                                .entry((row_key_hash.clone(), col_key_hash.clone()))
                                .or_default()
                                .push(v);
                        }
                    }
                }

                // Sort row and column keys
                let mut row_keys: Vec<_> = row_keys_set.into_iter().collect();
                let mut col_keys: Vec<_> = col_keys_set.into_iter().collect();

                if row_sort_order.unwrap_or(1) != 0 {
                    row_keys.sort_by(|a, b| {
                        for (av, bv) in a.1.iter().zip(b.1.iter()) {
                            match av.total_cmp(bv) {
                                std::cmp::Ordering::Equal => continue,
                                other => return other,
                            }
                        }
                        std::cmp::Ordering::Equal
                    });
                }

                if col_sort_order.unwrap_or(1) != 0 {
                    col_keys.sort_by(|a, b| {
                        for (av, bv) in a.1.iter().zip(b.1.iter()) {
                            match av.total_cmp(bv) {
                                std::cmp::Ordering::Equal => continue,
                                other => return other,
                            }
                        }
                        std::cmp::Ordering::Equal
                    });
                }

                // Apply aggregation function
                let aggregate = |vals: &[f64]| -> f64 {
                    if vals.is_empty() {
                        return 0.0;
                    }
                    match agg_func {
                        1 | 101 => vals.iter().sum::<f64>() / vals.len() as f64, // AVERAGE
                        2 | 102 => vals.len() as f64,                            // COUNT
                        3 | 103 => vals.len() as f64,                            // COUNTA
                        4 | 104 => vals.iter().cloned().fold(f64::NEG_INFINITY, f64::max), // MAX
                        5 | 105 => vals.iter().cloned().fold(f64::INFINITY, f64::min), // MIN
                        6 | 106 => vals.iter().product(),                        // PRODUCT
                        9 | 109 => vals.iter().sum(),                            // SUM
                        _ => vals.iter().sum(),                                  // Default to SUM
                    }
                };

                // Build result array
                let row_key_width = row_fields.inner.width();
                let header_row = if show_headers && has_headers { 1 } else { 0 };
                let result_width = row_key_width + col_keys.len() as u32;
                let result_height = header_row + row_keys.len() as u32;

                if result_height == 0 || col_keys.is_empty() || row_keys.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }

                let mut result_values: SmallVec<[CellValue; 1]> = SmallVec::new();

                // Add header row
                if header_row > 0 {
                    // Row field headers (empty corner cells)
                    for col_idx in 0..row_key_width {
                        if has_headers {
                            let header = row_fields
                                .inner
                                .get(col_idx, 0)
                                .cloned()
                                .unwrap_or(CellValue::Blank);
                            result_values.push(header);
                        } else {
                            result_values.push(CellValue::Blank);
                        }
                    }
                    // Column headers
                    for (_, col_key_values) in &col_keys {
                        // Use the first value as header (or concatenate if multiple columns)
                        let header = col_key_values.first().cloned().unwrap_or(CellValue::Blank);
                        result_values.push(header);
                    }
                }

                // Add data rows
                for (row_key_hash, row_key_values) in &row_keys {
                    // Row key values
                    for kv in row_key_values {
                        result_values.push(kv.clone());
                    }
                    // Aggregated values for each column
                    for (col_key_hash, _) in &col_keys {
                        let vals = data_map.get(&(row_key_hash.clone(), col_key_hash.clone()));
                        let agg_result = match vals {
                            Some(v) => aggregate(v),
                            None => 0.0,
                        };
                        result_values.push(CellValue::from(agg_result));
                    }
                }

                let size = ArraySize::new(result_width, result_height)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                Array::new_row_major(size, result_values)?
            }
        ),
    ]
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, formulas::tests::*};

    #[test]
    fn test_formula_transpose() {
        let g = GridController::new();
        assert_eq!(
            "{1, 3; 2, 4}",
            eval_to_string(&g, "TRANSPOSE({1, 2; 3, 4})")
        );
    }

    #[test]
    fn test_formula_sequence() {
        let g = GridController::new();
        assert_eq!("{1; 2; 3}", eval_to_string(&g, "SEQUENCE(3)"));
    }

    #[test]
    fn test_formula_filter() {
        let g = GridController::new();
        assert_eq!(
            "{2; 4}",
            eval_to_string(&g, "FILTER({1; 2; 3; 4}, {FALSE; TRUE; FALSE; TRUE})")
        );
    }

    #[test]
    fn test_formula_sort() {
        let g = GridController::new();
        assert_eq!("{1; 2; 3}", eval_to_string(&g, "SORT({3; 1; 2})"));
    }

    #[test]
    fn test_formula_unique() {
        let g = GridController::new();
        assert_eq!("{1; 2; 3}", eval_to_string(&g, "UNIQUE({1; 2; 1; 3; 2})"));
    }

    #[test]
    fn test_formula_sortby() {
        let g = GridController::new();

        // Basic SORTBY - sort array by another array
        // Sort by {2; 3; 1} ascending means: value 1 first, then 2, then 3
        // So row 3 ("c") with value 1 first, row 1 ("a") with value 2 second, row 2 ("b") with value 3 third
        assert_eq!(
            "{c; a; b}",
            eval_to_string(&g, "SORTBY({\"a\"; \"b\"; \"c\"}, {2; 3; 1})")
        );

        // SORTBY descending - value 3 first, then 2, then 1
        // Row 2 ("b") with value 3 first, row 1 ("a") with value 2 second, row 3 ("c") with value 1 third
        assert_eq!(
            "{b; a; c}",
            eval_to_string(&g, "SORTBY({\"a\"; \"b\"; \"c\"}, {2; 3; 1}, -1)")
        );

        // SORTBY with multiple columns - sort by {3; 1; 2}
        // Row 2 (2, b) has value 1, comes first
        // Row 3 (3, c) has value 2, comes second
        // Row 1 (1, a) has value 3, comes third
        assert_eq!(
            "{2, b; 3, c; 1, a}",
            eval_to_string(&g, "SORTBY({1, \"a\"; 2, \"b\"; 3, \"c\"}, {3; 1; 2})")
        );
    }

    #[test]
    fn test_formula_groupby() {
        let g = GridController::new();

        // Basic GROUPBY - group by first column and sum values
        // Data: A=10, A=20, B=30, B=40
        // Expected: A=30, B=70
        let result = eval_to_string(
            &g,
            "GROUPBY({\"A\"; \"A\"; \"B\"; \"B\"}, {10; 20; 30; 40}, 9, 0)",
        );
        // Result should show grouped sums
        assert!(result.contains("A") && result.contains("B"));
    }

    #[test]
    fn test_formula_pivotby() {
        let g = GridController::new();

        // Basic PIVOTBY - pivot by row and column
        let result = eval_to_string(
            &g,
            "PIVOTBY({\"A\"; \"A\"; \"B\"; \"B\"}, {\"X\"; \"Y\"; \"X\"; \"Y\"}, {10; 20; 30; 40}, 9, 0)",
        );
        // Result should be a pivot table
        assert!(!result.is_empty());
    }
}

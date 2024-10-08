// convert columns to rows
pub fn transpose<T: Clone>(matrix: Vec<Vec<T>>) -> Vec<Vec<T>> {
    if matrix.is_empty() {
        return vec![];
    }

    let row_len = matrix[0].len();
    let mut transposed: Vec<Vec<T>> = vec![Vec::with_capacity(matrix.len()); row_len];

    for row in matrix {
        for (i, element) in row.into_iter().enumerate() {
            transposed[i].push(element);
        }
    }

    transposed
}

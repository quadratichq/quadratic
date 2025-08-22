/// Asserts that two vectors are equal, ignoring order.
#[cfg(test)]
#[track_caller]
pub fn assert_vec_eq_unordered<T: PartialEq + std::fmt::Debug>(a: &[T], b: &[T]) {
    if a.len() != b.len() {
        panic!("Vectors have different lengths");
    }

    let mut b_used = vec![false; b.len()];

    for item in a {
        let mut found = false;
        for (i, other) in b.iter().enumerate() {
            if !b_used[i] && item == other {
                b_used[i] = true;
                found = true;
                break;
            }
        }
        if !found {
            panic!("Item {item:?} not found in second vector");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_assert_vec_eq_unordered() {
        assert_vec_eq_unordered(&[1, 2, 3], &[3, 1, 2]);
        assert_vec_eq_unordered(&[1, 1, 2], &[2, 1, 1]);
    }

    #[test]
    #[should_panic(expected = "Item 3 not found in second vector")]
    fn test_assert_vec_eq_unordered_failure() {
        assert_vec_eq_unordered(&[1, 2, 3], &[1, 2, 4]);
    }

    #[test]
    #[should_panic(expected = "Vectors have different lengths")]
    fn test_assert_vec_eq_unordered_failure_different_lengths() {
        assert_vec_eq_unordered(&[1, 2], &[1, 2, 4]);
    }

    #[test]
    #[should_panic(expected = "Item 3 not found in second vector")]
    fn test_assert_vec_eq_unordered_failure_unused_element() {
        assert_vec_eq_unordered(&[1, 2, 3], &[1, 2, 4]);
    }
}

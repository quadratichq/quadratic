use super::{Array, CellValue, Value};

pub trait IsBlank {
    /// Returns whether the value is blank. The empty string is considered
    /// non-blank.
    fn is_blank(&self) -> bool;

    /// Coerces the value to a specific type; returns `None` if the conversion
    /// fails or the original value is blank.
    fn coerce_nonblank<T>(self) -> Option<T>
    where
        Self: TryInto<T>,
    {
        match self.is_blank() {
            true => None,
            false => self.try_into().ok(),
        }
    }
}
impl<T: IsBlank> IsBlank for &'_ T {
    fn is_blank(&self) -> bool {
        (*self).is_blank()
    }
}

impl IsBlank for Value {
    fn is_blank(&self) -> bool {
        match self {
            Value::Single(v) => v.is_blank(),
            Value::Array(a) => a.is_blank(),
            Value::Tuple(t) => t.is_blank(),
            Value::Lambda(_) => false, // Lambdas are never blank
        }
    }
}

impl IsBlank for CellValue {
    fn is_blank(&self) -> bool {
        matches!(self, CellValue::Blank)
    }
}

impl IsBlank for Array {
    fn is_blank(&self) -> bool {
        self.cell_values_slice().is_blank()
    }
}

impl<T: IsBlank> IsBlank for [T] {
    fn is_blank(&self) -> bool {
        self.iter().all(|v| v.is_blank())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_blank() {
        assert!(Value::Single(CellValue::Blank).is_blank());
        assert!(!Value::from("").is_blank());
        assert!(!Value::from(0).is_blank());
        assert!(!Value::from(1).is_blank());

        assert!(Value::Single(CellValue::Blank).is_blank());
        assert!(!(Value::from("")).is_blank());
        assert!(!(Value::from(0)).is_blank());
        assert!(!(Value::from(1)).is_blank());

        let a = Array::from(vec![vec!["1.0", "2.0"]]);
        assert!(!Value::Array(a.clone()).is_blank());
        let mut b = Array::new_empty(crate::ArraySize::new(4, 3).unwrap());
        assert!(Value::Array(b.clone()).is_blank());
        b.set(1, 2, CellValue::from(0), false).unwrap();
        assert!(!Value::Array(b.clone()).is_blank());

        let tuple = |elems: &[_]| Value::Tuple(elems.iter().copied().cloned().collect());
        assert!(!tuple(&[&a]).is_blank());
        assert!(!tuple(&[&b]).is_blank());
        assert!(!tuple(&[&a, &b]).is_blank());
        let c = Array::new_empty(crate::ArraySize::new(5, 6).unwrap());
        assert!(!tuple(&[&a, &c]).is_blank());
        assert!(!tuple(&[&c, &a]).is_blank());
        assert!(tuple(&[]).is_blank());
        assert!(tuple(&[&c]).is_blank());
        assert!(tuple(&[&c, &c]).is_blank());
    }
}

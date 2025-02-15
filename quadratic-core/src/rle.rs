use serde::{Deserialize, Serialize};

/// Run-length encoded sequence of values.
#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq, Hash)]
pub struct RunLengthEncoding<T>(Vec<(T, usize)>);
impl<T: Eq + Clone> RunLengthEncoding<T> {
    pub fn new() -> Self {
        RunLengthEncoding(vec![])
    }
    pub fn repeat(value: T, len: usize) -> Self {
        if len == 0 {
            return RunLengthEncoding::new();
        }
        RunLengthEncoding(vec![(value, len)])
    }
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
    pub fn push(&mut self, value: T) {
        match self.0.last_mut() {
            Some((old_value, len)) if *old_value == value => *len += 1,
            _ => self.0.push((value, 1)),
        }
    }
    pub fn push_n(&mut self, value: T, len: usize) {
        if len == 0 {
            return;
        }
        match self.0.last_mut() {
            Some((old_value, old_len)) if *old_value == value => *old_len += len,
            _ => self.0.push((value, len)),
        }
    }
    pub fn extend_runs(&mut self, other: Self) {
        let mut new_runs = other.0.into_iter();
        if let Some((value, len)) = new_runs.next() {
            self.push_n(value, len);
        }
        self.0.extend(new_runs);
    }

    pub fn iter_runs(&self) -> impl Iterator<Item = (&T, usize)> {
        self.0.iter().map(|(value, len)| (value, *len))
    }
    pub fn iter_values(&self) -> impl Iterator<Item = &T> {
        self.iter_runs()
            .flat_map(|(value, len)| std::iter::repeat(value).take(len))
    }
    pub fn get_at(&self, i: usize) -> Option<&T> {
        self.iter_values().nth(i)
    }

    pub fn size(&self) -> usize {
        self.0.iter().map(|(_, len)| len).sum()
    }
}

impl<T: Eq + Clone> FromIterator<T> for RunLengthEncoding<T> {
    fn from_iter<I: IntoIterator<Item = T>>(iter: I) -> Self {
        let mut ret = RunLengthEncoding::new();
        for it in iter {
            ret.push(it);
        }
        ret
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn push_n() {
        let mut rle = RunLengthEncoding::new();
        rle.push_n(1, 0);
        assert_eq!(rle.0, vec![]);
        rle.push_n(1, 1);
        assert_eq!(rle.0, vec![(1, 1)]);
        rle.push_n(1, 2);
        assert_eq!(rle.0, vec![(1, 3)]);
        rle.push_n(2, 1);
        assert_eq!(rle.0, vec![(1, 3), (2, 1)]);
        rle.push_n(2, 2);
        assert_eq!(rle.0, vec![(1, 3), (2, 3)]);
    }

    #[test]
    fn size() {
        let mut rle = RunLengthEncoding::new();
        assert_eq!(rle.size(), 0);
        rle.push_n(1, 0);
        assert_eq!(rle.size(), 0);
        rle.push_n(1, 1);
        assert_eq!(rle.size(), 1);
        rle.push_n(1, 2);
        assert_eq!(rle.size(), 3);
        rle.push_n(2, 1);
        assert_eq!(rle.size(), 4);
        rle.push_n(2, 2);
        assert_eq!(rle.size(), 6);
    }

    #[test]
    fn is_empty() {
        let mut rle = RunLengthEncoding::new();
        assert!(rle.is_empty());

        rle.push_n(1, 0);
        assert!(rle.is_empty());

        let rel = RunLengthEncoding::repeat(0, 1);
        assert!(!rel.is_empty());

        let rel = RunLengthEncoding::repeat(0, 0);
        assert!(rel.is_empty());
    }
}

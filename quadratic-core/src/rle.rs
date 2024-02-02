use serde::{Deserialize, Serialize};

/// Run-length encoded sequence of values.
#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq, Hash)]
pub struct RunLengthEncoding<T>(Vec<(T, usize)>);
impl<T: Eq + Clone> RunLengthEncoding<T> {
    pub fn new() -> Self {
        RunLengthEncoding(vec![])
    }
    pub fn repeat(value: T, len: usize) -> Self {
        RunLengthEncoding(vec![(value, len)])
    }
    pub fn push(&mut self, value: T) {
        match self.0.last_mut() {
            Some((old_value, len)) if *old_value == value => *len += 1,
            _ => self.0.push((value, 1)),
        }
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

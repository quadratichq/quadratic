use serde::{Deserialize, Serialize};

/// Run-length encoded sequence of values.
#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq, Hash)]
pub struct RunLengthEncoding<T>(Vec<(T, usize)>);
impl<T: Eq + Clone> RunLengthEncoding<T> {
    pub(crate) fn new() -> Self {
        RunLengthEncoding(vec![])
    }
    pub(crate) fn push(&mut self, value: T) {
        match self.0.last_mut() {
            Some((old_value, len)) if *old_value == value => *len += 1,
            _ => self.0.push((value, 1)),
        }
    }
    pub(crate) fn iter_runs(&self) -> impl Iterator<Item = (&T, usize)> {
        self.0.iter().map(|(value, len)| (value, *len))
    }
    pub(crate) fn iter_values(&self) -> impl Iterator<Item = &T> {
        self.iter_runs()
            .flat_map(|(value, len)| std::iter::repeat_n(value, len))
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

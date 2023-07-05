use async_trait::async_trait;

use super::BasicValue;
use crate::Pos;

/// Something that acts like a read-only spreadsheet grid.
///
/// Implement this using `#[async_trait(?Send)]`; see this link for why:
/// https://rust-lang.github.io/async-book/07_workarounds/05_async_in_traits.html
///
/// `?Send` is necessary because `JsValue` can't be sent between threads.
#[async_trait(?Send)]
pub trait GridProxy {
    /// Fetches the contents of the cell at `pos`, not checking whether it
    /// results in a circular reference.
    async fn get(&mut self, pos: Pos) -> BasicValue;
}

use super::ActiveTransactions;
use crate::error_core::Result;

impl ActiveTransactions {
    async fn offline_load(&mut self) -> Result<()> {
        Ok(())
    }
}

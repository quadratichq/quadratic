use super::ActiveTransactions;
use crate::LocalForage;
use crate::{controller::transaction::Transaction, error_core::Result};

const DB_NAME: &str = "active_transactions";
const VERSION: u32 = 1;

const CONFIG: LocalForage::Config = LocalForage::Config {
    driver: Some(LocalForage::Driver::IndexedDb),
    name: "active_transactions",
    store_name: "active_transactions",
    version: 1,
};

impl ActiveTransactions {
    async fn offline_load(&mut self, file_id: Uuid) -> Result<()> {
        let localforage = LocalForage::new(CONFIG)?;
        let transactions = localforage
            .get_item::<Vec<Transaction>>(&file_id.to_string())
            .await?;
        if let Some(transactions) = transactions {
            #[cfg(feature = "file-io")]
            dbgjs!(format!(
                "[Offline] Loaded transactions {}",
                transactions.len()
            ));
            self.unsaved_transactions = transactions;
        }
        Ok(())
    }

    async fn offline_save(&mut self, file_id: Uuid) -> Result<()> {
        let localforage = LocalForage::new(CONFIG)?;
        if self.unsaved_transactions.is_empty() {
            localforage.remove_item(&file_id.to_string()).await?;
        } else {
            localforage
                .set_item(&file_id.to_string(), &self.unsaved_transactions)
                .await?;
            #[cfg(feature = "file-io")]
            dbgjs!(format!(
                "[Offline] Saved transactions {}",
                transactions.len()
            ));
        }
        Ok(())
    }
}

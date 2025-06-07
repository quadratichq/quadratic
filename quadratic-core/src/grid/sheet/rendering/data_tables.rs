use crate::{compression::serialize_to_bytes, grid::Sheet};

impl Sheet {
    /// Sends the data tables cache to the client.
    pub fn send_data_tables_cache(&self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        match serialize_to_bytes(self.data_tables.cache_ref()) {
            Ok(bytes) => {
                crate::wasm_bindings::js::jsSendDataTablesCache(self.id_to_string(), bytes);
            }
            Err(e) => {
                dbgjs!(format!(
                    "[send_data_tables_cache] Error serializing data tables cache {:?}",
                    e.to_string()
                ));
            }
        }
    }
}

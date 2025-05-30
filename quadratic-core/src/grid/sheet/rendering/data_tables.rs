use crate::grid::Sheet;

impl Sheet {
    /// Sends the data tables cache to the client.
    pub fn send_data_tables_cache(&self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        let cache = self.data_tables.export_cache();
        if let Ok(bytes) = serde_json::to_vec(&cache) {
            crate::wasm_bindings::js::jsSendDataTablesCache(self.id_to_string(), bytes);
        }
    }
}

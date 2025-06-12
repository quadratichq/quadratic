#[cfg(test)]
use crate::wasm_bindings::sheet_content_cache::SheetContentCache;
use crate::{compression::serialize_to_bytes, grid::Sheet};

impl Sheet {
    #[cfg(test)]
    pub fn content_cache(&self) -> SheetContentCache {
        self.into()
    }

    /// Sends the content cache to the client.
    pub fn send_content_cache(&self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        match serialize_to_bytes(self.columns.has_cell_value_ref()) {
            Ok(bytes) => {
                crate::wasm_bindings::js::jsSendContentCache(self.id_to_string(), bytes);
            }
            Err(e) => {
                dbgjs!(format!(
                    "[send_content_cache] Error serializing has_cell_value cache {:?}",
                    e.to_string()
                ));
            }
        }
    }

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

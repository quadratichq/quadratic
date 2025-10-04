#[cfg(test)]
use crate::wasm_bindings::sheet_content_cache::SheetContentCache;
use crate::{
    compression::{SerializationFormat, serialize},
    grid::Sheet,
};

impl Sheet {
    #[cfg(test)]
    pub(crate) fn content_cache(&self) -> SheetContentCache {
        self.into()
    }

    /// Sends the content cache to the client.
    pub(crate) fn send_content_cache(&self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        match serialize(
            &SerializationFormat::Bincode,
            self.columns.has_cell_value_ref(),
        ) {
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
    pub(crate) fn send_data_tables_cache(&self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        match serialize(&SerializationFormat::Bincode, self.data_tables.cache_ref()) {
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

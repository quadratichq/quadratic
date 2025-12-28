use bincode::{Decode, Encode};
use serde::{Deserialize, Serialize};
use strum_macros::Display;
#[cfg(feature = "js")]
use wasm_bindgen::{JsValue, convert::IntoWasmAbi};

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq, Hash, Encode, Decode)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub enum CodeCellLanguage {
    #[default]
    Python,
    Formula,
    /// Database connection.
    Connection {
        kind: ConnectionKind,
        id: String,
    },
    Javascript,
    /// CSV or other file import.
    Import,
}

impl CodeCellLanguage {
    pub fn as_string(&self) -> String {
        match self {
            CodeCellLanguage::Python => "Python".to_string(),
            CodeCellLanguage::Formula => "Formula".to_string(),
            CodeCellLanguage::Connection { kind, .. } => kind.to_string(),
            CodeCellLanguage::Javascript => "JavaScript".to_string(),
            CodeCellLanguage::Import => "Import".to_string(),
        }
    }
}

impl CodeCellLanguage {
    pub fn is_code_language(&self) -> bool {
        matches!(
            self,
            CodeCellLanguage::Python | CodeCellLanguage::Javascript
        )
    }

    /// Returns whether this language that uses `q.cells()` syntax (either
    /// Python or Javascript).
    pub fn has_q_cells(&self) -> bool {
        *self == CodeCellLanguage::Python || *self == CodeCellLanguage::Javascript
    }

    pub fn has_handle_bars(&self) -> bool {
        matches!(self, CodeCellLanguage::Connection { .. })
    }
}

#[derive(Serialize, Deserialize, Display, Copy, Debug, Clone, PartialEq, Eq, Hash, Encode, Decode)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "UPPERCASE")]
pub enum ConnectionKind {
    Postgres,
    Mysql,
    Mssql,
    Snowflake,
    Cockroachdb,
    Bigquery,
    Mariadb,
    Supabase,
    Neon,
    Mixpanel,
}

#[cfg(feature = "js")]
impl wasm_bindgen::describe::WasmDescribe for ConnectionKind {
    fn describe() {
        JsValue::describe();
    }
}

#[cfg(feature = "js")]
impl wasm_bindgen::convert::IntoWasmAbi for ConnectionKind {
    type Abi = <JsValue as IntoWasmAbi>::Abi;

    fn into_abi(self) -> Self::Abi {
        serde_wasm_bindgen::to_value(&self)
            .unwrap_or("Formula".into())
            .into_abi()
    }
}

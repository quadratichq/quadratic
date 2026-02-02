use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::quadratic_api::FilePermRole;

pub mod request;
pub mod response;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct User {
    pub session_id: Uuid,
    pub user_id: String,
    pub connection_id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub image: String,
    pub index: usize,
    pub permissions: Vec<FilePermRole>,
    #[serde(flatten)]
    pub state: UserState,
    /// Whether this user is an AI agent (for AI multiplayer mode)
    #[serde(default)]
    pub is_ai_agent: bool,
    /// The AI agent's persona type (e.g., "DataAnalyst", "VisualizationExpert")
    #[serde(default)]
    pub agent_persona: Option<String>,
    /// The AI agent's assigned color
    #[serde(default)]
    pub agent_color: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
pub struct CellEdit {
    pub active: bool,
    pub text: String,
    pub cursor: u32,
    pub code_editor: bool,
    pub inline_code_editor: bool,
    pub bold: Option<bool>,
    pub italic: Option<bool>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct UserState {
    pub sheet_id: Uuid,
    pub selection: String,
    pub code_running: String,
    pub cell_edit: CellEdit,
    pub x: f64,
    pub y: f64,
    pub visible: bool,
    pub viewport: String,
    pub follow: Option<Uuid>,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct UserStateUpdate {
    pub sheet_id: Option<Uuid>,
    pub selection: Option<String>,
    pub cell_edit: Option<CellEdit>,
    pub code_running: Option<String>,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub visible: Option<bool>,
    pub viewport: Option<String>,

    // empty string signifies removing follow; otherwise we'll parse the string for the Uuid
    pub follow: Option<String>,
}

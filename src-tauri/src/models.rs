use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub dir_name: String,
    pub display_path: String,
    pub session_count: usize,
    pub archived_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub session_id: String,
    pub title: String,
    pub timestamp: String,
    pub message_count: usize,
    pub cwd: String,
    pub model: Option<String>,
    pub archived: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationMessage {
    pub uuid: String,
    pub role: MessageRole,
    pub timestamp: String,
    pub content: Vec<ContentBlock>,
    pub model: Option<String>,
    pub is_sidechain: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    Text {
        text: String,
    },
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
    ToolResult {
        tool_use_id: String,
        content: serde_json::Value,
    },
    Thinking {
        thinking: String,
    },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawEntry {
    #[serde(rename = "type")]
    pub entry_type: Option<String>,
    pub uuid: Option<String>,
    pub timestamp: Option<String>,
    pub message: Option<RawMessage>,
    pub cwd: Option<String>,
    pub slug: Option<String>,
    pub custom_title: Option<String>,
    pub ai_title: Option<String>,
    #[serde(default)]
    pub is_sidechain: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawMessage {
    pub model: Option<String>,
    pub content: Option<serde_json::Value>,
}

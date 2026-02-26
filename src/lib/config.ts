/**
 * Anti-API 配置
 * Antigravity API端点和模型映射
 */

// 默认端口
export const DEFAULT_PORT = 8964

// 支持的模型列表（用于/v1/models端点）
export const AVAILABLE_MODELS = [
    // Claude 4.5 系列
    { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
    { id: "claude-sonnet-4-5-thinking", name: "Claude Sonnet 4.5 (Thinking)" },
    { id: "claude-opus-4-5-thinking", name: "Claude Opus 4.5 (Thinking)" },

    // Claude 4.6 系列
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { id: "claude-sonnet-4-6-thinking", name: "Claude Sonnet 4.6 (Thinking)" },
    { id: "claude-opus-4-6-thinking", name: "Claude Opus 4.6 (Thinking)" },

    // Gemini 3.1 系列
    { id: "gemini-3-1-pro-high", name: "Gemini 3.1 Pro (High)" },
    { id: "gemini-3-pro-high", name: "Gemini 3 Pro (High)" },
    { id: "gemini-3-pro-low", name: "Gemini 3 Pro (Low)" },

    // Gemini Flash
    { id: "gemini-3-flash", name: "Gemini 3 Flash" },
    { id: "gemini-3-flash-thinking", name: "Gemini 3 Flash (Thinking)" },

    // GPT-OSS
    { id: "gpt-oss-120b", name: "GPT-OSS 120B (Medium)" },
]


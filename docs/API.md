# Spear Proxy API Reference / API 参考

## Authentication / 认证

All requests require an API key issued from the admin dashboard.

所有请求需要从管理面板签发的 API 密钥。

```bash
Authorization: Bearer ak-YOUR_API_KEY
# or for Anthropic format / 或 Anthropic 格式:
x-api-key: ak-YOUR_API_KEY
```

---

## Available Models / 可用模型

Spear Proxy uses **flow route model IDs** — semantic names without version numbers. Each flow route maps to one or more upstream provider chains with automatic failover.

Spear Proxy 使用 **流式路由模型 ID** — 无版本号的语义名称。每个路由映射到一个或多个上游提供商链，支持自动故障转移。

| Model ID | Description | 描述 |
|----------|-------------|------|
| `Opus-thinking` | Most capable reasoning model | 最强推理模型 |
| `Sonnet-thinking` | Fast reasoning model | 快速推理模型 |
| `Gemini-Pro-High` | High quality Gemini | 高质量 Gemini |
| `Gemini-Flash-Thinking` | Fast Gemini with reasoning | 快速 Gemini 推理 |
| `Haiku` | Ultra-fast, lightweight | 极速轻量 |

> **Note:** Only flow route model IDs are supported. Raw provider model IDs with version numbers (e.g. `claude-opus-4-6-thinking`, `claude-sonnet-4-5`) are **not accepted** by the API. Use the flow route names listed above.
>
> **注意：** 仅支持流式路由模型 ID。带版本号的原始模型 ID（如 `claude-opus-4-6-thinking`、`claude-sonnet-4-5`）**不被接受**。请使用上方列出的路由名称。

### Check Available Models / 查看可用模型

```bash
GET /v1/models
```

Returns the current list of supported flow route model IDs.

---

## OpenAI Compatible API

### POST /v1/chat/completions

**Request Example / 请求示例:**

```bash
curl -X POST https://anti-api-proxy-production.up.railway.app/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ak-YOUR_API_KEY" \
  -d '{
    "model": "Opus-thinking",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": false
  }'
```

**Response / 响应:**

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1700000000,
  "model": "Opus-thinking",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you today?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

### Streaming / 流式响应

Set `"stream": true` to receive Server-Sent Events:

```bash
curl -X POST https://anti-api-proxy-production.up.railway.app/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ak-YOUR_API_KEY" \
  -d '{"model": "Sonnet-thinking", "messages": [{"role": "user", "content": "Hi"}], "stream": true}'
```

**Stream Response:**
```
data: {"id":"chatcmpl-abc","choices":[{"delta":{"role":"assistant"}}]}
data: {"id":"chatcmpl-abc","choices":[{"delta":{"content":"Hello"}}]}
data: {"id":"chatcmpl-abc","choices":[{"delta":{"content":"!"}}]}
data: {"id":"chatcmpl-abc","choices":[{"finish_reason":"stop"}]}
data: [DONE]
```

---

## Anthropic Compatible API

### POST /v1/messages

**Request Example / 请求示例:**

```bash
curl -X POST https://anti-api-proxy-production.up.railway.app/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: ak-YOUR_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "Opus-thinking",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

**Response / 响应:**

```json
{
  "id": "msg_abc123",
  "type": "message",
  "role": "assistant",
  "content": [{
    "type": "text",
    "text": "Hello! How can I help you today?"
  }],
  "model": "Opus-thinking",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 10,
    "output_tokens": 20
  }
}
```

---

## Tool Calling / 工具调用

### OpenAI Format

```bash
curl -X POST https://anti-api-proxy-production.up.railway.app/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ak-YOUR_API_KEY" \
  -d '{
    "model": "Opus-thinking",
    "messages": [{"role": "user", "content": "What is the weather in Tokyo?"}],
    "tools": [{
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get current weather",
        "parameters": {
          "type": "object",
          "properties": {
            "city": {"type": "string", "description": "City name"}
          },
          "required": ["city"]
        }
      }
    }]
  }'
```

**Tool Call Response:**
```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "tool_calls": [{
        "id": "call_abc123",
        "type": "function",
        "function": {
          "name": "get_weather",
          "arguments": "{\"city\": \"Tokyo\"}"
        }
      }]
    },
    "finish_reason": "tool_calls"
  }]
}
```

---

## Error Codes / 错误码

| Status | Description | 描述 |
|--------|-------------|------|
| 200 | Success | 成功 |
| 400 | Bad Request / Invalid model ID | 请求格式错误 / 无效模型 ID |
| 401 | Unauthorized — invalid API key | 未授权 — API 密钥无效 |
| 429 | Rate Limited | 请求过于频繁或配额耗尽 |
| 500 | Server Error | 服务器内部错误 |
| 503 | Upstream Unavailable | 上游服务不可用 |

**Error Response Format:**
```json
{
  "error": {
    "type": "error_type",
    "message": "Error description"
  }
}
```

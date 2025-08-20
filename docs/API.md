# API Documentation

This document describes the REST API endpoints available in the OpenTelemetry AI Chatbot application.

## Base URL

- Development: `http://localhost:3001/api`
- Production: `https://your-domain.com/api`

## Authentication

Currently, the API supports optional API key authentication via the `X-API-Key` header. If the `API_KEY` environment variable is set, all requests must include this header.

```bash
curl -H "X-API-Key: your-api-key" http://localhost:3001/api/health
```

## Rate Limiting

- **Window**: 60 seconds (configurable via `RATE_LIMIT_WINDOW_MS`)
- **Max Requests**: 30 per window (configurable via `RATE_LIMIT_MAX_REQUESTS`)

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Window reset time

## Chat Endpoints

### Send Chat Message

Send a message to the AI chatbot and receive a response.

**Endpoint**: `POST /api/chat`

**Request Body**:
```json
{
  "message": "How do I set up OpenTelemetry for Node.js?",
  "provider": "openai",
  "maxContextDocs": 5,
  "includeContext": false
}
```

**Parameters**:
- `message` (string, required): The user's question (1-2000 characters)
- `provider` (string, optional): LLM provider to use (`openai`, `anthropic`, `bedrock`)
- `maxContextDocs` (integer, optional): Maximum context documents to retrieve (1-10, default: 5)
- `includeContext` (boolean, optional): Include detailed context information in response (default: false)

**Response**:
```json
{
  "success": true,
  "data": {
    "response": "To set up OpenTelemetry for Node.js...",
    "sources": [
      "otel-docs",
      "nodejs-instrumentation"
    ],
    "metadata": {
      "provider": "openai",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

**Example**:
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I create custom spans?",
    "provider": "openai",
    "maxContextDocs": 3
  }'
```

### Get Context for Question

Retrieve relevant context documents for a question without generating a response.

**Endpoint**: `GET /api/chat/context`

**Query Parameters**:
- `question` (string, required): The question to get context for
- `maxDocs` (integer, optional): Maximum documents to return (default: 5)

**Response**:
```json
{
  "success": true,
  "data": {
    "context": "Source: otel-docs (Relevance: 0.87)\nContent about spans...",
    "sources": ["otel-docs", "instrumentation-guide"],
    "documentCount": 3
  }
}
```

**Example**:
```bash
curl "http://localhost:3001/api/chat/context?question=custom%20spans&maxDocs=3"
```

### Get Available Providers

List all available LLM providers and their status.

**Endpoint**: `GET /api/chat/providers`

**Response**:
```json
{
  "success": true,
  "data": {
    "providers": ["openai", "anthropic", "bedrock"],
    "default": "openai"
  }
}
```

**Example**:
```bash
curl http://localhost:3001/api/chat/providers
```

### Test Provider

Test connectivity and functionality of a specific LLM provider.

**Endpoint**: `POST /api/chat/test-provider`

**Request Body**:
```json
{
  "provider": "openai"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "response": "Hello! This is a test response from OpenAI."
  }
}
```

**Example**:
```bash
curl -X POST http://localhost:3001/api/chat/test-provider \
  -H "Content-Type: application/json" \
  -d '{"provider": "anthropic"}'
```

## Admin Endpoints

### Ingest Document

Add a new document to the knowledge base.

**Endpoint**: `POST /api/admin/ingest`

**Request Body**:
```json
{
  "title": "Custom OpenTelemetry Guide",
  "content": "This is the content of your documentation...",
  "source": "internal-docs",
  "metadata": {
    "type": "guide",
    "version": "1.0",
    "author": "Team Name"
  }
}
```

**Parameters**:
- `title` (string, required): Document title (1-200 characters)
- `content` (string, required): Document content (minimum 10 characters)
- `source` (string, required): Source identifier (1-100 characters)
- `url` (string, optional): Source URL if applicable
- `metadata` (object, optional): Additional metadata

**Response**:
```json
{
  "success": true,
  "data": {
    "title": "Custom OpenTelemetry Guide",
    "source": "internal-docs",
    "chunksAdded": 3,
    "message": "Document successfully ingested"
  }
}
```

**Example**:
```bash
curl -X POST http://localhost:3001/api/admin/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Custom Guide",
    "content": "This guide explains how to...",
    "source": "team-docs"
  }'
```

### Get Vector Store Information

Retrieve information about the vector store collection.

**Endpoint**: `GET /api/admin/vector-store/info`

**Response**:
```json
{
  "success": true,
  "data": {
    "collectionName": "otel_knowledge",
    "initialized": true
  }
}
```

**Example**:
```bash
curl http://localhost:3001/api/admin/vector-store/info
```

### Search Documents

Search for documents in the vector store by query.

**Endpoint**: `POST /api/admin/search`

**Request Body**:
```json
{
  "query": "express instrumentation",
  "maxResults": 5
}
```

**Parameters**:
- `query` (string, required): Search query
- `maxResults` (integer, optional): Maximum results to return (default: 5)

**Response**:
```json
{
  "success": true,
  "data": {
    "query": "express instrumentation",
    "results": [
      {
        "content": "Express.js auto-instrumentation...",
        "metadata": {
          "source": "otel-docs",
          "title": "Express Integration"
        },
        "score": 0.89
      }
    ]
  }
}
```

**Example**:
```bash
curl -X POST http://localhost:3001/api/admin/search \
  -H "Content-Type: application/json" \
  -d '{"query": "metrics collection", "maxResults": 3}'
```

### Delete Vector Store

Delete the entire vector store collection (use with caution).

**Endpoint**: `DELETE /api/admin/vector-store`

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Vector store collection deleted successfully"
  }
}
```

**Example**:
```bash
curl -X DELETE http://localhost:3001/api/admin/vector-store
```

## System Endpoints

### Health Check

Check the health and status of the application.

**Endpoint**: `GET /api/health`

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "development",
  "availableProviders": ["openai", "anthropic"]
}
```

**Example**:
```bash
curl http://localhost:3001/api/health
```

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "success": false,
  "error": "Error description",
  "message": "Detailed error message"
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing API key)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

### Common Error Examples

**Validation Error**:
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "message",
      "message": "Message must be between 1 and 2000 characters",
      "value": ""
    }
  ]
}
```

**Rate Limit Error**:
```json
{
  "success": false,
  "error": "Too many requests from this IP, please try again later.",
  "retryAfter": 60
}
```

**Provider Error**:
```json
{
  "success": false,
  "error": "LLM provider 'invalid' not available",
  "message": "Available providers: openai, anthropic"
}
```

## WebSocket Support

Currently not implemented, but planned for future versions to support real-time streaming responses.

## SDK Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Send chat message
async function askQuestion(message) {
  try {
    const response = await api.post('/chat', {
      message,
      provider: 'openai'
    });
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Usage
askQuestion('How do I instrument Express?').then(result => {
  console.log(result.data.response);
});
```

### Python

```python
import requests

API_BASE = 'http://localhost:3001/api'

def ask_question(message, provider='openai'):
    response = requests.post(f'{API_BASE}/chat', json={
        'message': message,
        'provider': provider
    })
    return response.json()

# Usage
result = ask_question('How do I create custom metrics?')
print(result['data']['response'])
```

### cURL Scripts

Create reusable scripts for common operations:

```bash
#!/bin/bash
# chat.sh - Send a chat message

MESSAGE="$1"
PROVIDER="${2:-openai}"

curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"$MESSAGE\", \"provider\": \"$PROVIDER\"}" \
  | jq '.data.response'
```

Usage:
```bash
./chat.sh "How do I set up tracing?" openai
```

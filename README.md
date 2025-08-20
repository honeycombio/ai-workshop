# OpenTelemetry AI Chatbot 🤖

An intelligent chatbot application designed to help developers with OpenTelemetry integration and instrumentation. Built with Node.js, React, and powered by multiple LLM providers through LangChain with RAG (Retrieval Augmented Generation) capabilities.

## ✨ Features

- **Multi-LLM Support**: Compatible with OpenAI, Anthropic Claude, and AWS Bedrock
- **RAG-Powered Responses**: Uses vector search to provide contextually relevant answers
- **OpenTelemetry Expertise**: Pre-loaded with comprehensive OpenTelemetry documentation
- **Modern Web Interface**: Clean, responsive React-based chat interface
- **Real-time Streaming**: Fast response generation with typing indicators
- **Source Attribution**: Shows which documents were used to generate responses
- **Provider Switching**: Easily switch between different AI providers

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │────│  Express API    │────│   LLM Provider  │
│                 │    │                 │    │ (OpenAI/Claude/ │
│  - Chat UI      │    │  - Chat Routes  │    │     Bedrock)    │
│  - Provider     │    │  - Admin Routes │    └─────────────────┘
│    Selection    │    │  - Middleware   │    
└─────────────────┘    └─────────────────┘    
                                │              
                       ┌───────────────────┐    
                       │  Vector Store     │    
                       │   (ChromaDB)      │    
                       │                   │    
                       │  - OTel Docs      │    
                       │  - Code Examples  │    
                       │  - Best Practices │    
                       └───────────────────┘    
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- One or more LLM provider API keys:
  - OpenAI API key
  - Anthropic API key  
  - AWS credentials (for Bedrock)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hny-ai-workshop
   ```

2. **Run quick start script**
   ```bash
   scripts/quick-start.sh
   ```
   The quick start script is a one-for-all script that checks and installs all the required libraries and starts up the whole thing.
   Here are the layout of the individual steps that you can perform individually:

   1. **Install dependencies**
      ```bash
      # install concurrently
      npm install --save-dev concurrently

      # Install server dependencies
      npm install
      
      # Install client dependencies
      cd client && npm install && cd ..
      
      # Or use the convenience script
      npm run install-all
      ```

   2. **Configure environment variables**
      ```bash
      cp env.example .env
      ```
      
      Edit `.env` with your configuration:
      ```env
      # Choose your default LLM provider
      DEFAULT_LLM_PROVIDER=openai
      
      # Add your API keys
      OPENAI_API_KEY=your_openai_api_key_here
      ANTHROPIC_API_KEY=your_anthropic_api_key_here
      
      # AWS Bedrock (optional)
      AWS_ACCESS_KEY_ID=your_aws_access_key
      AWS_SECRET_ACCESS_KEY=your_aws_secret_key
      AWS_REGION=us-east-1
      ```

   3. **Set up ChromaDB (Vector Database)**
      
      Install and start ChromaDB:
      ```bash
      pip install chromadb
      chroma run --host localhost --port 8000
      ```

   4. **Ingest OpenTelemetry documentation**
      ```bash
      npm run setup-data
      ```

   5. **Start the application**
      ```bash
      # Development mode (starts both server and client)
      npm run dev
      
      # Or start server only
      npm start

      # Or start everything (client, server, and chromaDB)
      npm run start:all
      or
      scripts/quick-start.sh
   ```

7. **Access the application**
   - Frontend: http://localhost:3000
   - API: http://localhost:3001/api
   - Health check: http://localhost:3001/api/health

8. **Stop the application
   ```bash
   npm run stop:all
   ```
## 📖 Usage

### Chat Interface

1. Open the web application in your browser
2. Select your preferred LLM provider from the dropdown
3. Ask questions about OpenTelemetry integration:
   - "How do I set up auto-instrumentation for Express?"
   - "What's the difference between manual and automatic instrumentation?"
   - "How can I create custom spans?"
   - "How do I configure sampling?"

### API Endpoints

#### Chat API
- `POST /api/chat` - Send a chat message
- `GET /api/chat/context` - Get context for a question
- `GET /api/chat/providers` - List available providers
- `POST /api/chat/test-provider` - Test a provider

#### Admin API
- `POST /api/admin/ingest` - Add documents to knowledge base
- `GET /api/admin/vector-store/info` - Get vector store info
- `POST /api/admin/search` - Search documents
- `DELETE /api/admin/vector-store` - Reset knowledge base

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment | development |
| `DEFAULT_LLM_PROVIDER` | Default AI provider | openai |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `AWS_ACCESS_KEY_ID` | AWS access key | - |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | - |
| `CHROMA_DB_PATH` | Vector DB path | ./data/chroma_db |
| `MAX_CONTEXT_LENGTH` | Max context tokens | 4000 |
| `TEMPERATURE` | LLM temperature | 0.7 |

### Adding Custom Documentation

You can add your own documentation to the knowledge base:

```bash
curl -X POST http://localhost:3001/api/admin/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Custom OTel Guide",
    "content": "Your documentation content here...",
    "source": "internal-docs",
    "metadata": {
      "type": "guide",
      "version": "1.0"
    }
  }'
```

## 🧪 Development

### Project Structure

```
hny-ai-workshop/
├── server/                 # Backend Express.js application
│   ├── config/            # Configuration and logging
│   ├── middleware/        # Express middleware
│   ├── routes/           # API route handlers
│   ├── services/         # Business logic services
│   └── index.js          # Server entry point
├── client/               # React frontend application
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── services/     # API service layer
│   │   └── App.js        # Main app component
│   └── public/           # Static assets
├── scripts/              # Utility scripts
│   └── ingest-data.js    # Data ingestion script
├── data/                 # Data storage directory
└── docs/                 # Documentation
```

### Adding New LLM Providers

1. Install the LangChain integration package
2. Add provider configuration to `server/config/index.js`
3. Initialize the provider in `server/services/llmProvider.js`
4. Update environment variable documentation

### Running Tests

```bash
npm test
```

### Building for Production

```bash
# Build the React client
npm run build

# Start in production mode
NODE_ENV=production npm start
```

## 🛠️ Troubleshooting

### Common Issues

1. **No traces/providers available**
   - Check your API keys in `.env`
   - Verify the provider is properly configured
   - Check server logs for initialization errors

2. **ChromaDB connection issues**
   - Ensure ChromaDB is running on localhost:8000
   - Check if the collection exists
   - Try resetting the vector store

3. **Frontend can't reach API**
   - Verify the proxy configuration in `client/package.json`
   - Check that the backend is running on port 3001
   - Look for CORS issues in browser console

### Debug Mode

Enable debug logging:
```bash
NODE_ENV=development npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- OpenTelemetry community for excellent documentation
- LangChain for RAG capabilities
- All the AI providers for making this possible

---

For more information, check out the [OpenTelemetry documentation](https://opentelemetry.io/docs/) or ask the chatbot! 🚀

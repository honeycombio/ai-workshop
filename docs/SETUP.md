# Setup Guide

This guide will walk you through setting up the OpenTelemetry AI Chatbot application step by step.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18 or higher**: [Download from nodejs.org](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **Python 3.8+** (for ChromaDB)
- **pip** (Python package manager)

## Step 1: API Keys Setup

You'll need at least one of the following AI provider API keys:

### OpenAI (Recommended)
1. Go to [OpenAI API](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key (starts with `sk-`)

### Anthropic Claude
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create an API key
3. Copy the key

### AWS Bedrock
1. Set up AWS credentials with Bedrock access
2. Configure AWS CLI or use access keys
3. Ensure your region supports Bedrock models

## Step 2: ChromaDB Installation

ChromaDB is used as the vector database for storing OpenTelemetry documentation.

### Option A: Using pip (Recommended)
```bash
pip install chromadb
```

### Option B: Using conda
```bash
conda install -c conda-forge chromadb
```

### Option C: Using Docker
```bash
docker pull chromadb/chroma
docker run -p 8000:8000 chromadb/chroma
```

## Step 3: Start ChromaDB Server

Start the ChromaDB server before running the application:

```bash
chroma run --host localhost --port 8000
```

You should see output similar to:
```
Running on http://localhost:8000
```

## Step 4: Project Setup

1. **Clone and navigate to the project**
   ```bash
   cd hny-ai-workshop
   ```

2. **Install all dependencies**
   ```bash
   npm run install-all
   ```
   
   This installs both server and client dependencies.

3. **Create environment configuration**
   ```bash
   cp env.example .env
   ```

4. **Configure your .env file**
   
   Open `.env` in your text editor and configure:
   
   ```env
   # Server Configuration
   PORT=3001
   NODE_ENV=development
   
   # Choose your default LLM provider
   DEFAULT_LLM_PROVIDER=openai
   
   # OpenAI Configuration
   OPENAI_API_KEY=sk-your-actual-openai-key-here
   OPENAI_MODEL=gpt-4-turbo-preview
   
   # Anthropic Configuration (optional)
   ANTHROPIC_API_KEY=your-anthropic-key-here
   ANTHROPIC_MODEL=claude-3-sonnet-20240229
   
   # AWS Bedrock Configuration (optional)
   AWS_ACCESS_KEY_ID=your-aws-access-key
   AWS_SECRET_ACCESS_KEY=your-aws-secret-key
   AWS_REGION=us-east-1
   
   # Vector Database Configuration
   CHROMA_DB_PATH=./data/chroma_db
   CHROMA_COLLECTION_NAME=otel_knowledge
   ```

## Step 5: Initialize the Knowledge Base

Load OpenTelemetry documentation into the vector database:

```bash
npm run setup-data
```

You should see output like:
```
✅ Data ingestion completed successfully!
📊 Summary: 5 documents, 47 chunks
```

## Step 6: Start the Application

### Development Mode (Recommended)
Start both server and client in development mode:

```bash
npm run dev
```

This will:
- Start the Express server on http://localhost:3001
- Start the React development server on http://localhost:3000
- Enable hot reloading for both

### Production Mode
Build and start in production mode:

```bash
npm run build
npm start
```

## Step 7: Verify Installation

1. **Check the health endpoint**
   ```bash
   curl http://localhost:3001/api/health
   ```

2. **Open the web interface**
   Navigate to http://localhost:3000 in your browser

3. **Test the chat functionality**
   Try asking: "How do I set up OpenTelemetry auto-instrumentation for Node.js?"

## Troubleshooting

### Common Issues

1. **ChromaDB Connection Error**
   ```
   Error: Could not connect to ChromaDB
   ```
   
   **Solution**: Ensure ChromaDB is running:
   ```bash
   chroma run --host localhost --port 8000
   ```

2. **LLM Provider Error**
   ```
   Error: No LLM providers could be initialized
   ```
   
   **Solution**: Check your API keys in `.env` file

3. **Port Already in Use**
   ```
   Error: listen EADDRINUSE :::3001
   ```
   
   **Solution**: Kill the process using the port or change the port:
   ```bash
   # Find and kill process
   lsof -ti:3001 | xargs kill -9
   
   # Or change port in .env
   PORT=3002
   ```

4. **Module Not Found Errors**
   ```
   Error: Cannot find module '@langchain/openai'
   ```
   
   **Solution**: Reinstall dependencies:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

5. **React Build Errors**
   ```
   Error: Module build failed
   ```
   
   **Solution**: Clear cache and rebuild:
   ```bash
   cd client
   rm -rf node_modules .cache build
   npm install
   npm start
   ```

### Debug Mode

Enable detailed logging by setting:
```env
NODE_ENV=development
```

Check the logs in the `logs/` directory:
- `logs/error.log` - Error messages
- `logs/combined.log` - All log messages

### API Testing

Test individual API endpoints:

```bash
# Test health
curl http://localhost:3001/api/health

# Test providers
curl http://localhost:3001/api/chat/providers

# Test chat (with your API key configured)
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how do I instrument Express with OpenTelemetry?"}'
```

## Next Steps

Once everything is working:

1. **Explore the chat interface** - Try different types of OpenTelemetry questions
2. **Switch between providers** - Use the provider selector to compare responses
3. **Add custom documentation** - Use the admin API to add your own docs
4. **Customize the configuration** - Adjust sampling, context length, etc.

For more detailed information, check the main [README.md](../README.md) file.

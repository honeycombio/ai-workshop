#!/bin/bash

# OpenTelemetry AI Chatbot - Quick Start Script
# This script helps you get the application running quickly

set -e

echo "🚀 OpenTelemetry AI Chatbot - Quick Start"
echo "========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if Python is installed (for ChromaDB)
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "❌ Python is not installed. Please install Python 3.8+ for ChromaDB."
    exit 1
fi

echo "✅ Python detected"

# Check if pip is available
if ! command -v pip3 &> /dev/null && ! command -v pip &> /dev/null; then
    echo "❌ pip is not installed. Please install pip for ChromaDB setup."
    exit 1
fi

echo "✅ pip detected"

# Install ChromaDB if not already installed
if ! command -v chroma &> /dev/null; then
    echo "📦 Installing ChromaDB..."
    pip3 install chromadb 2>/dev/null || pip install chromadb
    echo "✅ ChromaDB installed"
else
    echo "✅ ChromaDB already installed"
fi

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
if [ ! -d "node_modules" ]; then
    npm install
    npm install --save-dev concurrently
fi

if [ ! -d "client/node_modules" ]; then
    cd client && npm install && cd ..
fi

echo "✅ Dependencies installed"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "⚙️ Creating .env file from template..."
    cp env.example .env
    echo "✅ .env file created"
    echo ""
    echo "🔧 IMPORTANT: Please edit the .env file and add your API keys:"
    echo "   - OPENAI_API_KEY=your_openai_key_here"
    echo "   - ANTHROPIC_API_KEY=your_anthropic_key_here (optional)"
    echo "   - AWS credentials for Bedrock (optional)"
    echo ""
    read -p "Press Enter when you've configured your API keys..."
else
    echo "✅ .env file already exists"
fi

# Create logs directory
mkdir -p logs
echo "✅ Logs directory created"

# Create data directory
mkdir -p data
echo "✅ Data directory created"

# Start ChromaDB in background
echo "🔄 Starting ChromaDB server..."
if ! pgrep -f "chroma run" > /dev/null; then
    nohup chroma run --host localhost --port 8000 > logs/chroma.log 2>&1 &
    CHROMA_PID=$!
    echo $CHROMA_PID > .chroma.pid
    echo "✅ ChromaDB started (PID: $CHROMA_PID)"
    echo "   Logs: logs/chroma.log"
    
    # Wait a moment for ChromaDB to start
    sleep 10
else
    echo "✅ ChromaDB already running"
fi

# Test ChromaDB connection
echo "🔍 Testing ChromaDB connection..."
if curl -s http://localhost:8000/api/v1/heartbeat > /dev/null; then
    echo "✅ ChromaDB is responsive"
else
    echo "❌ ChromaDB is not responding. Check logs/chroma.log"
    exit 1
fi

# Ingest sample data
echo "📚 Ingesting OpenTelemetry documentation..."
npm run setup-data

# start the application
npx concurrently "npm run start:server" "npm run start:client"

APP_PORT=3000

# Check if running in GitHub Codespaces
if [ -n "$CODESPACES" ]; then
    echo "Running in GitHub Codespaces."

    # Get Codespaces name and port
    CODESPACE_NAME=$(echo $CODESPACE_NAME)

    URL="https://${CODESPACE_NAME}-${APP_PORT}.app.github.dev"

    exit 0
else
    echo "Running locally"
    URL="http://localhost:${APP_PORT}"
fi

echo ""
echo "🎉 Setup completed successfully, and all services are running!"
echo ""
echo "Next steps:"
echo "1. Open your browser to:"
echo "   ${URL}"
echo ""
echo "2. Try asking questions like:"
echo "   - How do I set up OpenTelemetry for Express?"
echo "   - What's the difference between manual and auto instrumentation?"
echo "   - How do I create custom spans?"
echo ""
echo "3. To stop, run:"
echo "   npm run stop:all"
echo ""
echo "Enjoy! 🚀"

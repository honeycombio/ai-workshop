# OpenTelemetry AI Chatbot 🤖

An intelligent chatbot application designed to help developers with OpenTelemetry integration and instrumentation. Built with Node.js, React, and powered by AWS Bedrock (Claude 3.5 Sonnet) with RAG (Retrieval Augmented Generation) capabilities.

## ✨ Features

- **AWS Bedrock Integration**: Powered by Claude 3.5 Sonnet for intelligent responses
- **RAG-Powered Responses**: Uses vector search to provide contextually relevant answers from OpenTelemetry documentation
- **OpenTelemetry Expertise**: Pre-loaded with comprehensive OpenTelemetry documentation
- **Modern Web Interface**: Clean, responsive React-based chat interface
- **Source Attribution**: Shows which documents were used to generate responses with relevance scores
- **Cloud-Native Architecture**: Amazon OpenSearch Service for vector storage with k-NN search
- **Automated Infrastructure**: Pulumi-managed AWS deployment with automated Docker builds
- **Secure Configuration**: Pulumi ESC for secrets and configuration management

## 🏗️ Architecture

### AWS Cloud Architecture
```
┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   Internet   │────│   ALB (Port 80) │────│  ECS Fargate     │
│    Users     │    │                 │    │                  │
└──────────────┘    │  - Health Check │    │  - React + API   │
                    │  - /api/* →     │    │  - Single        │
                    │    Backend      │    │    Container     │
                    │  - /* →         │    │                  │
                    │    Frontend     │    └──────────────────┘
                    └─────────────────┘              │
                                                     │
                           ┌─────────────────────────┴───────────┐
                           │                                     │
                    ┌──────▼──────┐                    ┌────────▼────────┐
                    │  AWS Bedrock│                    │   OpenSearch    │
                    │  Claude 3.5 │                    │   (k-NN Index)  │
                    │   Sonnet    │                    │                 │
                    │  - IAM Role │                    │  - VPC Private  │
                    │    Auth     │                    │  - 1536 dims    │
                    └─────────────┘                    │  - HNSW algo    │
                                                       └─────────────────┘
                           │
                    ┌──────▼──────────┐
                    │  Pulumi ESC     │
                    │                 │
                    │  - Secrets      │
                    │  - Config       │
                    │  - AWS Creds    │
                    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Pulumi CLI installed
- Pulumi ESC environment configured with AWS credentials
- Docker installed (for automated container builds)
- AWS account with Bedrock access enabled
- Node.js 18+ (for running Pulumi TypeScript)

### AWS Deployment

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-workshop/pulumi
   ```

2. **Install Pulumi dependencies**
   ```bash
   npm install
   ```

3. **Initialize stack** (if needed)
   ```bash
   pulumi stack init dev
   pulumi config set aws:region us-east-1
   ```

4. **Set OpenSearch master password**
   ```bash
   pulumi config set --secret opensearchMasterPassword <strong-password>
   ```

5. **Deploy infrastructure** (automatically builds and pushes Docker image)
   ```bash
   pulumi env run <esc-environment> -i -- pulumi up
   ```

   **First deployment takes ~15-20 minutes** due to Docker build and OpenSearch domain creation.

6. **Ingest OpenTelemetry documentation to OpenSearch**
   ```bash
   cd ..
   export USE_OPENSEARCH=true
   export OPENSEARCH_ENDPOINT=$(cd pulumi && pulumi stack output opensearchEndpoint)
   export OPENSEARCH_USERNAME=admin
   export OPENSEARCH_PASSWORD=<your-opensearch-password>

   pulumi env run <esc-environment> -i -- node scripts/ingest-data.js
   ```

7. **Access the application**
   ```bash
   pulumi stack output albUrl
   ```

   Visit the URL to start chatting with the OpenTelemetry AI assistant!
## 📖 Usage

### Chat Interface

1. Open the web application in your browser
2. Ask questions about OpenTelemetry integration:
   - "How do I set up auto-instrumentation for Express?"
   - "What's the difference between manual and automatic instrumentation?"
   - "How can I create custom spans?"
   - "How can I instrument a React web application?"
   - "What are the best practices for OpenTelemetry context propagation?"

The chatbot uses RAG to retrieve relevant documentation and provides responses with source attribution and relevance scores.

### API Endpoints

Get your application URL:
```bash
cd pulumi
pulumi stack output albUrl
```

#### Chat API
- `POST /api/chat` - Send a chat message (uses AWS Bedrock)
  ```bash
  curl -X POST http://<your-alb-url>/api/chat \
    -H "Content-Type: application/json" \
    -d '{"message": "How do I instrument Express.js?"}'
  ```

- `GET /api/chat/context` - Retrieve context without generating response
- `GET /api/chat/providers` - List available providers (returns `['bedrock']`)
- `POST /api/chat/test-provider` - Test Bedrock provider connection
- `GET /api/health` - Health check endpoint

#### Admin API
- `POST /api/admin/ingest` - Add documents to knowledge base
  ```bash
  curl -X POST http://<your-alb-url>/api/admin/ingest \
    -H "Content-Type: application/json" \
    -d '{
      "title": "Custom OTel Guide",
      "content": "Your documentation...",
      "source": "internal-docs"
    }'
  ```

- `GET /api/admin/vector-store/info` - Get OpenSearch statistics
- `POST /api/admin/search` - Search documents directly
- `DELETE /api/admin/vector-store` - Reset knowledge base (use with caution)

## 🔧 Configuration

### Pulumi ESC for Secrets Management

This project uses **Pulumi ESC (Environments, Secrets, and Configuration)** for managing all secrets and configuration:

- **No `.env` files**: All secrets are managed through Pulumi ESC
- **Secure AWS access**: AWS credentials are injected via ESC environment
- **Environment-specific configs**: Different configurations for dev/staging/prod

To run commands with Pulumi ESC:
```bash
# General pattern
pulumi env run <esc-environment> -i -- <command>

# Example: List ECS services
pulumi env run honeycomb-pulumi-workshop/ws -i -- aws ecs list-services --cluster my-cluster

# Example: Run local development with ESC credentials
pulumi env run honeycomb-pulumi-workshop/ws -i -- npm run dev
```

The ESC environment name is specified in your `Pulumi.<stack>.yaml` file.

### Environment Variables (Managed by Pulumi ESC)

#### AWS Bedrock Configuration
| Variable | Description | Default |
|----------|-------------|---------|
| `AWS_REGION` | AWS region for Bedrock | us-east-1 |
| `BEDROCK_MODEL` | Bedrock model ID | anthropic.claude-3-5-sonnet-20240620-v1:0 |

In production, AWS credentials are provided automatically via IAM role (no keys needed).

#### Application Configuration
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment | production |
| `TEMPERATURE` | LLM temperature | 0.7 |
| `MAX_TOKENS` | Max response tokens | 2000 |

#### Vector Store Configuration (OpenSearch)
| Variable | Description | Default |
|----------|-------------|---------|
| `OPENSEARCH_ENDPOINT` | OpenSearch HTTPS endpoint | From Pulumi output |
| `OPENSEARCH_USERNAME` | OpenSearch user | admin |
| `OPENSEARCH_PASSWORD` | OpenSearch password | From Secrets Manager |
| `OPENSEARCH_INDEX` | Index name | otel_knowledge |

### Adding Custom Documentation

Add your own documentation to the knowledge base via the admin API:

```bash
curl -X POST http://<your-alb-url>/api/admin/ingest \
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
ai-workshop/
├── server/                      # Backend Express.js application
│   ├── config/                 # Configuration and logging
│   │   ├── index.js           # Centralized config with validation
│   │   └── logger.js          # Winston logger
│   ├── middleware/            # Express middleware
│   │   ├── auth.js           # Rate limiting, API key validation
│   │   └── validation.js     # Request validation
│   ├── routes/               # API route handlers
│   │   ├── chat.js          # Chat endpoints (Bedrock)
│   │   └── admin.js         # Admin/knowledge base management
│   ├── services/            # Business logic services
│   │   ├── llmProvider.js  # AWS Bedrock integration
│   │   ├── vectorStore.js  # OpenSearch integration
│   │   └── ragService.js   # RAG pipeline orchestration
│   └── index.js            # Server entry point
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/    # React components (Chat UI)
│   │   ├── services/      # API service layer (Axios)
│   │   └── App.js         # Main app component
│   └── public/            # Static assets
├── pulumi/                # Infrastructure as Code
│   ├── index.ts          # Main Pulumi program (~470 lines)
│   ├── package.json      # Pulumi dependencies
│   ├── AUTOMATED_BUILD.md # Docker build automation guide
│   └── README.md         # Deployment guide
├── scripts/              # Utility scripts
│   └── ingest-data.js   # Data ingestion for OTel docs
├── docs/                # Documentation
│   ├── AWS_DEPLOYMENT.md
│   └── OPENSEARCH_MIGRATION.md
├── Dockerfile           # Production container build
└── CLAUDE.md           # Claude Code project instructions
```

### Key Design Patterns

#### Service Initialization Order
The server follows a strict initialization sequence (server/index.js:36-59):
1. Configuration validation
2. Service initialization (LLM provider → Vector store)
3. Middleware setup
4. Route registration
5. Error handling

#### RAG Pipeline (LangChain RunnableSequence)
The RAG service uses a three-stage pipeline:
1. **Vector Search**: Query OpenSearch for relevant documents using k-NN search
2. **Context Formatting**: Format results with source and relevance score
3. **LLM Generation**: Send prompt + context to Bedrock → parse response

#### AWS Bedrock Integration
- Fixed to use Claude 3.5 Sonnet exclusively (anthropic.claude-3-5-sonnet-20240620-v1:0)
- Production: IAM role credentials (automatic, no keys needed)
- Uses Bedrock embeddings for vector search (1536 dimensions)

#### OpenSearch Vector Store
- Amazon OpenSearch Service with k-NN enabled
- HNSW algorithm for efficient similarity search
- Bulk indexing support for documentation ingestion
- Private subnet deployment for security

## ☁️ AWS Deployment with Pulumi

The `pulumi/` directory contains complete infrastructure-as-code for deploying to AWS.

### Automated Deployment Features

- **Automated Docker Builds**: Pulumi builds and pushes Docker images automatically to ECR
- **Single Container Architecture**: Both React frontend and Express API in one container
- **OpenSearch Vector Store**: Amazon OpenSearch Service with k-NN enabled for vector search
- **ECS Fargate**: Serverless container orchestration
- **Application Load Balancer**: Serves both frontend (on `/`) and backend API (on `/api/*`)
- **Pulumi ESC Integration**: All secrets and AWS credentials managed through ESC
- **IAM Role Authentication**: No hardcoded credentials in production

### Infrastructure Components

| Component | Description | Configuration |
|-----------|-------------|---------------|
| **ECR Repository** | Private container registry | Vulnerability scanning enabled |
| **Docker Image** | Automated build & push | Multi-stage build (Node.js 18) |
| **VPC** | Network isolation | 2 AZs, public/private subnets |
| **OpenSearch** | Vector database with k-NN | t3.small.search, 10GB storage |
| **ECS Fargate** | Container orchestration | 0.5 vCPU, 1GB memory |
| **ALB** | Load balancer | HTTP (port 80), health checks |
| **Secrets Manager** | API keys storage | OpenSearch password |
| **CloudWatch Logs** | Application logs | 7-day retention |

### Using Pulumi ESC in Deployment

```bash
# Deploy with Pulumi ESC credentials
pulumi env run honeycomb-pulumi-workshop/ws -i -- pulumi up

# Check ECS service status
pulumi env run honeycomb-pulumi-workshop/ws -i -- aws ecs list-services \
  --cluster $(pulumi stack output ecsClusterName) \
  --region us-east-1

# View ECS task logs
pulumi env run honeycomb-pulumi-workshop/ws -i -- aws logs tail \
  /aws/ecs/otel-ai-chatbot-logs \
  --follow

# Update ECS service (force new deployment)
pulumi env run honeycomb-pulumi-workshop/ws -i -- aws ecs update-service \
  --cluster $(pulumi stack output ecsClusterName) \
  --service $(pulumi stack output ecsServiceName) \
  --force-new-deployment
```

### OpenSearch Data Ingestion

After deployment, ingest OpenTelemetry documentation to OpenSearch:

```bash
# Set environment variables
export USE_OPENSEARCH=true
export OPENSEARCH_ENDPOINT=$(cd pulumi && pulumi stack output opensearchEndpoint)
export OPENSEARCH_USERNAME=admin
export OPENSEARCH_PASSWORD=<your-opensearch-password>

# Run ingestion script with Pulumi ESC
pulumi env run honeycomb-pulumi-workshop/ws -i -- node scripts/ingest-data.js
```

### Monitoring and Debugging

- **Application URL**: `pulumi stack output albUrl`
- **ECS Service**: `pulumi stack output ecsServiceName`
- **CloudWatch Logs**: `/aws/ecs/otel-ai-chatbot-logs`
- **Health Check**: `http://<alb-url>/api/health`
- **OpenSearch Dashboards**: Accessible via VPN/bastion (private subnet)

### Cost Estimation

| Service | Configuration | Estimated Monthly Cost |
|---------|--------------|----------------------|
| ECS Fargate | 0.5 vCPU, 1GB, 24/7 | ~$15 |
| OpenSearch | t3.small.search, 10GB | ~$40 |
| ALB | Basic usage | ~$18 |
| NAT Gateway | Single gateway | ~$32 |
| ECR | ~10 images | ~$0.30 |
| CloudWatch Logs | 7-day retention | ~$5 |
| **Total** | | **~$110/month** |

### Useful Pulumi Commands

```bash
# View all outputs
pulumi stack output

# Preview changes
pulumi up --diff

# Destroy infrastructure
pulumi destroy

# View logs
pulumi logs --follow

# Export stack state
pulumi stack export > backup.json
```

For detailed deployment instructions, see:
- `pulumi/README.md` - Comprehensive deployment guide
- `pulumi/AUTOMATED_BUILD.md` - Docker build automation details
- `docs/AWS_DEPLOYMENT.md` - Step-by-step deployment walkthrough

## 🛠️ Troubleshooting

### Common Issues

1. **Pulumi deployment fails**
   - Check Pulumi ESC environment is accessible:
     ```bash
     pulumi env run <esc-environment> -i -- aws sts get-caller-identity
     ```
   - Verify OpenSearch password is set: `pulumi config get opensearchMasterPassword`
   - Check Docker is running (required for automated builds)
   - Review Pulumi logs: `pulumi up --logtostderr -v=9`

2. **OpenSearch connection errors**
   - Verify OpenSearch domain is healthy in AWS Console
   - Check security group allows ECS tasks to access OpenSearch (port 443)
   - Verify credentials in Secrets Manager
   - OpenSearch domain creation takes 10-15 minutes on first deployment

3. **ECS tasks failing health checks**
   - Check CloudWatch Logs: `/aws/ecs/otel-ai-chatbot-logs`
   - Verify health endpoint responds: `curl http://<alb-url>/api/health`
   - Check environment variables in ECS task definition
   - Verify IAM role has Bedrock and OpenSearch permissions

4. **Docker build failures**
   - Ensure Dockerfile is at repository root
   - Check Docker daemon is running
   - Verify ECR repository exists and is accessible
   - Review build logs in Pulumi output
   - See `pulumi/AUTOMATED_BUILD.md` for troubleshooting

5. **Application returns 503/504 errors**
   - Check ECS service has running tasks: `aws ecs describe-services`
   - Verify target group health in ALB console
   - Check CloudWatch logs for application errors
   - Verify Bedrock model access in your AWS region

### Useful Diagnostic Commands

```bash
# Check Pulumi ESC environment
pulumi env run <esc-environment> -i -- env | grep AWS

# Get application URL
cd pulumi && pulumi stack output albUrl

# Check application health
curl http://<alb-url>/api/health
curl http://<alb-url>/api/chat/providers

# View ECS task logs
pulumi env run <esc-environment> -i -- aws logs tail \
  /aws/ecs/otel-ai-chatbot-logs --follow

# Check OpenSearch cluster health
curl -u admin:<password> https://<opensearch-endpoint>/_cluster/health

# Get OpenSearch statistics via API
curl http://<alb-url>/api/admin/vector-store/info

# Test Bedrock access
pulumi env run <esc-environment> -i -- aws bedrock-runtime invoke-model \
  --model-id anthropic.claude-3-5-sonnet-20240620-v1:0 \
  --body '{"anthropic_version":"bedrock-2023-05-31","messages":[{"role":"user","content":"Hello"}],"max_tokens":100}' \
  output.json

# Check ECS service status
pulumi env run <esc-environment> -i -- aws ecs describe-services \
  --cluster $(cd pulumi && pulumi stack output ecsClusterName) \
  --services $(cd pulumi && pulumi stack output ecsServiceName)
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the existing code style
4. Add tests if applicable
5. Ensure all tests pass (`npm test`)
6. Update documentation as needed
7. Commit your changes (`git commit -m 'Add amazing feature'`)
8. Push to the branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

### Development Guidelines

- Use ES6 modules (`import`/`export`)
- Follow the existing service initialization order
- Use Winston logger for all logging
- Add JSDoc comments for new functions
- Update CLAUDE.md for architectural changes
- Test changes in a dev/staging stack before production
- Use Pulumi preview to review infrastructure changes

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- **OpenTelemetry Community** for comprehensive documentation and best practices
- **AWS Bedrock** for providing Claude 3.5 Sonnet API access
- **LangChain** for the excellent RAG framework and LLM orchestration
- **Pulumi** for infrastructure-as-code and secrets management (ESC)
- **Amazon OpenSearch** for vector database with k-NN search capabilities

## 📚 Additional Resources

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [LangChain Documentation](https://js.langchain.com/docs/)
- [Pulumi Documentation](https://www.pulumi.com/docs/)
- [Pulumi ESC Documentation](https://www.pulumi.com/docs/pulumi-cloud/esc/)
- [Amazon OpenSearch Documentation](https://docs.aws.amazon.com/opensearch-service/)
- [Amazon ECS Documentation](https://docs.aws.amazon.com/ecs/)

## 🆘 Support

- **Issues**: Report bugs or request features via [GitHub Issues](https://github.com/your-repo/issues)
- **Documentation**: Check the `docs/` directory for detailed guides
- **Examples**: See example queries and use cases in the chat interface

---

**Ready to get started?** Deploy to AWS with `pulumi up` and ask the chatbot about OpenTelemetry! 🚀

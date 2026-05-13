import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as dockerBuild from "@pulumi/docker-build";
import * as fs from "fs";
import {execSync} from "child_process";

// ADOT collector config — kept as a separate YAML file to avoid escaping pain
const collectorConfigYaml = fs.readFileSync("collector-config.yaml", "utf-8");

// Capture the short git SHA at deploy time so the running container can advertise
// its source revision on every span via `service.version`. Falls back to "unknown"
// outside a git checkout (e.g. zipped workshop materials).
const gitSha = (() => {
    try {
        return execSync("git rev-parse --short HEAD", {encoding: "utf-8"}).trim();
    } catch {
        return "unknown";
    }
})();

// Configuration
const config = new pulumi.Config();
const appName = "otel-ai-chatbot";
const environment = pulumi.getStack();

// Map stack name to NODE_ENV value
// dev → development, prod/production → production, default → production
const nodeEnv = environment === "dev" ? "development" : "production";

// Tags for all resources
const tags = {
    Environment: environment,
    Project: appName,
    ManagedBy: "Pulumi",
};

// =============================================================================
// ECR Repository and Docker Image
// =============================================================================

// Create ECR repository for application container (serves both frontend and backend)
const ecrRepository = new aws.ecr.Repository(`${appName}-app`, {
    name: `${appName}-app`,
    imageTagMutability: "MUTABLE",
    imageScanningConfiguration: {
        scanOnPush: true, // Enable vulnerability scanning
    },
    encryptionConfigurations: [{
        encryptionType: "AES256", // Server-side encryption
    }],
    forceDelete: true, // Allow deletion even with images (use cautiously in production)
    tags: tags,
});

// Create lifecycle policy to clean up old images
const lifecyclePolicy = new aws.ecr.LifecyclePolicy(`${appName}-lifecycle`, {
    repository: ecrRepository.name,
    policy: JSON.stringify({
        rules: [{
            rulePriority: 1,
            description: "Keep last 10 images",
            selection: {
                tagStatus: "any",
                countType: "imageCountMoreThan",
                countNumber: 10,
            },
            action: {
                type: "expire",
            },
        }],
    }),
});

// Get ECR authorization token
const authToken = aws.ecr.getAuthorizationTokenOutput({
    registryId: ecrRepository.registryId,
});

// Build and push Docker image
const image = new dockerBuild.Image(`${appName}-image`, {
    tags: [pulumi.interpolate`${ecrRepository.repositoryUrl}:${environment}`],
    push: true,
    context: {
        location: "../",
    },
    dockerfile: {
        location: "../Dockerfile",
    },
    platforms: ["linux/arm64"],
    buildArgs: {
        NODE_ENV: "production",
    },
    registries: [{
        address: ecrRepository.repositoryUrl,
        username: authToken.userName,
        password: authToken.password,
    }],
}, {dependsOn: [ecrRepository]});

// =============================================================================
// VPC and Networking
// =============================================================================

const vpc = new awsx.ec2.Vpc(`${appName}-vpc`, {
    cidrBlock: "10.0.0.0/16",
    numberOfAvailabilityZones: 2,
    natGateways: {
        strategy: "Single", // Use single NAT gateway to reduce costs
    },
    tags: tags,
});

// =============================================================================
// Security Groups
// =============================================================================

// ALB Security Group
const albSecurityGroup = new aws.ec2.SecurityGroup(`${appName}-alb-sg`, {
    vpcId: vpc.vpcId,
    description: "Security group for Application Load Balancer",
    ingress: [
        {
            protocol: "tcp",
            fromPort: 80,
            toPort: 80,
            cidrBlocks: ["0.0.0.0/0"],
            description: "Allow HTTP from anywhere",
        },
        {
            protocol: "tcp",
            fromPort: 443,
            toPort: 443,
            cidrBlocks: ["0.0.0.0/0"],
            description: "Allow HTTPS from anywhere",
        },
    ],
    egress: [{
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"],
        description: "Allow all outbound traffic",
    }],
    tags: {...tags, Name: `${appName}-alb-sg`},
});

// ECS Tasks Security Group
const ecsSecurityGroup = new aws.ec2.SecurityGroup(`${appName}-ecs-sg`, {
    vpcId: vpc.vpcId,
    description: "Security group for ECS tasks",
    ingress: [
        {
            protocol: "tcp",
            fromPort: 3001,
            toPort: 3001,
            securityGroups: [albSecurityGroup.id],
            description: "Allow traffic from ALB to application",
        },
    ],
    egress: [{
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"],
        description: "Allow all outbound traffic",
    }],
    tags: {...tags, Name: `${appName}-ecs-sg`},
});

// =============================================================================
// IAM Roles
// =============================================================================

// ECS Task Execution Role
const ecsTaskExecutionRole = new aws.iam.Role(`${appName}-ecs-execution-role`, {
    assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Principal: {Service: "ecs-tasks.amazonaws.com"},
            Action: "sts:AssumeRole",
        }],
    }),
    tags: tags,
});

new aws.iam.RolePolicyAttachment(`${appName}-ecs-execution-policy`, {
    role: ecsTaskExecutionRole.name,
    policyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
});

// ECS Task Role (for application permissions)
const ecsTaskRole = new aws.iam.Role(`${appName}-ecs-task-role`, {
    assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Principal: {Service: "ecs-tasks.amazonaws.com"},
            Action: "sts:AssumeRole",
        }],
    }),
    tags: tags,
});

// =============================================================================
// Secrets Manager
// =============================================================================

// Create secrets for API keys
const secretsManagerSecret = new aws.secretsmanager.Secret(`${appName}-secrets`, {
    description: "API keys and configuration for OpenTelemetry AI Chatbot",
    tags: tags,
});

// Honeycomb API key only — OpenSearch Serverless uses SigV4 (IAM), no password to store.
// Bedrock also uses IAM role for authentication.
const secretVersion = new aws.secretsmanager.SecretVersion(`${appName}-secrets-version`, {
    secretId: secretsManagerSecret.id,
    secretString: config.requireSecret("honeycombApiKey").apply(honeycombApiKey => JSON.stringify({
        HONEYCOMB_API_KEY: honeycombApiKey,
        OTEL_EXPORTER_OTLP_HEADERS: `x-honeycomb-team=${honeycombApiKey}`,
    })),
});

// Grant ECS task access to secrets
const secretsPolicy = new aws.iam.RolePolicy(`${appName}-secrets-policy`, {
    role: ecsTaskExecutionRole.id,
    policy: secretsManagerSecret.arn.apply(arn => JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Action: [
                "secretsmanager:GetSecretValue",
                "secretsmanager:DescribeSecret",
            ],
            Resource: arn,
        }],
    })),
});

// =============================================================================
// OpenSearch Serverless (Vector Search)
// =============================================================================
//
// Serverless provisions in ~1-3 minutes vs ~15-60 for managed domains.
// Auth is SigV4-only via IAM data access policies (no master user/password).
// Public network access keeps the workshop simple; lock down via VPC endpoint
// (AWS::OpenSearchServerless::VpcEndpoint) in production.

const collectionName = `${appName}-${environment}`;

// Encryption policy — required. Use AWS-owned key for workshop simplicity.
const encryptionPolicy = new aws.opensearch.ServerlessSecurityPolicy(`${appName}-aoss-encryption`, {
    name: `${appName}-${environment}-enc`,
    type: "encryption",
    policy: JSON.stringify({
        Rules: [{
            ResourceType: "collection",
            Resource: [`collection/${collectionName}`],
        }],
        AWSOwnedKey: true,
    }),
});

// Network policy — public access for the collection's data plane and dashboards.
const networkPolicy = new aws.opensearch.ServerlessSecurityPolicy(`${appName}-aoss-network`, {
    name: `${appName}-${environment}-net`,
    type: "network",
    policy: JSON.stringify([{
        Rules: [
            {ResourceType: "collection", Resource: [`collection/${collectionName}`]},
            {ResourceType: "dashboard", Resource: [`collection/${collectionName}`]},
        ],
        AllowFromPublic: true,
    }]),
});

// Data access policy — grant the ECS task role (and the deploying principal,
// for ingestion via scripts/) full vector/index/document permissions.
const dataAccessPolicy = new aws.opensearch.ServerlessAccessPolicy(`${appName}-aoss-data`, {
    name: `${appName}-${environment}-data`,
    type: "data",
    policy: pulumi.all([ecsTaskRole.arn, aws.getCallerIdentityOutput().arn]).apply(
        ([taskRoleArn, callerArn]) => JSON.stringify([{
            Rules: [
                {
                    ResourceType: "collection",
                    Resource: [`collection/${collectionName}`],
                    Permission: [
                        "aoss:CreateCollectionItems",
                        "aoss:DeleteCollectionItems",
                        "aoss:UpdateCollectionItems",
                        "aoss:DescribeCollectionItems",
                    ],
                },
                {
                    ResourceType: "index",
                    Resource: [`index/${collectionName}/*`],
                    Permission: [
                        "aoss:CreateIndex",
                        "aoss:DeleteIndex",
                        "aoss:UpdateIndex",
                        "aoss:DescribeIndex",
                        "aoss:ReadDocument",
                        "aoss:WriteDocument",
                    ],
                },
            ],
            Principal: [taskRoleArn, callerArn],
        }]),
    ),
});

const openSearchCollection = new aws.opensearch.ServerlessCollection(`${appName}-aoss`, {
    name: collectionName,
    type: "VECTORSEARCH",
    description: "Vector search for OpenTelemetry docs RAG",
    tags: tags,
}, {dependsOn: [encryptionPolicy, networkPolicy, dataAccessPolicy]});

// Data-plane IAM permission — the access policy authorises *what* the principal
// can do; this IAM permission authorises the principal to call the data plane
// at all. Both are required.
const openSearchPolicy = new aws.iam.RolePolicy(`${appName}-aoss-policy`, {
    role: ecsTaskRole.id,
    policy: openSearchCollection.arn.apply(arn => JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Action: ["aoss:APIAccessAll"],
            Resource: arn,
        }],
    })),
});

// Grant ECS task access to AWS Bedrock for Claude models and Titan Embeddings
const bedrockPolicy = new aws.iam.RolePolicy(`${appName}-bedrock-policy`, {
    role: ecsTaskRole.id,
    policy: pulumi.interpolate`{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "bedrock:InvokeModel",
                    "bedrock:InvokeModelWithResponseStream"
                ],
                "Resource": [
                    "arn:aws:bedrock:*::foundation-model/*",
                    "arn:aws:bedrock:*:${aws.getCallerIdentityOutput().accountId}:inference-profile/*"
                ]
            },
            {
                "Effect": "Allow",
                "Action": [
                    "aws-marketplace:ViewSubscriptions",
                    "aws-marketplace:Subscribe"
                ],
                "Resource": "*"
            }
        ]
    }`,
});

// Grant ECS task access to AWS X-Ray (used by ADOT collector sidecar for SigV4 auth)
const xrayPolicy = new aws.iam.RolePolicy(`${appName}-xray-policy`, {
    role: ecsTaskRole.id,
    policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Action: [
                "xray:PutTraceSegments",
                "xray:PutTelemetryRecords",
                "xray:GetSamplingRules",
                "xray:GetSamplingTargets",
            ],
            Resource: "*",
        }],
    }),
});

// =============================================================================
// Application Load Balancer
// =============================================================================

const alb = new aws.lb.LoadBalancer(`${appName}-alb`, {
    loadBalancerType: "application",
    subnets: vpc.publicSubnetIds,
    securityGroups: [albSecurityGroup.id],
    tags: tags,
});

const targetGroup = new aws.lb.TargetGroup(`${appName}-tg`, {
    port: 3001,
    protocol: "HTTP",
    targetType: "ip",
    vpcId: vpc.vpcId,
    healthCheck: {
        enabled: true,
        path: "/api/health",
        healthyThreshold: 2,
        unhealthyThreshold: 3,
        timeout: 5,
        interval: 30,
        matcher: "200",
    },
    tags: tags,
});

const listener = new aws.lb.Listener(`${appName}-listener`, {
    loadBalancerArn: alb.arn,
    port: 80,
    protocol: "HTTP",
    defaultActions: [{
        type: "forward",
        targetGroupArn: targetGroup.arn,
    }],
    tags: tags,
});

// =============================================================================
// ECS Cluster and Service
// =============================================================================

const cluster = new aws.ecs.Cluster(`${appName}-cluster`, {
    settings: [{
        name: "containerInsights",
        value: "enabled",
    }],
    tags: tags,
});

// CloudWatch Log Group for ECS tasks
const logGroup = new aws.cloudwatch.LogGroup(`${appName}-logs`, {
    retentionInDays: 7,
    tags: tags,
});

// ECS Task Definition
const taskDefinition = new aws.ecs.TaskDefinition(`${appName}-task`, {
    family: `${appName}-app`,
    cpu: "1024",
    memory: "2048",
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    runtimePlatform: {
        cpuArchitecture: "ARM64",
        operatingSystemFamily: "LINUX",
    },
    executionRoleArn: ecsTaskExecutionRole.arn,
    taskRoleArn: ecsTaskRole.arn,
    containerDefinitions: pulumi.all([
        logGroup.name,
        openSearchCollection.collectionEndpoint,
        secretsManagerSecret.arn,
        image.ref,
        image.digest,
        ecrRepository.repositoryUrl,
        aws.getRegionOutput().name,
    ]).apply(([logGroupName, opensearchEndpoint, secretArn, imageDigest, imageSha, imageName, awsRegion]) => JSON.stringify([
        // Application container — sends OTLP to the ADOT collector sidecar at localhost:4318
        {
            name: "app",
            image: imageDigest, // Use the built and pushed Docker image
            essential: true,
            portMappings: [{
                containerPort: 3001,
                protocol: "tcp",
            }],
            environment: [
                {name: "PORT", value: "3001"},
                {name: "NODE_ENV", value: nodeEnv},
                {name: "LOG_LEVEL", value: "debug"}, // Set to "debug" for verbose logging, "info" for production
                {name: "DEFAULT_LLM_PROVIDER", value: "bedrock"},
                {name: "BEDROCK_MODEL", value: "us.anthropic.claude-haiku-4-5-20251001-v1:0"},
                // OpenSearch Serverless: SigV4-only, no username/password.
                {name: "OPENSEARCH_ENDPOINT", value: opensearchEndpoint},
                {name: "OPENSEARCH_INDEX", value: "otel_knowledge"},
                {name: "OPENSEARCH_SERVICE", value: "aoss"},
                {name: "AWS_REGION", value: awsRegion},
                // Honeycomb + X-Ray dual-send via ADOT collector sidecar
                {name: "HONEYCOMB_DATASET", value: `${appName}-${environment}`},
                {name: "OTEL_SERVICE_NAME", value: `${appName}-backend`},
                // OTLP goes to the local ADOT collector, which fans out to Honeycomb + X-Ray
                {name: "OTEL_EXPORTER_OTLP_ENDPOINT", value: "http://localhost:4318"},
                {name: "OTEL_EXPORTER_OTLP_PROTOCOL", value: "http/protobuf"},
                // Enable OpenTelemetry GenAI Semantic Conventions v1.0 (stable)
                {name: "OTEL_SEMCONV_STABILITY_OPT_IN", value: "gen_ai"},
                // Build identity — surfaces on every span via `service.version` and
                // `container.image.*` so we can correlate observed behaviour with the
                // artifact actually running. See server/config/tracing.js.
                {name: "SERVICE_VERSION", value: gitSha},
                {name: "CONTAINER_IMAGE_NAME", value: imageName},
                {name: "CONTAINER_IMAGE_TAG", value: environment},
                {name: "CONTAINER_IMAGE_ID", value: imageSha},
            ],
            // App container holds no Honeycomb secret — the ADOT collector owns the egress auth.
            secrets: [],
            logConfiguration: {
                logDriver: "awslogs",
                options: {
                    "awslogs-group": logGroupName,
                    "awslogs-region": awsRegion,
                    "awslogs-stream-prefix": "app",
                },
            },
        },
        // ADOT (AWS Distro for OpenTelemetry) collector sidecar
        // Receives OTLP from the app and exports to Honeycomb + X-Ray
        {
            name: "adot-collector",
            image: "public.ecr.aws/aws-observability/aws-otel-collector:latest",
            essential: false, // Don't kill the task if collector crashes (workshop setting)
            portMappings: [
                {containerPort: 4317, protocol: "tcp"},
                {containerPort: 4318, protocol: "tcp"},
                {containerPort: 13133, protocol: "tcp"},
            ],
            environment: [
                {name: "AOT_CONFIG_CONTENT", value: collectorConfigYaml},
            ],
            secrets: [
                {
                    name: "HONEYCOMB_API_KEY",
                    valueFrom: `${secretArn}:HONEYCOMB_API_KEY::`,
                },
            ],
            healthCheck: {
                command: ["CMD", "/healthcheck"],
                interval: 30,
                timeout: 5,
                retries: 3,
                startPeriod: 15,
            },
            logConfiguration: {
                logDriver: "awslogs",
                options: {
                    "awslogs-group": logGroupName,
                    "awslogs-region": awsRegion,
                    "awslogs-stream-prefix": "adot",
                },
            },
        },
    ])),
    tags: tags,
});

// ECS Service
const service = new aws.ecs.Service(`${appName}-service`, {
    cluster: cluster.arn,
    taskDefinition: taskDefinition.arn,
    desiredCount: 1,
    launchType: "FARGATE",
    networkConfiguration: {
        subnets: vpc.privateSubnetIds,
        securityGroups: [ecsSecurityGroup.id],
        assignPublicIp: false,
    },
    loadBalancers: [{
        targetGroupArn: targetGroup.arn,
        containerName: "app",
        containerPort: 3001,
    }],
    tags: tags,
}, {dependsOn: [listener]});

// =============================================================================
// CloudWatch Metric Streams to Honeycomb
// =============================================================================

// Create IAM role for Firehose to write to Honeycomb
const firehoseRole = new aws.iam.Role(`${appName}-firehose-role`, {
    assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Principal: {Service: "firehose.amazonaws.com"},
            Action: "sts:AssumeRole",
        }],
    }),
    tags: tags,
});

// Create S3 bucket for failed delivery backup
const firehoseBackupBucket = new aws.s3.Bucket(`${appName}-firehose-backup`, {
    forceDestroy: true,
    tags: tags,
});

// Grant Firehose permissions to write to S3 backup bucket
const firehoseS3Policy = new aws.iam.RolePolicy(`${appName}-firehose-s3-policy`, {
    role: firehoseRole.id,
    policy: firehoseBackupBucket.arn.apply(bucketArn => JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Action: [
                "s3:AbortMultipartUpload",
                "s3:GetBucketLocation",
                "s3:GetObject",
                "s3:ListBucket",
                "s3:ListBucketMultipartUploads",
                "s3:PutObject",
            ],
            Resource: [
                bucketArn,
                `${bucketArn}/*`,
            ],
        }],
    })),
});

// Create Kinesis Firehose delivery stream to Honeycomb
const firehoseDeliveryStream = new aws.kinesis.FirehoseDeliveryStream(`${appName}-metrics-stream`, {
    name: `${appName}-metrics-to-honeycomb`,
    destination: "http_endpoint",
    httpEndpointConfiguration: {
        url: pulumi.interpolate`https://api.honeycomb.io/1/kinesis_events/${appName}-${environment}`,
        name: "Honeycomb",
        accessKey: config.requireSecret("honeycombApiKey"),
        roleArn: firehoseRole.arn,
        s3BackupMode: "FailedDataOnly",
        s3Configuration: {
            roleArn: firehoseRole.arn,
            bucketArn: firehoseBackupBucket.arn,
            compressionFormat: "GZIP",
        },
        requestConfiguration: {
            contentEncoding: "GZIP",
        },
        bufferingInterval: 60,
        bufferingSize: 1,
    },
    tags: tags,
}, {dependsOn: [firehoseS3Policy]});

// Create IAM role for CloudWatch to write to Firehose
const metricStreamRole = new aws.iam.Role(`${appName}-metric-stream-role`, {
    assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Principal: {Service: "streams.metrics.cloudwatch.amazonaws.com"},
            Action: "sts:AssumeRole",
        }],
    }),
    tags: tags,
});

// Grant CloudWatch Metric Stream permission to write to Firehose
const metricStreamPolicy = new aws.iam.RolePolicy(`${appName}-metric-stream-policy`, {
    role: metricStreamRole.id,
    policy: firehoseDeliveryStream.arn.apply(firehoseArn => JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Action: [
                "firehose:PutRecord",
                "firehose:PutRecordBatch",
            ],
            Resource: firehoseArn,
        }],
    })),
});

// Create CloudWatch Metric Stream to send infrastructure metrics to Honeycomb.
// Namespaces chosen to give Module 3 of the workshop enough surface for the
// "find the bottleneck" queries: ECS for the app side, ALB for traffic + tail
// latency, AOSS for vector-store throughput/OCU, Bedrock for LLM cost/latency,
// NAT for egress (relevant to the no-VPC-endpoint-for-Bedrock breakage story).
const metricStream = new aws.cloudwatch.MetricStream(`${appName}-metric-stream`, {
    name: `${appName}-infra-metrics`,
    roleArn: metricStreamRole.arn,
    firehoseArn: firehoseDeliveryStream.arn,
    outputFormat: "opentelemetry1.0", // Use OpenTelemetry format for Honeycomb compatibility
    includeFilters: [
        // ECS task + container metrics
        {namespace: "AWS/ECS", metricNames: []},
        {namespace: "ECS/ContainerInsights", metricNames: []},
        // ALB: RequestCount, TargetResponseTime, HTTPCode_Target_*, HealthyHostCount
        {namespace: "AWS/ApplicationELB", metricNames: []},
        // OpenSearch Serverless: OCU usage, search/index counts, latency
        {namespace: "AWS/AOSS", metricNames: []},
        // Bedrock: InvocationLatency, Invocations, InputTokenCount, OutputTokenCount
        // (the headline GenAI-observability namespace)
        {namespace: "AWS/Bedrock", metricNames: []},
        // NAT Gateway: BytesOut/In — relevant to the "no VPC endpoint for Bedrock"
        // cost-story breakage; egress to Bedrock will pile up here.
        {namespace: "AWS/NATGateway", metricNames: []},
    ],
    tags: tags,
}, {dependsOn: [metricStreamPolicy]});

// =============================================================================
// Load Generator (Fargate Spot, burst 5 rps × 5 min / idle 5 min)
// =============================================================================
//
// Continuously exercises /api/chat with curated OpenTelemetry prompts so
// Module 3 (Honeycomb queries) has enough volume for meaningful P95/P99/BubbleUp
// distributions. Cheap to run because Haiku 4.5 is ~5x cheaper per token than
// Sonnet 3.5; cycles between bursts and idle to make autoscaling/BubbleUp
// stories more interesting.

const loadgenEcr = new aws.ecr.Repository(`${appName}-loadgen`, {
    name: `${appName}-loadgen`,
    imageTagMutability: "MUTABLE",
    imageScanningConfiguration: {scanOnPush: true},
    encryptionConfigurations: [{encryptionType: "AES256"}],
    forceDelete: true,
    tags: tags,
});

new aws.ecr.LifecyclePolicy(`${appName}-loadgen-lifecycle`, {
    repository: loadgenEcr.name,
    policy: JSON.stringify({
        rules: [{
            rulePriority: 1,
            description: "Keep last 5 images",
            selection: {tagStatus: "any", countType: "imageCountMoreThan", countNumber: 5},
            action: {type: "expire"},
        }],
    }),
});

const loadgenImage = new dockerBuild.Image(`${appName}-loadgen-image`, {
    tags: [pulumi.interpolate`${loadgenEcr.repositoryUrl}:${environment}`],
    push: true,
    context: {location: "../loadgen"},
    dockerfile: {location: "../loadgen/Dockerfile"},
    platforms: ["linux/arm64"],
    registries: [{
        address: loadgenEcr.repositoryUrl,
        username: authToken.userName,
        password: authToken.password,
    }],
}, {dependsOn: [loadgenEcr]});

// Loadgen task role — no AWS perms needed beyond the standard execution role.
const loadgenTaskRole = new aws.iam.Role(`${appName}-loadgen-task-role`, {
    assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Principal: {Service: "ecs-tasks.amazonaws.com"},
            Action: "sts:AssumeRole",
        }],
    }),
    tags: tags,
});

const loadgenLogGroup = new aws.cloudwatch.LogGroup(`${appName}-loadgen-logs`, {
    retentionInDays: 7,
    tags: tags,
});

const loadgenTaskDefinition = new aws.ecs.TaskDefinition(`${appName}-loadgen-task`, {
    family: `${appName}-loadgen`,
    cpu: "256",     // 0.25 vCPU
    memory: "512",  // 0.5 GB
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    runtimePlatform: {cpuArchitecture: "ARM64", operatingSystemFamily: "LINUX"},
    executionRoleArn: ecsTaskExecutionRole.arn,
    taskRoleArn: loadgenTaskRole.arn,
    containerDefinitions: pulumi.all([
        loadgenLogGroup.name,
        loadgenImage.ref,
        alb.dnsName,
        aws.getRegionOutput().name,
    ]).apply(([logGroupName, imageDigest, albDns, awsRegion]) => JSON.stringify([{
        name: "loadgen",
        image: imageDigest,
        essential: true,
        environment: [
            {name: "TARGET_URL", value: `http://${albDns}`},
            {name: "BURST_RPS", value: "5"},
            {name: "BURST_MIN", value: "5"},
            {name: "IDLE_MIN", value: "5"},
            {name: "USER_POOL_SIZE", value: "50"},
        ],
        logConfiguration: {
            logDriver: "awslogs",
            options: {
                "awslogs-group": logGroupName,
                "awslogs-region": awsRegion,
                "awslogs-stream-prefix": "loadgen",
            },
        },
    }])),
    tags: tags,
});

// Loadgen security group — outbound to the ALB SG only.
const loadgenSecurityGroup = new aws.ec2.SecurityGroup(`${appName}-loadgen-sg`, {
    vpcId: vpc.vpcId,
    description: "Security group for load generator",
    egress: [{
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"],
        description: "Allow all outbound (ALB + ECR + CloudWatch Logs)",
    }],
    tags: {...tags, Name: `${appName}-loadgen-sg`},
});

new aws.ecs.Service(`${appName}-loadgen-service`, {
    cluster: cluster.id,
    taskDefinition: loadgenTaskDefinition.arn,
    desiredCount: 1,
    launchType: "FARGATE",
    networkConfiguration: {
        subnets: vpc.privateSubnetIds,
        securityGroups: [loadgenSecurityGroup.id],
        assignPublicIp: false,
    },
    // No load balancer — fire-and-forget worker.
    deploymentMinimumHealthyPercent: 0,
    deploymentMaximumPercent: 100,
    tags: tags,
}, {dependsOn: [listener]});

// =============================================================================
// Outputs
// =============================================================================

// Container Registry
export const ecrRepositoryUrl = ecrRepository.repositoryUrl;
export const ecrRepositoryName = ecrRepository.name;
export const containerImageDigest = image.ref;
export const loadgenEcrRepositoryUrl = loadgenEcr.repositoryUrl;
export const loadgenImageDigest = loadgenImage.ref;
export const loadgenLogGroupName = loadgenLogGroup.name;



// Infrastructure
export const vpcId = vpc.vpcId;
export const albDnsName = alb.dnsName;
export const albUrl = pulumi.interpolate`http://${alb.dnsName}`; // ALB serves both frontend and backend
export const opensearchEndpoint = openSearchCollection.collectionEndpoint;
export const opensearchDashboard = openSearchCollection.dashboardEndpoint;
export const opensearchCollectionArn = openSearchCollection.arn;
export const ecsClusterName = cluster.name;
export const secretsManagerSecretArn = secretsManagerSecret.arn;

// Useful commands (optional - automated builds handle Docker)
export const ecrLoginCommand = pulumi.interpolate`aws ecr get-login-password --region ${aws.getRegionOutput().name} | docker login --username AWS --password-stdin ${ecrRepository.repositoryUrl}`;
export const dockerBuildCommand = pulumi.interpolate`docker build -t ${ecrRepository.repositoryUrl}:latest ../ && docker push ${ecrRepository.repositoryUrl}:latest`;

// ECS Task Definition
export const ecsTaskDefinitionArn = taskDefinition.arn;

// Observability
export const metricStreamName = metricStream.name;
export const firehoseStreamName = firehoseDeliveryStream.name;

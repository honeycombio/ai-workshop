import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Document } from '@langchain/core/documents';
import dotenv from 'dotenv';

// Import our services
import vectorStore from '../server/services/vectorStore.js';
import logger from '../server/config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

class HoneycombPulumiIngestionService {
  constructor() {
    this.honeycombDocuments = [
      {
        title: 'Honeycomb Pulumi Provider - Getting Started',
        content: `# Honeycomb Pulumi Provider - Getting Started

## Overview
The Honeycomb Pulumi provider enables you to manage Honeycomb infrastructure as code. Honeycomb provides observability for high-performance engineering teams so they can quickly understand what their code does in complex cloud environments.

## Installation

### Package Installation
The provider must be installed as a local package using:

\`\`\`bash
pulumi package add terraform-provider honeycombio/honeycombio
\`\`\`

### NPM Package
For TypeScript/JavaScript projects:

\`\`\`bash
npm install @pulumi/honeycombio
\`\`\`

## Provider Configuration

### Basic Configuration
At minimum, either an API key or the API key ID/secret pair is required.

\`\`\`typescript
import * as pulumi from "@pulumi/pulumi";
import * as honeycombio from "@pulumi/honeycombio";

const config = new pulumi.Config();

// Option 1: Using API Key (v1 APIs - Configuration Keys)
const provider = new honeycombio.Provider("honeycomb", {
    apiKey: config.requireSecret("honeycombApiKey"),
});

// Option 2: Using Management API credentials (v2 APIs)
const provider = new honeycombio.Provider("honeycomb", {
    apiKeyId: config.require("honeycombApiKeyId"),
    apiKeySecret: config.requireSecret("honeycombApiKeySecret"),
});
\`\`\`

### EU Configuration
EU customers must override the API host:

\`\`\`typescript
const provider = new honeycombio.Provider("honeycomb", {
    apiKey: config.requireSecret("honeycombApiKey"),
    apiUrl: "https://api.eu1.honeycomb.io",
});
\`\`\`

### Debug Mode
Enable additional logging for troubleshooting:

\`\`\`typescript
const provider = new honeycombio.Provider("honeycomb", {
    apiKey: config.requireSecret("honeycombApiKey"),
    debug: true,
});
\`\`\`

## Important Notes

### Dataset Slugs
Resources accepting \`dataset\` arguments require **dataset slugs** (found in URLs or API responses), not dataset names or IDs. This affects:
- Queries
- Triggers
- SLOs
- Markers
- Columns
- Boards

### Provider Version
The current version is 0.42.0 (published October 10, 2025).

### Based on Terraform
This provider is dynamically bridged from the Honeycomb Terraform provider using the Pulumi Terraform Bridge.
`,
        source: 'honeycomb-pulumi-getting-started',
        metadata: {
          search: 'all',
          type: 'getting-started',
          provider: 'honeycomb',
          language: 'typescript',
          concept: 'pulumi-infrastructure-as-code'
        }
      },
      {
        title: 'Honeycomb Pulumi Provider - Core Resources',
        content: `# Honeycomb Pulumi Provider - Core Resources

## Dataset Management

### Creating a Dataset
\`\`\`typescript
import * as honeycombio from "@pulumi/honeycombio";

const dataset = new honeycombio.Dataset("my-service-dataset", {
    name: "my-service",
    description: "Traces and metrics for my service",
});

export const datasetName = dataset.name;
export const datasetSlug = dataset.slug;
\`\`\`

## Markers

### Creating a Marker
Markers help you annotate your data with deployment or event information.

\`\`\`typescript
import * as pulumi from "@pulumi/pulumi";
import * as honeycombio from "@pulumi/honeycombio";

const config = new pulumi.Config();
const dataset = config.require("dataset");

const deploymentMarker = new honeycombio.Marker("deployment", {
    message: "Deployed version 2.3.4 to production",
    dataset: dataset,
    type: "deploy",
    url: "https://github.com/myorg/myrepo/releases/tag/v2.3.4",
});

export const markerId = deploymentMarker.id;
\`\`\`

### Marker with Custom Time
\`\`\`typescript
const marker = new honeycombio.Marker("incident-start", {
    message: "Database connection pool exhausted",
    dataset: dataset,
    type: "incident",
    startTime: new Date("2025-01-15T10:30:00Z").toISOString(),
});
\`\`\`

## API Keys

### Creating an API Key
\`\`\`typescript
const apiKey = new honeycombio.ApiKey("ci-pipeline-key", {
    name: "CI Pipeline Key",
    permissions: {
        createDatasets: false,
        manageQueryHistory: true,
        sendEvents: true,
    },
});

export const apiKeyValue = apiKey.secret;
\`\`\`

## Queries

### Creating a Query
\`\`\`typescript
const latencyQuery = new honeycombio.Query("p99-latency", {
    dataset: dataset,
    queryJson: JSON.stringify({
        calculations: [
            {
                op: "P99",
                column: "duration_ms"
            }
        ],
        filters: [
            {
                column: "http.status_code",
                op: "=",
                value: "200"
            }
        ],
        time_range: 3600,
    }),
});

export const queryId = latencyQuery.id;
\`\`\`
`,
        source: 'honeycomb-pulumi-core-resources',
        metadata: {
          search: 'all',
          type: 'resources',
          provider: 'honeycomb',
          language: 'typescript',
          concept: 'pulumi-infrastructure-as-code'
        }
      },
      {
        title: 'Honeycomb Pulumi Provider - SLOs (Service Level Objectives)',
        content: `# Honeycomb Pulumi Provider - SLOs

## Overview
Service Level Objectives (SLOs) help you define and track reliability targets for your services.

## Prerequisites

### Creating a Derived Column for SLI
First, create a Derived Column that will serve as your Service Level Indicator (SLI):

\`\`\`typescript
import * as honeycombio from "@pulumi/honeycombio";
import * as fs from "fs";

const requestLatencySli = new honeycombio.DerivedColumn("request-latency-sli", {
    alias: "sli.request_latency",
    description: "SLI: request latency less than 300ms",
    dataset: "my-service",
    expression: "LTE($duration_ms, 300)",
});
\`\`\`

## Creating an SLO

### Basic SLO
\`\`\`typescript
const latencySlo = new honeycombio.Slo("request-latency-slo", {
    name: "Request Latency",
    description: "99.9% of requests should complete in under 300ms",
    dataset: "my-service",
    sli: requestLatencySli.alias,
    targetPercentage: 99.9,
    timePeriod: 30,
});

export const sloId = latencySlo.id;
\`\`\`

### SLO with Tags
\`\`\`typescript
const errorRateSlo = new honeycombio.Slo("error-rate-slo", {
    name: "Error Rate",
    description: "99.5% of requests should succeed",
    dataset: "my-service",
    sli: "sli.error_rate",
    targetPercentage: 99.5,
    timePeriod: 30,
    tags: {
        team: "platform",
        service: "api-gateway",
        priority: "critical",
    },
});
\`\`\`

## Configuration Options

### Required Properties
- **sli**: The alias of the Derived Column used as the SLI to indicate event success
- **targetPercentage**: Success rate expectation (e.g., 99.9 for 99.9%)
- **timePeriod**: Evaluation window in days (e.g., 30 for rolling 30-day window)
- **dataset** or **datasets**: Dataset(s) where the SLO evaluates

### Optional Properties
- **name**: Custom SLO identifier (defaults to resource name)
- **description**: Purpose and context documentation
- **tags**: Key-value pairs for resource organization

## SLO Burn Alerts

### Creating a Burn Alert
Burn alerts notify you when your error budget is being consumed too quickly:

\`\`\`typescript
const burnAlert = new honeycombio.BurnAlert("latency-burn-alert", {
    sloId: latencySlo.id,
    exhaustionMinutes: 60,
    alertRecipients: [
        {
            type: "slack",
            id: slackRecipient.id,
        },
        {
            type: "pagerduty",
            id: pagerdutyRecipient.id,
        },
    ],
});
\`\`\`

## Complete Example

\`\`\`typescript
import * as pulumi from "@pulumi/pulumi";
import * as honeycombio from "@pulumi/honeycombio";

const config = new pulumi.Config();
const dataset = config.require("dataset");

// 1. Create SLI as Derived Column
const availabilitySli = new honeycombio.DerivedColumn("availability-sli", {
    alias: "sli.availability",
    description: "SLI: successful requests (status code 2xx or 3xx)",
    dataset: dataset,
    expression: "OR(LTE($http.status_code, 399), GTE($http.status_code, 200))",
});

// 2. Create SLO
const availabilitySlo = new honeycombio.Slo("availability-slo", {
    name: "API Availability",
    description: "99.9% availability over 30 days",
    dataset: dataset,
    sli: availabilitySli.alias,
    targetPercentage: 99.9,
    timePeriod: 30,
    tags: {
        team: "backend",
        service: "api",
        tier: "critical",
    },
});

// 3. Create Slack notification recipient
const slackChannel = new honeycombio.SlackRecipient("slo-alerts", {
    channel: "#slo-alerts",
    name: "SLO Alerts Channel",
});

// 4. Create burn alert
const criticalBurnAlert = new honeycombio.BurnAlert("critical-burn", {
    sloId: availabilitySlo.id,
    exhaustionMinutes: 60,
    alertRecipients: [
        {
            type: "slack",
            id: slackChannel.id,
        },
    ],
});

// Exports
export const sloId = availabilitySlo.id;
export const sloName = availabilitySlo.name;
export const burnAlertId = criticalBurnAlert.id;
\`\`\`
`,
        source: 'honeycomb-pulumi-slos',
        metadata: {
          search: 'all',
          type: 'slos',
          provider: 'honeycomb',
          language: 'typescript',
          concept: 'pulumi-infrastructure-as-code'
        }
      },
      {
        title: 'Honeycomb Pulumi Provider - Alerts and Notifications',
        content: `# Honeycomb Pulumi Provider - Alerts and Notifications

## Notification Recipients

### Slack Recipient
\`\`\`typescript
import * as honeycombio from "@pulumi/honeycombio";

const slackRecipient = new honeycombio.SlackRecipient("ops-alerts", {
    channel: "#ops-alerts",
    name: "Operations Alerts",
});
\`\`\`

### PagerDuty Recipient
\`\`\`typescript
const pagerdutyRecipient = new honeycombio.PagerdutyRecipient("oncall", {
    integrationKey: config.requireSecret("pagerdutyIntegrationKey"),
    name: "On-Call Team",
});
\`\`\`

### Email Recipient
\`\`\`typescript
const emailRecipient = new honeycombio.EmailRecipient("team-email", {
    address: "team@example.com",
    name: "Team Email List",
});
\`\`\`

### Webhook Recipient
\`\`\`typescript
const webhookRecipient = new honeycombio.WebhookRecipient("custom-webhook", {
    url: "https://api.example.com/webhooks/honeycomb",
    name: "Custom Webhook",
    secret: config.requireSecret("webhookSecret"),
});
\`\`\`

### Microsoft Teams Recipient
\`\`\`typescript
const teamsRecipient = new honeycombio.MsteamsRecipient("teams-channel", {
    url: config.requireSecret("teamsWebhookUrl"),
    name: "Engineering Team Channel",
});
\`\`\`

## Triggers

### Creating a Query-based Trigger
\`\`\`typescript
const highErrorRateTrigger = new honeycombio.Trigger("high-error-rate", {
    dataset: "my-service",
    name: "High Error Rate",
    description: "Alert when error rate exceeds 5%",
    query: {
        calculations: [
            {
                op: "COUNT",
            },
        ],
        filters: [
            {
                column: "http.status_code",
                op: ">=",
                value: "500",
            },
        ],
        havings: [
            {
                calculateOp: "COUNT",
                op: ">",
                value: 100,
            },
        ],
        timeRange: 300, // 5 minutes
    },
    frequency: 300, // Check every 5 minutes
    alertType: "on_change",
    recipients: [
        {
            type: "slack",
            id: slackRecipient.id,
        },
        {
            type: "pagerduty",
            id: pagerdutyRecipient.id,
        },
    ],
});
\`\`\`

### Trigger with Threshold
\`\`\`typescript
const slowRequestsTrigger = new honeycombio.Trigger("slow-requests", {
    dataset: "my-service",
    name: "Slow Request Latency",
    description: "Alert when P95 latency exceeds 2 seconds",
    query: {
        calculations: [
            {
                op: "P95",
                column: "duration_ms",
            },
        ],
        timeRange: 600, // 10 minutes
    },
    frequency: 300,
    alertType: "on_true",
    threshold: {
        op: ">",
        value: 2000, // 2 seconds in milliseconds
    },
    recipients: [
        {
            type: "slack",
            id: slackRecipient.id,
        },
    ],
});
\`\`\`

## Complete Alerting Setup Example

\`\`\`typescript
import * as pulumi from "@pulumi/pulumi";
import * as honeycombio from "@pulumi/honeycombio";

const config = new pulumi.Config();
const dataset = config.require("dataset");

// 1. Set up notification recipients
const slackOps = new honeycombio.SlackRecipient("ops-channel", {
    channel: "#ops-alerts",
    name: "Operations Team",
});

const pagerduty = new honeycombio.PagerdutyRecipient("oncall", {
    integrationKey: config.requireSecret("pdIntegrationKey"),
    name: "On-Call Rotation",
});

const teamEmail = new honeycombio.EmailRecipient("team-email", {
    address: "engineering@example.com",
    name: "Engineering Team",
});

// 2. Create error rate trigger
const errorTrigger = new honeycombio.Trigger("error-spike", {
    dataset: dataset,
    name: "Error Rate Spike",
    description: "Errors exceeded 1% of total requests",
    query: {
        calculations: [
            {
                op: "COUNT",
            },
        ],
        filters: [
            {
                column: "http.status_code",
                op: ">=",
                value: "500",
            },
        ],
        timeRange: 300,
    },
    frequency: 300,
    alertType: "on_true",
    threshold: {
        op: ">",
        value: 10,
    },
    recipients: [
        {
            type: "slack",
            id: slackOps.id,
        },
        {
            type: "pagerduty",
            id: pagerduty.id,
        },
    ],
});

// 3. Create latency trigger
const latencyTrigger = new honeycombio.Trigger("high-latency", {
    dataset: dataset,
    name: "High P99 Latency",
    description: "P99 latency exceeded 5 seconds",
    query: {
        calculations: [
            {
                op: "P99",
                column: "duration_ms",
            },
        ],
        timeRange: 600,
    },
    frequency: 300,
    alertType: "on_true",
    threshold: {
        op: ">",
        value: 5000,
    },
    recipients: [
        {
            type: "slack",
            id: slackOps.id,
        },
        {
            type: "email",
            id: teamEmail.id,
        },
    ],
});

// Exports
export const errorTriggerId = errorTrigger.id;
export const latencyTriggerId = latencyTrigger.id;
export const slackRecipientId = slackOps.id;
\`\`\`
`,
        source: 'honeycomb-pulumi-alerts-notifications',
        metadata: {
          search: 'all',
          type: 'alerts',
          provider: 'honeycomb',
          language: 'typescript',
          concept: 'pulumi-infrastructure-as-code'
        }
      },
      {
        title: 'Honeycomb Pulumi Provider - Boards and Visualizations',
        content: `# Honeycomb Pulumi Provider - Boards and Visualizations

## Boards

### Creating a Basic Board
\`\`\`typescript
import * as honeycombio from "@pulumi/honeycombio";

const serviceBoard = new honeycombio.Board("service-overview", {
    name: "Service Overview Dashboard",
    description: "Key metrics for my-service",
});

export const boardId = serviceBoard.id;
\`\`\`

### Flexible Board with Queries
\`\`\`typescript
// First, create queries
const latencyQuery = new honeycombio.Query("p95-latency", {
    dataset: "my-service",
    queryJson: JSON.stringify({
        calculations: [
            {
                op: "P95",
                column: "duration_ms"
            }
        ],
        time_range: 3600,
    }),
});

const errorRateQuery = new honeycombio.Query("error-rate", {
    dataset: "my-service",
    queryJson: JSON.stringify({
        calculations: [
            {
                op: "COUNT",
            }
        ],
        filters: [
            {
                column: "http.status_code",
                op: ">=",
                value: "500"
            }
        ],
        time_range: 3600,
    }),
});

// Then, create a flexible board with queries
const flexibleBoard = new honeycombio.FlexibleBoard("performance-board", {
    name: "Performance Dashboard",
    description: "Latency and error metrics",
    queries: [
        {
            query: latencyQuery.id,
            graphSettings: {
                hideMarkers: false,
                logScale: false,
            },
        },
        {
            query: errorRateQuery.id,
            graphSettings: {
                hideMarkers: false,
                logScale: false,
            },
        },
    ],
    style: "visual",
});
\`\`\`

## Derived Columns

### Creating a Derived Column
Derived columns let you create calculated fields from existing data:

\`\`\`typescript
const errorRateColumn = new honeycombio.DerivedColumn("error-rate", {
    alias: "metrics.error_rate",
    description: "Percentage of requests with errors",
    dataset: "my-service",
    expression: "DIVIDE(COUNT(IF(GTE($http.status_code, 500), 1, 0)), COUNT())",
});
\`\`\`

### Derived Column for Status Classification
\`\`\`typescript
const statusCategory = new honeycombio.DerivedColumn("status-category", {
    alias: "http.status_category",
    description: "Categorize HTTP status codes",
    dataset: "my-service",
    expression: \`IF(LT($http.status_code, 400), "success",
                   IF(LT($http.status_code, 500), "client_error", "server_error"))\`,
});
\`\`\`

## Column Configuration

### Creating a Column
Configure how columns appear in your dataset:

\`\`\`typescript
const durationColumn = new honeycombio.Column("duration", {
    dataset: "my-service",
    keyName: "duration_ms",
    type: "float",
    description: "Request duration in milliseconds",
    hidden: false,
});
\`\`\`

## Complete Dashboard Example

\`\`\`typescript
import * as pulumi from "@pulumi/pulumi";
import * as honeycombio from "@pulumi/honeycombio";

const config = new pulumi.Config();
const dataset = config.require("dataset");

// 1. Create derived columns for metrics
const errorRate = new honeycombio.DerivedColumn("error-rate-metric", {
    alias: "sli.error_rate",
    description: "Percentage of successful requests",
    dataset: dataset,
    expression: "LT($http.status_code, 500)",
});

const latencyBucket = new honeycombio.DerivedColumn("latency-bucket", {
    alias: "latency.bucket",
    description: "Latency performance bucket",
    dataset: dataset,
    expression: \`IF(LTE($duration_ms, 100), "fast",
                   IF(LTE($duration_ms, 500), "acceptable",
                   IF(LTE($duration_ms, 1000), "slow", "critical")))\`,
});

// 2. Create queries for the dashboard
const requestsQuery = new honeycombio.Query("total-requests", {
    dataset: dataset,
    queryJson: JSON.stringify({
        calculations: [
            {
                op: "COUNT",
            },
        ],
        breakdowns: ["http.status_code"],
        time_range: 3600,
    }),
});

const latencyQuery = new honeycombio.Query("latency-percentiles", {
    dataset: dataset,
    queryJson: JSON.stringify({
        calculations: [
            {
                op: "P50",
                column: "duration_ms",
            },
            {
                op: "P95",
                column: "duration_ms",
            },
            {
                op: "P99",
                column: "duration_ms",
            },
        ],
        time_range: 3600,
    }),
});

const topEndpointsQuery = new honeycombio.Query("top-endpoints", {
    dataset: dataset,
    queryJson: JSON.stringify({
        calculations: [
            {
                op: "COUNT",
            },
        ],
        breakdowns: ["http.route"],
        orders: [
            {
                op: "COUNT",
                order: "descending",
            },
        ],
        limit: 10,
        time_range: 3600,
    }),
});

// 3. Create the flexible board
const mainDashboard = new honeycombio.FlexibleBoard("service-dashboard", {
    name: "Service Health Dashboard",
    description: "Comprehensive view of service health and performance",
    queries: [
        {
            query: requestsQuery.id,
            graphSettings: {
                hideMarkers: false,
                logScale: false,
            },
        },
        {
            query: latencyQuery.id,
            graphSettings: {
                hideMarkers: false,
                logScale: false,
            },
        },
        {
            query: topEndpointsQuery.id,
            graphSettings: {
                hideMarkers: false,
                logScale: false,
            },
        },
    ],
    style: "visual",
});

// Exports
export const dashboardId = mainDashboard.id;
export const dashboardUrl = pulumi.interpolate\`https://ui.honeycomb.io/board/\${mainDashboard.id}\`;
\`\`\`
`,
        source: 'honeycomb-pulumi-boards-visualizations',
        metadata: {
          search: 'all',
          type: 'boards',
          provider: 'honeycomb',
          language: 'typescript',
          concept: 'pulumi-infrastructure-as-code'
        }
      },
      {
        title: 'Honeycomb Pulumi Provider - Complete Infrastructure Example',
        content: `# Honeycomb Pulumi Provider - Complete Infrastructure Example

## Full Production Setup

This example demonstrates a complete Honeycomb infrastructure setup using Pulumi for a production service.

\`\`\`typescript
import * as pulumi from "@pulumi/pulumi";
import * as honeycombio from "@pulumi/honeycombio";

const config = new pulumi.Config();
const serviceName = config.require("serviceName");
const environment = pulumi.getStack();

// ============================================================================
// 1. API Keys
// ============================================================================

const ciApiKey = new honeycombio.ApiKey("ci-pipeline", {
    name: \`\${serviceName}-ci-\${environment}\`,
    permissions: {
        createDatasets: false,
        manageQueryHistory: false,
        sendEvents: true,
    },
});

const ingestApiKey = new honeycombio.ApiKey("production-ingest", {
    name: \`\${serviceName}-prod-\${environment}\`,
    permissions: {
        createDatasets: false,
        manageQueryHistory: true,
        sendEvents: true,
    },
});

// ============================================================================
// 2. Datasets
// ============================================================================

const appDataset = new honeycombio.Dataset("app-dataset", {
    name: \`\${serviceName}-\${environment}\`,
    description: \`Application traces and logs for \${serviceName}\`,
});

// ============================================================================
// 3. Derived Columns (SLIs)
// ============================================================================

const availabilitySli = new honeycombio.DerivedColumn("availability-sli", {
    alias: "sli.availability",
    description: "SLI: successful requests (2xx/3xx status codes)",
    dataset: appDataset.slug,
    expression: "AND(GTE($http.status_code, 200), LT($http.status_code, 400))",
});

const latencySli = new honeycombio.DerivedColumn("latency-sli", {
    alias: "sli.latency_300ms",
    description: "SLI: requests completing under 300ms",
    dataset: appDataset.slug,
    expression: "LTE($duration_ms, 300)",
});

const errorCategorization = new honeycombio.DerivedColumn("error-category", {
    alias: "error.category",
    description: "Categorize errors by status code",
    dataset: appDataset.slug,
    expression: \`IF(LT($http.status_code, 400), "success",
                   IF(EQ($http.status_code, 401), "unauthorized",
                   IF(EQ($http.status_code, 403), "forbidden",
                   IF(EQ($http.status_code, 404), "not_found",
                   IF(LT($http.status_code, 500), "client_error", "server_error")))))\`,
});

// ============================================================================
// 4. SLOs
// ============================================================================

const availabilitySlo = new honeycombio.Slo("availability-slo", {
    name: "API Availability",
    description: "99.9% of requests should succeed",
    dataset: appDataset.slug,
    sli: availabilitySli.alias,
    targetPercentage: 99.9,
    timePeriod: 30,
    tags: {
        team: "backend",
        service: serviceName,
        environment: environment,
        tier: "critical",
    },
});

const latencySlo = new honeycombio.Slo("latency-slo", {
    name: "Response Time",
    description: "95% of requests should complete in under 300ms",
    dataset: appDataset.slug,
    sli: latencySli.alias,
    targetPercentage: 95.0,
    timePeriod: 30,
    tags: {
        team: "backend",
        service: serviceName,
        environment: environment,
        tier: "high",
    },
});

// ============================================================================
// 5. Notification Recipients
// ============================================================================

const slackOpsChannel = new honeycombio.SlackRecipient("ops-alerts", {
    channel: \`#\${serviceName}-alerts\`,
    name: "Operations Alerts",
});

const slackTeamChannel = new honeycombio.SlackRecipient("team-notifications", {
    channel: \`#\${serviceName}-team\`,
    name: "Team Notifications",
});

const pagerdutyOnCall = new honeycombio.PagerdutyRecipient("oncall", {
    integrationKey: config.requireSecret("pagerdutyIntegrationKey"),
    name: "On-Call Rotation",
});

const teamEmail = new honeycombio.EmailRecipient("team-email", {
    address: config.require("teamEmail"),
    name: "Team Email List",
});

// ============================================================================
// 6. Burn Alerts
// ============================================================================

const availabilityBurnAlert = new honeycombio.BurnAlert("availability-burn", {
    sloId: availabilitySlo.id,
    exhaustionMinutes: 60, // Alert if error budget will be exhausted in 1 hour
    alertRecipients: [
        {
            type: "slack",
            id: slackOpsChannel.id,
        },
        {
            type: "pagerduty",
            id: pagerdutyOnCall.id,
        },
    ],
});

const latencyBurnAlert = new honeycombio.BurnAlert("latency-burn", {
    sloId: latencySlo.id,
    exhaustionMinutes: 120, // Alert if error budget will be exhausted in 2 hours
    alertRecipients: [
        {
            type: "slack",
            id: slackTeamChannel.id,
        },
    ],
});

// ============================================================================
// 7. Triggers
// ============================================================================

const errorSpikeTrigger = new honeycombio.Trigger("error-spike", {
    dataset: appDataset.slug,
    name: "Error Rate Spike",
    description: "Alert when error count exceeds threshold",
    query: {
        calculations: [
            {
                op: "COUNT",
            },
        ],
        filters: [
            {
                column: "http.status_code",
                op: ">=",
                value: "500",
            },
        ],
        timeRange: 300, // 5 minutes
    },
    frequency: 300,
    alertType: "on_true",
    threshold: {
        op: ">",
        value: 50,
    },
    recipients: [
        {
            type: "slack",
            id: slackOpsChannel.id,
        },
        {
            type: "pagerduty",
            id: pagerdutyOnCall.id,
        },
    ],
});

const highLatencyTrigger = new honeycombio.Trigger("high-latency", {
    dataset: appDataset.slug,
    name: "High P99 Latency",
    description: "Alert when P99 latency exceeds 5 seconds",
    query: {
        calculations: [
            {
                op: "P99",
                column: "duration_ms",
            },
        ],
        timeRange: 600, // 10 minutes
    },
    frequency: 300,
    alertType: "on_true",
    threshold: {
        op: ">",
        value: 5000,
    },
    recipients: [
        {
            type: "slack",
            id: slackTeamChannel.id,
        },
        {
            type: "email",
            id: teamEmail.id,
        },
    ],
});

// ============================================================================
// 8. Queries for Dashboard
// ============================================================================

const requestVolumeQuery = new honeycombio.Query("request-volume", {
    dataset: appDataset.slug,
    queryJson: JSON.stringify({
        calculations: [
            {
                op: "COUNT",
            },
        ],
        breakdowns: ["http.status_code"],
        time_range: 3600,
    }),
});

const latencyPercentilesQuery = new honeycombio.Query("latency-percentiles", {
    dataset: appDataset.slug,
    queryJson: JSON.stringify({
        calculations: [
            {
                op: "P50",
                column: "duration_ms",
            },
            {
                op: "P95",
                column: "duration_ms",
            },
            {
                op: "P99",
                column: "duration_ms",
            },
        ],
        time_range: 3600,
    }),
});

const topEndpointsQuery = new honeycombio.Query("top-endpoints", {
    dataset: appDataset.slug,
    queryJson: JSON.stringify({
        calculations: [
            {
                op: "COUNT",
            },
            {
                op: "P95",
                column: "duration_ms",
            },
        ],
        breakdowns: ["http.route"],
        orders: [
            {
                op: "COUNT",
                order: "descending",
            },
        ],
        limit: 10,
        time_range: 3600,
    }),
});

const errorsByTypeQuery = new honeycombio.Query("errors-by-type", {
    dataset: appDataset.slug,
    queryJson: JSON.stringify({
        calculations: [
            {
                op: "COUNT",
            },
        ],
        filters: [
            {
                column: "http.status_code",
                op: ">=",
                value: "400",
            },
        ],
        breakdowns: ["error.category"],
        time_range: 3600,
    }),
});

// ============================================================================
// 9. Dashboard
// ============================================================================

const mainDashboard = new honeycombio.FlexibleBoard("main-dashboard", {
    name: \`\${serviceName} - Service Health\`,
    description: \`Comprehensive monitoring dashboard for \${serviceName} \${environment}\`,
    queries: [
        {
            query: requestVolumeQuery.id,
            graphSettings: {
                hideMarkers: false,
                logScale: false,
            },
        },
        {
            query: latencyPercentilesQuery.id,
            graphSettings: {
                hideMarkers: false,
                logScale: false,
            },
        },
        {
            query: topEndpointsQuery.id,
            graphSettings: {
                hideMarkers: false,
                logScale: false,
            },
        },
        {
            query: errorsByTypeQuery.id,
            graphSettings: {
                hideMarkers: false,
                logScale: false,
            },
        },
    ],
    style: "visual",
});

// ============================================================================
// Exports
// ============================================================================

export const ciApiKeyValue = ciApiKey.secret;
export const ingestApiKeyValue = ingestApiKey.secret;
export const datasetName = appDataset.name;
export const datasetSlug = appDataset.slug;
export const availabilitySloId = availabilitySlo.id;
export const latencySloId = latencySlo.id;
export const dashboardId = mainDashboard.id;
export const dashboardUrl = pulumi.interpolate\`https://ui.honeycomb.io/board/\${mainDashboard.id}\`;
\`\`\`

## Usage

### Configuration
Set the required configuration values:

\`\`\`bash
pulumi config set serviceName my-api
pulumi config set teamEmail team@example.com
pulumi config set --secret pagerdutyIntegrationKey <your-key>
pulumi config set --secret honeycombApiKey <your-api-key>
\`\`\`

### Deploy
\`\`\`bash
pulumi up
\`\`\`

This will create:
- 2 API keys (CI and production)
- 1 dataset
- 3 derived columns (SLIs)
- 2 SLOs (availability and latency)
- 4 notification recipients
- 2 burn alerts
- 2 triggers
- 4 queries
- 1 comprehensive dashboard
`,
        source: 'honeycomb-pulumi-complete-example',
        metadata: {
          search: 'all',
          type: 'complete-example',
          provider: 'honeycomb',
          language: 'typescript',
          concept: 'pulumi-infrastructure-as-code'
        }
      }
    ];
  }

  async processDocument(doc, index) {
    const documentId = `honeycomb-pulumi-${Date.now()}-${index}`;

    return new Document({
      pageContent: doc.content,
      metadata: {
        id: documentId,
        title: doc.title,
        source: doc.source,
        ingestedAt: new Date().toISOString(),
        document_id: documentId,
        ...doc.metadata
      }
    });
  }

  async ingestDocuments() {
    try {
      logger.info('Starting ingestion of Honeycomb Pulumi provider documentation...');

      const documents = await Promise.all(
        this.honeycombDocuments.map((doc, index) => this.processDocument(doc, index))
      );

      const totalChunks = await vectorStore.addDocuments(documents);

      logger.info(`Successfully ingested ${documents.length} Honeycomb Pulumi documents (${totalChunks} chunks)`);

      return {
        documentsIngested: documents.length,
        chunksCreated: totalChunks
      };

    } catch (error) {
      logger.error('Error ingesting Honeycomb Pulumi documents:', error);
      throw error;
    }
  }

  async saveDocumentsToFile() {
    try {
      const docsPath = path.join(__dirname, '../data/honeycomb-pulumi-docs.json');
      await fs.writeFile(docsPath, JSON.stringify(this.honeycombDocuments, null, 2));
      logger.info(`Honeycomb Pulumi documents saved to ${docsPath}`);
    } catch (error) {
      logger.error('Error saving documents to file:', error);
      throw error;
    }
  }

  async run() {
    try {
      logger.info('🚀 Starting Honeycomb Pulumi documentation ingestion...');

      const dataDir = path.join(__dirname, '../data');
      await fs.mkdir(dataDir, { recursive: true });

      await this.saveDocumentsToFile();
      await vectorStore.initialize();

      const result = await this.ingestDocuments();

      logger.info('✅ Honeycomb Pulumi data ingestion completed successfully!');
      logger.info(`📊 Summary: ${result.documentsIngested} documents, ${result.chunksCreated} chunks`);

      return result;

    } catch (error) {
      logger.error('❌ Honeycomb Pulumi data ingestion failed:', error);
      throw error;
    }
  }
}

// Run the ingestion if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const ingestionService = new HoneycombPulumiIngestionService();

  ingestionService.run()
    .then((result) => {
      console.log('✅ Honeycomb Pulumi ingestion completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Honeycomb Pulumi ingestion failed:', error);
      process.exit(1);
    });
}

export default HoneycombPulumiIngestionService;

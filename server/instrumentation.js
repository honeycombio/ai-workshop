/**
 * OpenTelemetry Instrumentation Entry Point
 *
 * This file MUST be imported before any other application code
 * to ensure proper auto-instrumentation of libraries.
 */
import { initializeTracing } from './config/tracing.js';

// Initialize tracing immediately
initializeTracing();

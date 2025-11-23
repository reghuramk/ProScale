import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";

const traceExporter = new OTLPTraceExporter();
const metricExporter = new OTLPMetricExporter();
const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 60000,
});
const logExporter = new OTLPLogExporter();
const logRecordProcessors = [new BatchLogRecordProcessor(logExporter)];

const sdk = new NodeSDK({
  instrumentations: [getNodeAutoInstrumentations(), new PinoInstrumentation()],
  logRecordProcessors,
  metricReader,
  serviceName: "pro-scale-service",
  traceExporter,
});

sdk.start();

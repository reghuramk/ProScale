import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const traceExporter = new OTLPTraceExporter();
const metricExporter = new OTLPMetricExporter();
const logExporter = new OTLPLogExporter();

const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 60000,
});

const logRecordProcessors = [new SimpleLogRecordProcessor(logExporter)];

const sdk = new NodeSDK({
  instrumentations: [
    getNodeAutoInstrumentations(),
    new PinoInstrumentation({
      // Optional: Force it to hook into specific fields if needed
      logHook: () => {
        console.log("Pino Hook Triggered!"); // This will show in your terminal if it's working
      },
    }),
  ],
  logRecordProcessors,
  metricReader,
  serviceName: process.env.OTEL_SERVICE_NAME,
  traceExporter,
});

sdk.start();

console.log("✅ OpenTelemetry Initialized with DEBUG mode");

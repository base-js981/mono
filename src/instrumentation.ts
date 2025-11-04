import * as opentelemetry from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { PrismaInstrumentation } from '@prisma/instrumentation';

const isJaegerEnabled = process.env.JAEGER_ENABLED !== 'false';
const serviceName = process.env.OTEL_SERVICE_NAME || 'nestjs-app-service';
const otlpEndpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';

if (!isJaegerEnabled) {
  console.log('Jaeger tracing is disabled');
} else {
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
  });

  const exporter = new OTLPTraceExporter({
    url: otlpEndpoint,
  });

  const traceProcessor = new BatchSpanProcessor(exporter);

  const sdk = new opentelemetry.NodeSDK({
    resource: resource,
    spanProcessor: traceProcessor,
    instrumentations: [
      getNodeAutoInstrumentations(),
      new PrismaInstrumentation(),
    ],
  });

  sdk.start();
  console.log(
    `OpenTelemetry tracing initialized for service: ${serviceName}, endpoint: ${otlpEndpoint}`,
  );

  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => console.log('Tracing terminated'))
      .catch((error) => console.log('Error terminating tracing', error))
      .finally(() => process.exit(0));
  });
}
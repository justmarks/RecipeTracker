import {AnthropicInstrumentation} from
  "@arizeai/openinference-instrumentation-anthropic";
import Anthropic from "@anthropic-ai/sdk";
import {getApp, initializeApp} from "firebase-admin/app";
import {NodeSDK} from "@opentelemetry/sdk-node";

let instrumentationReady: Promise<void> = Promise.resolve();
let started = false;

/** Start AgentPond tracing once during the Functions entrypoint load. */
export function startInstrumentation(): void {
  if (started) return;
  started = true;

  // AgentPond uses the default Admin app and its configured Storage bucket.
  // Firebase Functions supplies that configuration through FIREBASE_CONFIG.
  try {
    getApp();
  } catch {
    initializeApp();
  }

  instrumentationReady = initializeInstrumentation();
}

/**
 * Wait until tracing is ready before constructing an Anthropic client.
 * @return {Promise<void>} Resolves after tracing has started.
 */
export function waitForInstrumentation(): Promise<void> {
  return instrumentationReady;
}

/** Configure OpenInference instrumentation and its Firebase exporter. */
async function initializeInstrumentation(): Promise<void> {
  // @agentpond/firebase is ESM-only, while this Functions package emits
  // CommonJS. Native dynamic import keeps the existing module format intact.
  const {createFirebaseSpanExporter} = await import("@agentpond/firebase");
  const anthropicInstrumentation = new AnthropicInstrumentation({
    // Recipe pages, scans, and meal plans can contain personal content.
    // Keep operational model/latency/token/error data while excluding the
    // prompts and generated recipes from trace objects.
    traceConfig: {
      hideInputs: true,
      hideOutputs: true,
    },
  });

  // The Anthropic module is already loaded by the callable modules in this
  // CommonJS bundle, so patch that exact module instance explicitly.
  anthropicInstrumentation.manuallyInstrument(Anthropic);

  const sdk = new NodeSDK({
    traceExporter: createFirebaseSpanExporter(),
    instrumentations: [anthropicInstrumentation],
  });

  sdk.start();
}

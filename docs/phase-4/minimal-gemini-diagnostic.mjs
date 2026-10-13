import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import nextEnv from '@next/env';
import { moduleLoader, root } from '../../tests/helpers/module-loader.mjs';

// One diagnostic run only. No database, image search, SDK retry, or fallback.
const outputPath = path.join(root, 'docs/phase-4/minimal-gemini-diagnostic.json');
let blockedAttempt;
if (fs.existsSync(outputPath)) {
  const previous = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  const blocked = previous.calls.length === 1 && previous.calls[0].http_status === null
    && previous.calls[0].transport_or_sdk_error === 'fetch failed' && !previous.calls[0].success;
  if (!process.argv.includes('--retry-dns-block') || !blocked || previous.local_dns_block) {
    throw new Error('Diagnostic already recorded; refusing another run.');
  }
  blockedAttempt = { ...previous.calls[0], dns_check_code: 'ENOTFOUND',
    explanation: 'Sandbox DNS resolution failed before reaching Google; not a Gemini API call.' };
}
nextEnv.loadEnvConfig(root, false, { info() {}, error() {} });
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('Gemini key is not configured.');
const prompt = await moduleLoader('utils/ai/journey-prompt.ts');
const validation = await moduleLoader('utils/journeys/validation.ts');
const input = {
  time: 'afternoon', budget: 'under $25', vibes: [],
  wild_idea: "An Alien's First Day on Earth — Explain humanity through New York.",
};
const userPrompt = prompt.generationPrompt(input);
const previous = [1, 2].map(number => {
  const run = JSON.parse(fs.readFileSync(path.join(root, `docs/phase-2/generation-${number}.json`), 'utf8')).generation_run;
  return { model: run.model, system_prompt_chars: run.system_prompt.length,
    user_prompt_chars: run.user_prompt.length, correction_included: run.user_prompt.includes('Your previous response failed validation:') };
});
const redact = message => String(message).split(apiKey).join('[REDACTED]')
  .replace(/([?&]key=)[^&\s]+/gi, '$1[REDACTED]');
const result = {
  started_at: new Date().toISOString(), model: 'gemini-3.8-flash', max_transport_calls: 2,
  retry_enabled: false, fallback_enabled: false, database_access: false,
  full_request: { input, system_prompt_chars: prompt.SYSTEM_PROMPT.length, user_prompt_chars: userPrompt.length,
    schema_sha256: createHash('sha256').update(JSON.stringify(validation.JOURNEY_SCHEMA)).digest('hex'),
    response_mime_type: 'application/json', max_output_tokens: 8192, thinking_level: 'LOW',
    model_streaming: false, sdk_timeout_ms: 90000, per_call_timeout_ms: 10000 },
  phase_2_successes: previous, calls: [], transport_calls: 0,
  ...(blockedAttempt ? { local_dns_block: blockedAttempt } : {}),
};
let active;
const ai = new GoogleGenAI({ apiKey, httpOptions: {
  timeout: 90000, retryOptions: { attempts: 1 },
  fetch: async (url, options) => {
    if (result.transport_calls >= 2) throw new Error('Diagnostic transport call limit reached.');
    result.transport_calls += 1;
    const response = await fetch(url, options);
    active.http_status = response.status;
    if (!response.ok) {
      const body = await response.clone().json();
      active.google_error_message = redact(body?.error?.message ?? 'No Google error message returned.');
    }
    return response;
  },
} });
async function call(label, request) {
  active = { label, http_status: null, google_error_message: null };
  result.calls.push(active);
  const started = performance.now();
  try {
    const response = await ai.models.generateContent(request);
    active.success = true;
    active.output_chars = (response.text ?? '').length;
    if (label === 'minimal') active.response_text = response.text ?? '';
  } catch (error) {
    active.success = false;
    if (active.google_error_message === null) active.transport_or_sdk_error = redact(error.message ?? error.name);
  } finally {
    active.duration_ms = Math.round(performance.now() - started);
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
    process.stdout.write(JSON.stringify(active) + '\n');
  }
  return active.success;
}
// Persist a guard before issuing any paid request; interruption cannot silently rerun.
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n', { flag: blockedAttempt ? 'w' : 'wx' });
const minimalSucceeded = await call('minimal', { model: 'gemini-3.8-flash', contents: 'Say hi' });
if (minimalSucceeded) {
  await call('full_create', {
    model: 'gemini-3.8-flash', contents: userPrompt,
    config: { systemInstruction: prompt.SYSTEM_PROMPT, responseMimeType: 'application/json',
      responseJsonSchema: validation.JOURNEY_SCHEMA, maxOutputTokens: 8192,
      abortSignal: AbortSignal.any([AbortSignal.timeout(90000), AbortSignal.timeout(10000)]),
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
  });
} else {
  result.full_request_skipped = 'Minimal request failed; the user authorized the full request only after success.';
}
result.finished_at = new Date().toISOString();
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
process.stdout.write(JSON.stringify({ transport_calls: result.transport_calls,
  full_request_skipped: result.full_request_skipped, full_request: result.full_request,
  phase_2_successes: previous }) + '\n');

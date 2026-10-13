# Minimal Gemini Control Diagnostic

One actual Gemini API request was sent, using the application's runtime key and `gemini-3.8-flash`. SDK retries and application provider recovery were bypassed. No database, Unsplash, or authenticated product mutation was performed.

| Request | HTTP status | Duration | Result |
| --- | --- | --- | --- |
| `Say hi`, no system instruction, output schema, or thinking configuration | 503 | 863 ms | Google provider error |
| Current full `/create` request | Not sent | N/A | Conditional test skipped because the minimal request failed |

Google's exact error message:

> This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.

An earlier sandbox attempt failed DNS resolution before reaching Google (`fetch failed`, 28 ms; independent DNS lookup returned `ENOTFOUND`). It had no HTTP status and is retained separately in the JSON evidence. The network-enabled diagnostic sent one request and did not retry it.

## Comparison with Phase 2

The accepted Phase 2 success records provide the exact historical model and prompts. Phase 2 had no separate backend commit; the original adapter is preserved in the first product commit, `ed72e70`, and is compared with the current working tree.

| Property | Phase 2 baseline | Current `/create` |
| --- | --- | --- |
| Primary model | `gemini-3.8-flash` | `gemini-3.8-flash` |
| Thinking | No explicit setting | `thinkingConfig.thinkingLevel: LOW` |
| Model API | Nonstreaming `generateContent` | Nonstreaming `generateContent` |
| Output | JSON MIME type, Journey JSON schema, 8192 maximum output tokens | Same |
| System prompt | 8239 characters | 9014 characters (+775) |
| User prompt | Initial requests: 179 / 260 characters; successful corrective requests: 304 / 385 | 227 characters for the most recent Alien input, no correction |
| SDK timeout | 60 seconds | 90 seconds |
| Primary per-call abort | Shared 60-second generation deadline | 10 seconds, within the shared 90-second deadline |
| Provider recovery | None | Wait 2 seconds, retry primary once, then call configured fallback once |
| SDK transport attempts | 1 | 1 |

The additional system instructions cover physical moves, less predictable places, neighborhood variety, historical certainty, and brevity. User prompt lengths are affected by different inputs and by validation correction text, rather than only by code changes. The application now streams progress events to the browser; it does not stream Gemini output.

## Conclusion and limits

The minimal request reproduces Google's high-demand 503 without the full prompt, schema, or explicit thinking settings. This directly identifies provider availability as the cause of this observed failure. It does not validate the full request, which was deliberately not sent, or establish that every previous failure had the same cause.

Work stopped after this diagnostic. No commit, push, deployment, environment change, or database write was made during the diagnostic.

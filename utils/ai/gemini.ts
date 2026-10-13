import "server-only";
import { GoogleGenAI } from "@google/genai";
import { JOURNEY_SCHEMA, JourneyServiceError } from "../journeys/validation";

export function configuredModel() {
  const model = process.env.GEMINI_MODEL;
  if (!model || !/^[a-zA-Z0-9._-]+$/.test(model)) throw new JourneyServiceError("Journey generation is not configured.");
  return model;
}
export async function generateJourneyText(systemPrompt: string, userPrompt: string, model: string, signal: AbortSignal) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new JourneyServiceError("Journey generation is not configured.");
  // SDK defaults include transport retries. Each paid attempt must have its own audit row.
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 60_000, retryOptions: { attempts: 1 } } });
  const response = await ai.models.generateContent({
    model, contents: userPrompt,
    config: { systemInstruction: systemPrompt, responseMimeType: "application/json",
      responseJsonSchema: JOURNEY_SCHEMA, maxOutputTokens: 8192, abortSignal: signal },
  });
  return response.text ?? "";
}

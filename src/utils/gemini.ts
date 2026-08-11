import { GoogleGenAI } from "@google/genai";
import { env, hasGemini } from "../config/env.js";

export { hasGemini };

export type GeminiUsage = {
  promptTokens?: number;
  candidatesTokens?: number;
  totalTokens?: number;
};

const DEFAULT_MODEL = env.GEMINI_MODEL; // e.g., 'gemini-2.5-flash'

// The new SDK simplifies safety settings using flat configuration objects
const SAFETY_SETTINGS = [
  {
    category: "HARM_CATEGORY_HARASSMENT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
  {
    category: "HARM_CATEGORY_HATE_SPEECH",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
  {
    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
  {
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
];

function buildPrompt(prompt: string, contextParts: string[]) {
  if (contextParts.length) {
    return `${contextParts.join("\n\n")}\n\n---\n\n${prompt}`;
  }
  return prompt;
}

function getClient() {
  if (!hasGemini) throw new Error("GOOGLE_API_KEY is not configured");
  // The new SDK initializes via new GoogleGenAI()
  return new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY || "" });
}

export async function geminiGenerate(
  prompt: string,
  contextParts: string[] = [],
  modelName: string = DEFAULT_MODEL,
): Promise<{ text: string; usage: GeminiUsage }> {
  const ai = getClient();
  const fullPrompt = buildPrompt(prompt, contextParts);

  // Calls are unified under ai.models.generateContent
  const response = await ai.models.generateContent({
    model: modelName,
    contents: fullPrompt,
    config: {
      temperature: 0.7,
      safetySettings: SAFETY_SETTINGS as any,
    },
  });

  const usageMetadata = response.usageMetadata;
  const usage: GeminiUsage = {
    promptTokens: usageMetadata?.promptTokenCount,
    candidatesTokens: usageMetadata?.candidatesTokenCount,
    totalTokens: usageMetadata?.totalTokenCount,
  };

  return {
    text: response.text || "I could not generate a response at the moment.",
    usage,
  };
}

export async function geminiStream(
  prompt: string,
  contextParts: string[] = [],
  onText: (chunkText: string) => void,
  modelName: string = DEFAULT_MODEL,
): Promise<{ text: string; usage: GeminiUsage }> {
  const ai = getClient();
  const fullPrompt = buildPrompt(prompt, contextParts);

  // Streaming calls are unified under ai.models.generateContentStream
  const responseStream = await ai.models.generateContentStream({
    model: modelName,
    contents: fullPrompt,
    config: {
      temperature: 0.7,
      safetySettings: SAFETY_SETTINGS as any,
    },
  });

  let full = "";
  let usageMetadata: any = null;

  for await (const chunk of responseStream) {
    const chunkText = chunk.text;
    if (chunkText) {
      full += chunkText;
      onText(chunkText);
    }
    if (chunk.usageMetadata) {
      usageMetadata = chunk.usageMetadata;
    }
  }

  const usage: GeminiUsage = {
    promptTokens: usageMetadata?.promptTokenCount,
    candidatesTokens: usageMetadata?.candidatesTokenCount,
    totalTokens: usageMetadata?.totalTokenCount,
  };

  return { text: full, usage };
}

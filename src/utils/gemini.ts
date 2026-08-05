import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { env, hasGemini } from '../config/env.js';

export { hasGemini };

export type GeminiUsage = {
  promptTokens?: number;
  candidatesTokens?: number;
  totalTokens?: number;
};

const DEFAULT_MODEL = env.GEMINI_MODEL;

const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

function buildPrompt(prompt: string, contextParts: string[]) {
  const parts: string[] = [];
  if (contextParts.length) {
    parts.push(contextParts.join('\n\n'));
  }
  parts.push(prompt);
  return parts.join('\n\n---\n\n');
}

function getClient() {
  if (!hasGemini) throw new Error('GOOGLE_API_KEY is not configured');
  return new GoogleGenerativeAI(env.GOOGLE_API_KEY || '');
}

export async function geminiGenerate(
  prompt: string,
  contextParts: string[] = [],
  modelName: string = DEFAULT_MODEL
): Promise<{ text: string; usage: GeminiUsage }> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: modelName,
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      temperature: 0.7,
    },
  });

  const fullPrompt = buildPrompt(prompt, contextParts);
  const result = await model.generateContent(fullPrompt);
  const response = result.response;
  const text = response.text();

  const usageMetadata = response.usageMetadata;
  const usage: GeminiUsage = {
    promptTokens: usageMetadata?.promptTokenCount,
    candidatesTokens: usageMetadata?.candidatesTokenCount,
    totalTokens: usageMetadata?.totalTokenCount,
  };

  return { text: text || 'I could not generate a response at the moment.', usage };
}

export async function geminiStream(
  prompt: string,
  contextParts: string[] = [],
  onText: (chunkText: string) => void,
  modelName: string = DEFAULT_MODEL
): Promise<{ text: string; usage: GeminiUsage }> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: modelName,
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      temperature: 0.7,
    },
  });

  const fullPrompt = buildPrompt(prompt, contextParts);
  const result = await model.generateContentStream(fullPrompt);

  let full = '';
  let usageMetadata: any = null;
  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    if (chunkText) {
      full += chunkText;
      onText(chunkText);
    }
    if (chunk.usageMetadata) {
      usageMetadata = chunk.usageMetadata;
    }
  }

  const response = await result.response;
  if (response.usageMetadata) {
    usageMetadata = response.usageMetadata;
  }

  const usage: GeminiUsage = {
    promptTokens: usageMetadata?.promptTokenCount,
    candidatesTokens: usageMetadata?.candidatesTokenCount,
    totalTokens: usageMetadata?.totalTokenCount,
  };

  return { text: full, usage };
}

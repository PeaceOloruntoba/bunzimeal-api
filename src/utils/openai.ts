import { env } from "../config/env.js";
import { OpenAI } from "openai";

export type OpenAIUsage = {
  promptTokens?: number;
  candidatesTokens?: number;
  totalTokens?: number;
};

const DEFAULT_MODEL = env.OPENAI_MODEL || "gpt-4o-mini";

function buildMessages(prompt: string, contextParts: string[]) {
  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (contextParts && contextParts.length) {
    messages.push({ role: "system", content: contextParts.join("\n\n") });
  }
  messages.push({ role: "user", content: prompt });
  return messages;
}

function getClient() {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

export async function openaiGenerate(
  prompt: string,
  contextParts: string[] = [],
  modelName: string = DEFAULT_MODEL
): Promise<{ text: string; usage: OpenAIUsage }> {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: modelName,
    messages: buildMessages(prompt, contextParts) as any,
    temperature: 0.7,
  });
  const text: string = completion?.choices?.[0]?.message?.content ?? "";
  const usage: OpenAIUsage = {
    promptTokens: (completion as any)?.usage?.prompt_tokens,
    candidatesTokens: (completion as any)?.usage?.completion_tokens,
    totalTokens: (completion as any)?.usage?.total_tokens,
  };
  return { text: text || "I could not generate a response at the moment.", usage };
}

export async function openaiStream(
  prompt: string,
  contextParts: string[] = [],
  onText: (chunkText: string) => void,
  modelName: string = DEFAULT_MODEL
): Promise<{ text: string; usage: OpenAIUsage }> {
  const client = getClient();
  const stream = await client.chat.completions.create({
    model: modelName,
    messages: buildMessages(prompt, contextParts) as any,
    temperature: 0.7,
    stream: true,
  });
  let full = "";
  for await (const chunk of stream as any) {
    const delta = chunk?.choices?.[0]?.delta?.content || "";
    if (delta) {
      full += delta;
      onText(delta);
    }
  }
  const usage: OpenAIUsage = {};
  return { text: full, usage };
}

export interface ChatRequest {
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatSuccess {
  model: string;
  output: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  latency: number;
  estimatedCost: number | null;
  status: "success";
}

export interface ChatError {
  status: "error";
  error: string;
  code?: string;
}

export type ChatResponse = ChatSuccess | ChatError;

export async function chatWithOpenRouter(req: ChatRequest): Promise<ChatSuccess> {
  const res = await fetch("/api/openrouter/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  const json = (await res.json().catch(() => null)) as ChatResponse | null;

  if (!json) {
    throw new Error("Invalid response from server");
  }
  if (json.status === "error") {
    throw new Error(json.error);
  }
  return json;
}

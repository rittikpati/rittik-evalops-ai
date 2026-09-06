export type EvaluationRunStatus = "running" | "completed" | "failed" | "partial";

export type EvaluationRunMode = "mock" | "openrouter";

export interface EvaluationRun {
  id: string;
  ownerId: string;
  experimentId: string;
  datasetId: string;
  datasetName: string;
  mode: EvaluationRunMode;
  modelIds: string[];
  modelNames: string[];
  promptTemplate: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  judgeModelId: string;
  results: Array<{
    model: string;
    testCaseId: string;
    input: string;
    output: string;
    expectedOutput: string;
    status: "success" | "error";
    latency: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number | null;
    error?: string;
    code?: string;
    scores?: Record<string, number>;
  }>;
  aggregated: Array<{ modelId: string; avgAccuracy: number; totalCost: number; successRate: number }>;
  errors: Array<{ modelId: string; testCaseId: string; message: string; code?: string }>;
  status: EvaluationRunStatus;
  total: number;
  successful: number;
  failed: number;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
}
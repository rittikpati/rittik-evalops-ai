export interface Model {
  id: string;
  name: string;
  provider: string;
  version: string;
  accuracy: number;
  latency: number;
  costPer1kTokens: number;
  status: 'active' | 'deprecated' | 'beta';
  capabilities: string[];
  contextWindow: number;
  description?: string;
}

/** Canonical source formats a dataset can be imported from (DB column is text). */
export type DatasetSourceFormat =
  | "jsonl"
  | "json"
  | "csv"
  | "parquet"
  | "xlsx"
  | "txt"
  | "markdown"
  | "html"
  | "pdf"
  | "docx";

export interface Dataset {
  id: string;
  /** Owning user id — every dataset is scoped to exactly one user. */
  ownerId: string;
  name: string;
  version: string;
  format: DatasetSourceFormat;
  /** Number of test cases — derived from testCases.length for UI */
  testCases: number;
  /** Real test cases — source of truth for evaluation */
  cases?: TestCase[];
  status: 'ready' | 'processing' | 'error' | 'uploading';
  size: string;
  lastUpdated: string;
  createdAt?: string;
  description?: string;
  tags?: string[];
}

export interface Experiment {
  id: string;
  /** Owning user id — every experiment is scoped to exactly one user. */
  ownerId: string;
  name: string;
  description?: string;
  datasetId: string;
  datasetName: string;
  models: string[];
  status: 'draft' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  totalTestCases: number;
  completedTestCases: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  metrics?: ExperimentMetrics;
}

/** prompts — reusable prompt templates (system + user) scoped to a user/workspace */
export interface Prompt {
  id: string;
  /** Owning user id — every prompt is scoped to exactly one user. */
  ownerId: string;
  name: string;
  systemPrompt?: string;
  userPrompt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentMetrics {
  accuracy: number;
  faithfulness: number;
  relevance: number;
  hallucination: number;
  completeness?: number;
  toxicity?: number;
  bias?: number;
  latency: number;
  cost: number;
  safety: number;
}

export interface EvaluationResult {
  id: string;
  experimentId: string;
  modelId: string;
  modelName: string;
  question: string;
  expectedAnswer: string;
  modelAnswer: string;
  context: string;
  metrics: {
    accuracy: number;
    faithfulness: number;
    hallucination: number;
    relevance: number;
    latency: number;
    cost: number;
    safety: number;
  };
  judgeReason: string;
  createdAt: string;
}

export interface ComparisonResult {
  modelId: string;
  modelName: string;
  provider: string;
  metrics: {
    accuracy: number;
    faithfulness: number;
    relevance: number;
    hallucination: number;
    latency: number;
    cost: number;
    safety: number;
  };
  rank: number;
}

export interface ChartDataPoint {
  name: string;
  [key: string]: string | number;
}

export interface DashboardMetrics {
  modelsTested: number;
  experiments: number;
  testCases: number;
  avgAccuracy: number;
  avgHallucination: number;
  avgLatency: number;
  totalCost: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'member' | 'viewer';
  workspace: Workspace;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
  members: number;
  apiKeys: ApiKey[];
}

export interface ApiKey {
  id: string;
  name: string;
  provider: string;
  key: string;
  createdAt: string;
  lastUsed?: string;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  experimentComplete: boolean;
  experimentFailed: boolean;
  weeklyDigest: boolean;
}

export interface EvaluationPreferences {
  defaultJudgeModel: string;
  evaluationDimensions: string[];
  autoRunEvaluations: boolean;
  confidenceThreshold: number;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeout: number;
  apiAccess: boolean;
  ipWhitelist: string[];
}

export interface SettingsData {
  profile: User;
  workspace: Workspace;
  apiKeys: ApiKey[];
  notifications: NotificationSettings;
  evaluation: EvaluationPreferences;
  security: SecuritySettings;
}

export type PageRoute =
  | '/login'
  | '/dashboard'
  | '/datasets'
  | '/models'
  | '/experiments'
  | '/experiments/new'
  | '/experiments/[id]'
  | '/comparison'
  | '/evaluations/[id]'
  | '/prompts'
  | '/settings';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  children?: NavItem[];
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface TableColumn<T> {
  key: string;
  header: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: string;
}

export interface ChartConfig {
  [key: string]: {
    label: string;
    color: string;
  };
}

// ---------------------------------------------------------------------------
// Evaluation Pipeline (OpenRouter-ready)
// ---------------------------------------------------------------------------

export interface TestCase {
  id: string;
  datasetId: string;
  input: string;
  expectedOutput: string;
  context?: string;
  metadata?: Record<string, unknown>;
  index: number;
}

export type EvaluationMetric =
  | "accuracy"
  | "faithfulness"
  | "relevance"
  | "hallucination"
  | "latency"
  | "cost"
  | "safety";

export interface ModelResult {
  id: string;
  testCaseId: string;
  datasetId: string;
  experimentId: string;
  modelId: string;
  modelName: string;
  provider: string;
  input: string;
  expectedOutput: string;
  context?: string;
  output: string;
  latencyMs: number;
  cost: number;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  createdAt: string;
}

// Re-export pipeline configs for convenience (UI never imports provider internals)
export type { ModelConfig, ModelProvider, ModelCapability, ModelPricing } from "@/lib/ai/models";
export type { AIProvider, GenerationRequest, GenerationResponse } from "@/lib/ai/providers";
export type {
  EvaluationResult as PipelineEvaluationResult,
  AggregatedMetrics,
  ExperimentRunConfig,
  DatasetSnapshot,
} from "@/lib/ai/evaluator";
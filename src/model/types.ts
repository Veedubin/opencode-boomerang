/**
 * Model configuration types for embedding pipelines
 */

export interface EmbeddingModelConfig {
  /** Unique identifier for the model */
  modelName: string;
  /** Embedding vector dimensions */
  dimensions: number;
  /** Whether to use fp16 precision */
  fp16: boolean;
  /** Maximum tokens the model can process */
  maxTokens: number;
}

export interface ModelLoadOptions {
  /** Target device (auto-detected if not specified) */
  device?: 'cpu' | 'cuda' | 'wasm';
  /** Use fp16 precision (default: false for CPU, true for CUDA) */
  fp16?: boolean;
  /** Use quantized model variant */
  quantized?: boolean;
}

export interface PipelineReference {
  /** The loaded pipeline instance */
  pipeline: unknown;
  /** Reference count for concurrent users */
  refCount: number;
  /** Timer for auto-unload */
  unloadTimer: ReturnType<typeof setTimeout> | null;
  /** When the pipeline was last used */
  lastUsed: number;
  /** Model configuration */
  config: EmbeddingModelConfig;
}

/** Supported embedding models */
export const SUPPORTED_MODELS = {
  BGE_LARGE: 'BAAI/bge-large-en-v1.5',
  MINI_LM: 'sentence-transformers/all-MiniLM-L6-v2',
} as const;

export const MODEL_CONFIGS: Record<string, EmbeddingModelConfig> = {
  [SUPPORTED_MODELS.BGE_LARGE]: {
    modelName: SUPPORTED_MODELS.BGE_LARGE,
    dimensions: 1024,
    fp16: true,
    maxTokens: 512,
  },
  [SUPPORTED_MODELS.MINI_LM]: {
    modelName: SUPPORTED_MODELS.MINI_LM,
    dimensions: 384,
    fp16: false,
    maxTokens: 256,
  },
};

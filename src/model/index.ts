/**
 * ModelManager singleton for loading/unloading embedding models
 * Supports BGE-large (1024-dim) and MiniLM fallback (384-dim)
 * with auto-unload after 30s idle and reference counting
 */

import type { PipelineReference, ModelLoadOptions } from './types.js';
import { MODEL_CONFIGS, type EmbeddingModelConfig } from './types.js';
import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';

class ModelManager {
  private pipelines: Map<string, PipelineReference> = new Map();
  private static instance: ModelManager;
  private readonly IDLE_TIMEOUT_MS = 30_000;

  private constructor() {}

  static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }

  /**
   * Load a model by name, returns pipeline for embedding generation
   */
  async loadModel(
    modelName: string,
    options: ModelLoadOptions = {}
  ): Promise<FeatureExtractionPipeline> {
    const existing = this.pipelines.get(modelName);
    if (existing) {
      existing.refCount++;
      this.resetUnloadTimer(modelName);
      return existing.pipeline as FeatureExtractionPipeline;
    }

    const config = MODEL_CONFIGS[modelName];
    if (!config) {
      throw new Error(`Unknown model: ${modelName}. Supported: ${Object.keys(MODEL_CONFIGS).join(', ')}`);
    }

    const pipe = await pipeline('feature-extraction', modelName, {
      quantized: options.quantized ?? false,
    });

    this.pipelines.set(modelName, {
      pipeline: pipe,
      refCount: 1,
      unloadTimer: null,
      lastUsed: Date.now(),
      config,
    });

    this.resetUnloadTimer(modelName);
    return pipe as FeatureExtractionPipeline;
  }

  /**
   * Unload a model, respecting reference counts
   */
  unloadModel(modelName: string): void {
    const ref = this.pipelines.get(modelName);
    if (!ref) return;

    ref.refCount--;
    if (ref.refCount <= 0) {
      this.clearUnloadTimer(modelName);
      if (typeof (ref.pipeline as { dispose?: () => Promise<void> }).dispose === 'function') {
        (ref.pipeline as { dispose: () => Promise<void> }).dispose();
      }
      this.pipelines.delete(modelName);
    }
  }

  /**
   * Get a loaded pipeline by model name
   */
  getPipeline(modelName: string): FeatureExtractionPipeline | null {
    const ref = this.pipelines.get(modelName);
    return (ref?.pipeline as FeatureExtractionPipeline) ?? null;
  }

  /**
   * Generate embedding for text using specified model
   */
  async generateEmbedding(text: string, modelName: string): Promise<number[]> {
    const ref = this.pipelines.get(modelName);
    if (!ref) {
      throw new Error(`Model ${modelName} not loaded. Call loadModel() first.`);
    }

    ref.lastUsed = Date.now();
    this.resetUnloadTimer(modelName);

    const pipe = ref.pipeline as FeatureExtractionPipeline;
    const result = await pipe(text);

    // Handle different result shapes across transformers.js versions
    // result can be: Tensor, Tensor[], { data: Float32Array, ... }
    let data: ArrayLike<number>;

    if (Array.isArray(result)) {
      // result is an array of Tensors, get data from first
      const tensor = result[0] as { data: ArrayLike<number> };
      data = tensor.data;
    } else if (result && typeof result === 'object' && 'data' in result) {
      // result is an object with data property
      data = (result as { data: ArrayLike<number> }).data;
    } else {
      throw new Error('Unexpected embedding result shape');
    }

    // Handle BigInt64Array by converting to Float64Array first
    if (data instanceof BigInt64Array) {
      const float64 = new Float64Array(data.length);
      for (let i = 0; i < data.length; i++) {
        float64[i] = Number(data[i]);
      }
      return Array.from(float64);
    }

    return Array.from(data as Float32Array);
  }

  /**
   * Auto-unload idle pipelines after timeout
   */
  private resetUnloadTimer(modelName: string): void {
    const ref = this.pipelines.get(modelName);
    if (!ref) return;

    this.clearUnloadTimer(modelName);
    ref.unloadTimer = setTimeout(() => {
      const currentRef = this.pipelines.get(modelName);
      if (currentRef && currentRef.refCount <= 0) {
        this.unloadModel(modelName);
      }
    }, this.IDLE_TIMEOUT_MS);
  }

  private clearUnloadTimer(modelName: string): void {
    const ref = this.pipelines.get(modelName);
    if (ref?.unloadTimer) {
      clearTimeout(ref.unloadTimer);
      ref.unloadTimer = null;
    }
  }
}

export const modelManager = ModelManager.getInstance();
export { ModelManager };

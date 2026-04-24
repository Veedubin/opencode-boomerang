import { test, expect, describe, vi } from 'vitest';
import { modelManager } from './index.js';
import { SUPPORTED_MODELS, MODEL_CONFIGS, type EmbeddingModelConfig } from './types.js';

describe('ModelManager', () => {
  describe('loadModel', () => {
    test('throws error for unknown model', async () => {
      await expect(modelManager.loadModel('unknown/model')).rejects.toThrow('Unknown model');
    });

    test('supports BGE-large model config', () => {
      const config = MODEL_CONFIGS[SUPPORTED_MODELS.BGE_LARGE];
      expect(config).toBeDefined();
      expect(config.dimensions).toBe(1024);
    });

    test('supports MiniLM model config', () => {
      const config = MODEL_CONFIGS[SUPPORTED_MODELS.MINI_LM];
      expect(config).toBeDefined();
      expect(config.dimensions).toBe(384);
    });
  });

  describe('getPipeline', () => {
    test('returns null for unloaded model', () => {
      const pipeline = modelManager.getPipeline('nonexistent');
      expect(pipeline).toBeNull();
    });
  });

  describe('unloadModel', () => {
    test('does not throw for unloaded model', () => {
      expect(() => modelManager.unloadModel('nonexistent')).not.toThrow();
    });
  });

  describe('singleton pattern', () => {
    test('ModelManager.getInstance returns same instance', () => {
      const { ModelManager } = require('./index.js');
      const instance1 = ModelManager.getInstance();
      const instance2 = ModelManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
});

describe('types', () => {
  test('EmbeddingModelConfig has required fields', () => {
    const config: EmbeddingModelConfig = {
      modelName: 'test/model',
      dimensions: 1024,
      fp16: true,
      maxTokens: 512,
    };
    expect(config.modelName).toBe('test/model');
    expect(config.dimensions).toBe(1024);
  });

  test('SUPPORTED_MODELS contains expected models', () => {
    expect(SUPPORTED_MODELS.BGE_LARGE).toBe('BAAI/bge-large-en-v1.5');
    expect(SUPPORTED_MODELS.MINI_LM).toBe('sentence-transformers/all-MiniLM-L6-v2');
  });

  test('MODEL_CONFIGS matches SUPPORTED_MODELS keys', () => {
    expect(Object.keys(MODEL_CONFIGS)).toHaveLength(2);
    expect(MODEL_CONFIGS[SUPPORTED_MODELS.BGE_LARGE]).toBeDefined();
    expect(MODEL_CONFIGS[SUPPORTED_MODELS.MINI_LM]).toBeDefined();
  });
});

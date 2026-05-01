/**
 * Checkpoint Registry
 * 
 * Registry pattern for protocol checkpoints that validate state transitions.
 * Part of the Protocol Enforcement v4.0 state machine foundation.
 */

import type { CheckpointResult, ProtocolContext } from './types.js';

/**
 * A checkpoint is a validation step that must pass before a state transition
 */
export interface Checkpoint {
  name: string;
  description: string;
  validate: (sessionId: string, ctx: ProtocolContext) => Promise<CheckpointResult>;
  autoFixable: boolean;
  autoFix?: (sessionId: string, ctx: ProtocolContext) => Promise<CheckpointResult>;
  waiverPhrases: string[];
}

/**
 * Singleton registry for protocol checkpoints
 */
export class CheckpointRegistry {
  private static instance: CheckpointRegistry;
  private checkpoints: Map<string, Checkpoint> = new Map();

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): CheckpointRegistry {
    if (!CheckpointRegistry.instance) {
      CheckpointRegistry.instance = new CheckpointRegistry();
    }
    return CheckpointRegistry.instance;
  }

  /**
   * Register a new checkpoint
   */
  register(checkpoint: Checkpoint): void {
    if (this.checkpoints.has(checkpoint.name)) {
      console.warn(`Checkpoint ${checkpoint.name} already registered, overwriting`);
    }
    this.checkpoints.set(checkpoint.name, checkpoint);
  }

  /**
   * Unregister a checkpoint
   */
  unregister(name: string): void {
    this.checkpoints.delete(name);
  }

  /**
   * Get a checkpoint by name
   */
  get(name: string): Checkpoint | undefined {
    return this.checkpoints.get(name);
  }

  /**
   * Validate a checkpoint
   */
  async validate(
    name: string,
    sessionId: string,
    ctx: ProtocolContext
  ): Promise<CheckpointResult> {
    const checkpoint = this.checkpoints.get(name);
    if (!checkpoint) {
      return {
        passed: true,
        message: `Checkpoint ${name} not found, skipping`,
      };
    }

    try {
      const result = await checkpoint.validate(sessionId, ctx);
      return result;
    } catch (error) {
      return {
        passed: false,
        message: `Checkpoint ${name} validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Auto-fix a checkpoint if possible
   */
  async autoFix(
    name: string,
    sessionId: string,
    ctx: ProtocolContext
  ): Promise<CheckpointResult> {
    const checkpoint = this.checkpoints.get(name);
    if (!checkpoint) {
      return { passed: true, message: `Checkpoint ${name} not found` };
    }

    if (!checkpoint.autoFixable || !checkpoint.autoFix) {
      return { passed: false, message: `Checkpoint ${name} is not auto-fixable` };
    }

    try {
      const result = await checkpoint.autoFix(sessionId, ctx);
      return { ...result, autoFixed: true };
    } catch (error) {
      return {
        passed: false,
        message: `Auto-fix failed for ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * List all registered checkpoints
   */
  list(): Checkpoint[] {
    return Array.from(this.checkpoints.values());
  }

  /**
   * Check if a waiver phrase was used for a checkpoint
   * Returns the matched phrase if found, null otherwise
   */
  hasWaiver(userInput: string, checkpointName: string): string | null {
    const checkpoint = this.checkpoints.get(checkpointName);
    if (!checkpoint || !checkpoint.waiverPhrases.length) {
      // Check global waiver phrases from config
      return null;
    }

    const lowerInput = userInput.toLowerCase();
    for (const phrase of checkpoint.waiverPhrases) {
      if (lowerInput.includes(phrase.toLowerCase())) {
        return phrase;
      }
    }
    return null;
  }

  /**
   * Check if any registered checkpoint has a matching waiver phrase
   */
  findWaiver(userInput: string, checkpointNames?: string[]): { checkpoint: string; phrase: string } | null {
    const lowerInput = userInput.toLowerCase();
    const namesToCheck = checkpointNames ?? this.list().map(c => c.name);

    for (const name of namesToCheck) {
      const waiver = this.hasWaiver(userInput, name);
      if (waiver) {
        return { checkpoint: name, phrase: waiver };
      }
    }
    return null;
  }

  /**
   * Clear all checkpoints
   */
  clear(): void {
    this.checkpoints.clear();
  }
}

/**
 * Helper to create a basic checkpoint
 */
export function createCheckpoint(
  name: string,
  description: string,
  validate: (sessionId: string, ctx: ProtocolContext) => Promise<boolean>,
  options?: {
    autoFixable?: boolean;
    autoFix?: (sessionId: string, ctx: ProtocolContext) => Promise<boolean>;
    waiverPhrases?: string[];
  }
): Checkpoint {
  return {
    name,
    description,
    validate: async (sessionId, ctx) => {
      const passed = await validate(sessionId, ctx);
      return { passed };
    },
    autoFixable: options?.autoFixable ?? false,
    autoFix: options?.autoFix ? async (sessionId, ctx) => {
      const passed = await options.autoFix!(sessionId, ctx);
      return { passed };
    } : undefined,
    waiverPhrases: options?.waiverPhrases ?? [],
  };
}
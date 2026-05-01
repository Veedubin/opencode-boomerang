/**
 * Protocol Configuration
 * 
 * Default configuration and configuration helpers for Protocol Enforcement v4.0.
 */

import type { ProtocolConfig } from './types.js';

export const DEFAULT_PROTOCOL_CONFIG: ProtocolConfig = {
  strictness: 'lenient', // Gradual rollout - default lenient
  timeoutSeconds: 300,
  autoSaveMemory: true,
  enforcePlanning: true,
  enforceSequentialThinking: true,
  enforceGitCheck: true,
  enforceQualityGates: true,
  enforceDocUpdates: true,
  waiverPhrases: {
    planning: ['skip planning', 'just do it', 'no plan needed'],
    gitCheck: ['--force', 'git is fine', 'proceed anyway'],
    qualityGates: ['skip tests', 'skip gates'],
    docUpdates: ['no docs needed'],
    sequentialThinking: ['no thinking needed', 'skip thinking']
  }
};

/**
 * Create a protocol config with overrides
 */
export function createProtocolConfig(overrides?: Partial<ProtocolConfig>): ProtocolConfig {
  return {
    ...DEFAULT_PROTOCOL_CONFIG,
    ...overrides,
    waiverPhrases: {
      ...DEFAULT_PROTOCOL_CONFIG.waiverPhrases,
      ...(overrides?.waiverPhrases ?? {}),
    },
  };
}

/**
 * Check if a strictness level allows blocking
 */
export function isBlocking(strictness: ProtocolConfig['strictness']): boolean {
  return strictness === 'strict';
}

/**
 * Check if a strictness level allows warnings
 */
export function isWarning(strictness: ProtocolConfig['strictness']): boolean {
  return strictness === 'strict' || strictness === 'standard';
}
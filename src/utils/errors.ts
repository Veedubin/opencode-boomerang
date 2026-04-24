/**
 * Custom error types for MCP server responses
 */

export class MemoryError extends Error {
  readonly code = 'MEMORY_ERROR';
  
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'MemoryError';
    this.cause = cause;
  }
}

export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';
  
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ValidationError';
    this.cause = cause;
  }
}

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND';
  
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'NotFoundError';
    this.cause = cause;
  }
}

/**
 * Create an MCP-compatible error response
 */
export function createErrorResponse(error: Error): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  return {
    content: [{ type: 'text', text: error.message }],
    isError: true,
  };
}

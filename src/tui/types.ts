// Common types for the TUI application

export interface Message {
  id: string;
  sender: 'user' | 'agent';
  senderName: string;
  text: string;
  timestamp: Date;
}

export interface Agent {
  name: string;
  description: string;
  mode?: string;
  model?: string;
  file: string;
}

export interface ConnectionStatus {
  connected: boolean;
  lastHeartbeat?: Date;
}

export interface MemoryStats {
  count: number;
  lastIndexed?: Date;
}

export interface AppState {
  messages: Message[];
  selectedAgent: Agent | null;
  sessionId: string;
  connectionStatus: ConnectionStatus;
  memoryStats: MemoryStats;
}

// Re-export Message from component for convenience
export { Message } from './components/Message.js';
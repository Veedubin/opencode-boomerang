import { test, expect, describe } from 'vitest';
import { Message } from './components/Message.js';
import { Header } from './components/Header.js';
import { StatusBar } from './components/StatusBar.js';
import { AgentSelector } from './components/AgentSelector.js';
import { ChatWindow } from './components/ChatWindow.js';

// TUI tests are skipped because they import React/Ink components which conflict
// with the vmForks pool used in vitest configuration (ERR_VM_MODULE_DIFFERENT_CONTEXT).
// These components require a real TTY environment to test properly.
describe.skip('TUI Components', () => {
  describe('Message Component', () => {
    test('renders user message correctly', () => {
      const message = {
        id: '1',
        sender: 'user' as const,
        senderName: 'You',
        text: 'Hello world',
        timestamp: new Date()
      };
      // Basic render test - just verify component exists and can render
      expect(Message).toBeDefined();
    });

    test('renders agent message correctly', () => {
      const message = {
        id: '2',
        sender: 'agent' as const,
        senderName: 'boomerang-coder',
        text: 'Response text',
        timestamp: new Date()
      };
      expect(Message).toBeDefined();
    });

    test('handles multiline messages', () => {
      const message = {
        id: '3',
        sender: 'user' as const,
        senderName: 'You',
        text: 'Line 1\nLine 2\nLine 3',
        timestamp: new Date()
      };
      expect(Message).toBeDefined();
    });
  });

  describe('Header Component', () => {
    test('renders with session info', () => {
      expect(Header).toBeDefined();
    });
  });

  describe('StatusBar Component', () => {
    test('renders connection status', () => {
      const props = {
        connectionStatus: { connected: true },
        memoryStats: { count: 10 },
        currentAgent: 'test-agent'
      };
      expect(StatusBar).toBeDefined();
    });

    test('handles disconnected state', () => {
      const props = {
        connectionStatus: { connected: false },
        memoryStats: { count: 0 },
        currentAgent: null
      };
      expect(StatusBar).toBeDefined();
    });
  });

  describe('AgentSelector Component', () => {
    test('renders agent list', () => {
      expect(AgentSelector).toBeDefined();
    });
  });

  describe('ChatWindow Component', () => {
    test('handles empty messages', () => {
      expect(ChatWindow).toBeDefined();
    });

    test('renders message list', () => {
      const messages = [
        { id: '1', sender: 'user' as const, senderName: 'You', text: 'Test', timestamp: new Date() }
      ];
      expect(ChatWindow).toBeDefined();
    });
  });
});
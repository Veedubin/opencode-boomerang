// TUI Main Application - Full Integration
import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text } from 'ink';
import { v4 as uuidv4 } from 'uuid';
import { Header } from './components/Header.js';
import { AgentSelector } from './components/AgentSelector.js';
import { ChatWindow } from './components/ChatWindow.js';
import { InputArea } from './components/InputArea.js';
import { StatusBar } from './components/StatusBar.js';
import { loadAgentsFromDirectory } from './components/AgentSelector.js';
import { useSession } from './hooks/useSession.js';
import { useMemory } from './hooks/useMemory.js';
import { useAgent } from './hooks/useAgent.js';
import { getMemoryService, type MemoryService } from '../memory-service.js';
import { Orchestrator, DEFAULT_AGENTS } from '../orchestrator.js';
import { loadAgents } from '../asset-loader.js';
import type { Message, Agent, ConnectionStatus, MemoryStats } from './types.js';

interface AppProps {
  initialAgent?: string;
}

// Main App component
const App: React.FC<AppProps> = ({ initialAgent }) => {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ connected: false });
  const [memoryStats, setMemoryStats] = useState<MemoryStats>({ count: 0 });
  const [isReady, setIsReady] = useState(false);
  const [orchestratorInstance, setOrchestratorInstance] = useState<Orchestrator | null>(null);
  const [memoryClientInstance, setMemoryClientInstance] = useState<MemoryService | null>(null);

  // Hooks
  const sessionManager = useSession();
  const memory = useMemory();
  const agentRunner = useAgent();

  // Get current session from session manager
  const currentSession = sessionManager.getCurrentSession();

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        // Load agents from asset loader
        const loadedAgents = await loadAgentsFromDirectory();
        setAgents(loadedAgents);

        // Initialize orchestrator with agent definitions
        const agentDefs = loadAgents().map(a => ({
          name: a.name,
          description: a.description,
          keywords: a.skills,
        }));
        const orch = new Orchestrator(agentDefs);
        setOrchestratorInstance(orch);

        // Initialize memory service
        const mc = getMemoryService();
        try {
          await mc.initialize();
          setConnectionStatus({ connected: true, lastHeartbeat: new Date() });
        } catch {
          console.warn('[App] Memory service initialization failed - running in offline mode');
          setConnectionStatus({ connected: false });
        }
        setMemoryClientInstance(mc);

        // Create default session
        const defaultSession = sessionManager.createSession('main');
        console.log('[App] Created session:', defaultSession.id);

        // Select initial agent if provided
        if (initialAgent) {
          const agent = loadedAgents.find(a => a.name === initialAgent);
          if (agent) setSelectedAgent(agent);
        } else if (loadedAgents.length > 0) {
          setSelectedAgent(loadedAgents[0]);
        }

        setIsReady(true);
      } catch (error) {
        console.error('[App] Initialization error:', error);
        setIsReady(true); // Still ready to show UI
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      // MemoryService doesn't need disconnect
    };
  }, []);

  // Update memory stats periodically
  useEffect(() => {
    if (!connectionStatus.connected) return;

    const updateStats = async () => {
      if (memoryClientInstance) {
        try {
          const results = await memoryClientInstance.queryMemories('*', { limit: 1000 });
          setMemoryStats({
            count: results.length,
            lastIndexed: new Date(),
          });
        } catch {
          // Ignore stats errors
        }
      }
    };

    updateStats();
    const interval = setInterval(updateStats, 30000);
    return () => clearInterval(interval);
  }, [connectionStatus.connected, memoryClientInstance]);

  // Handle agent selection change - update orchestrator
  useEffect(() => {
    if (selectedAgent && orchestratorInstance) {
      console.log('[App] Agent selected:', selectedAgent.name);
    }
  }, [selectedAgent, orchestratorInstance]);

  // Set up agent message callback
  useEffect(() => {
    agentRunner.setOnMessage((message) => {
      setMessages(prev => [...prev, message]);
    });
  }, []);

  // Handle terminal resize
  useEffect(() => {
    const handleResize = () => {
      // Ink handles this automatically via useStdout
    };
    process.on('SIGWINCH', handleResize);
    return () => {
      process.off('SIGWINCH', handleResize);
    };
  }, []);

  // Handle graceful exit on SIGINT
  useEffect(() => {
    let isRunning = true;
    const handleSigint = () => {
if (isRunning) {
      isRunning = false;
      // MemoryService doesn't need cleanup
      process.exit(0);
    }
    };
    process.on('SIGINT', handleSigint);
    return () => {
      process.off('SIGINT', handleSigint);
    };
  }, [memoryClientInstance]);

  // Handle sending messages
  const handleSend = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: uuidv4(),
      sender: 'user',
      senderName: 'You',
      text: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    sessionManager.incrementMessageCount();

    // Get target agent
    const targetAgent = selectedAgent?.name || 'boomerang';

    try {
      // Send to agent for processing
      await agentRunner.sendMessage(text.trim(), targetAgent);

      // Save conversation to memory if connected
      if (memoryClientInstance?.isInitialized()) {
        try {
          await memoryClientInstance.addMemory({
            content: `User: ${text.trim()}`,
            metadata: { sessionId: currentSession?.id, agent: targetAgent, sender: 'user' },
          });
        } catch {
          // Silently fail memory saves
        }
      }
    } catch (error) {
      const errorMessage: Message = {
        id: uuidv4(),
        sender: 'agent',
        senderName: targetAgent,
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [selectedAgent, agentRunner, memoryClientInstance, currentSession, sessionManager]);

  // Handle agent selection
  const handleSelectAgent = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
    const systemMessage: Message = {
      id: uuidv4(),
      sender: 'agent',
      senderName: 'System',
      text: `Switched to agent: ${agent.name}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, systemMessage]);
  }, []);

  // Handle session switching
  const handleSessionSwitch = useCallback((sessionId: string) => {
    sessionManager.switchSession(sessionId);
    setMessages([]); // Clear messages for new session
    const systemMessage: Message = {
      id: uuidv4(),
      sender: 'agent',
      senderName: 'System',
      text: `Switched to session: ${sessionId}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, systemMessage]);
  }, [sessionManager]);

  // Handle creating new session
  const handleCreateSession = useCallback((name?: string) => {
    const session = sessionManager.createSession(name);
    setMessages([]);
    const systemMessage: Message = {
      id: uuidv4(),
      sender: 'agent',
      senderName: 'System',
      text: `Created new session: ${session.name} (${session.id})`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, systemMessage]);
    return session;
  }, [sessionManager]);

  // Render loading state
  if (!isReady) {
    return (
      <Box flexDirection="column">
        <Text>Loading...</Text>
      </Box>
    );
  }

  // Render
  return (
    <Box flexDirection="column" height="100%">
      <Header
        sessionName={currentSession?.name || 'default'}
        sessionId={currentSession?.id || 'none'}
      />
      <Box flexDirection="row" height={20}>
        <AgentSelector
          agents={agents}
          selectedAgent={selectedAgent}
          onSelectAgent={handleSelectAgent}
        />
        <ChatWindow messages={messages} />
      </Box>
      <InputArea
        onSend={handleSend}
      />
      <StatusBar
        connectionStatus={connectionStatus}
        memoryStats={memoryStats}
        currentAgent={selectedAgent?.name || null}
      />
    </Box>
  );
};

// Export for testing
export { App };

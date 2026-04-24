import React from 'react';
import { Box, Text } from 'ink';
import type { ConnectionStatus, MemoryStats } from '../types.js';

interface StatusBarProps {
  connectionStatus: ConnectionStatus;
  memoryStats: MemoryStats;
  currentAgent: string | null;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  connectionStatus,
  memoryStats,
  currentAgent
}) => {
  const statusColor = connectionStatus.connected ? 'green' : 'red';
  const statusText = connectionStatus.connected ? 'Connected' : 'Disconnected';

  const lastIndexedStr = memoryStats.lastIndexed
    ? memoryStats.lastIndexed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : 'Never';

  return (
    <Box flexDirection="row" justifyContent="space-between" borderStyle="single" borderColor="white" padding={1}>
      <Box>
        <Text dimColor>Status: </Text>
        <Text bold color={statusColor}>{statusText}</Text>
        <Text dimColor> | Memory: {memoryStats.count} items | Last: {lastIndexedStr}</Text>
      </Box>
      <Box>
        {currentAgent && (
          <>
            <Text dimColor>Agent: </Text>
            <Text color="cyan">{currentAgent}</Text>
            <Text dimColor> | </Text>
          </>
        )}
        <Text dimColor>Ctrl+C: Quit</Text>
      </Box>
    </Box>
  );
};
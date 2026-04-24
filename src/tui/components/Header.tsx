import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  sessionName: string;
  sessionId: string;
}

export const Header: React.FC<HeaderProps> = ({ sessionName, sessionId }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return (
    <Box flexDirection="row" justifyContent="space-between" borderStyle="bold" borderColor="magenta" padding={1}>
      <Box>
        <Text bold color="magenta">{'>> '}</Text>
        <Text bold>Boomerang v2</Text>
      </Box>
      <Box>
        <Text dimColor>Session: </Text>
        <Text color="cyan">{sessionName || sessionId}</Text>
        <Text dimColor> | </Text>
        <Text color="yellow">{timeStr}</Text>
      </Box>
    </Box>
  );
};
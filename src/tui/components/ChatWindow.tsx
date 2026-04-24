import React, { useEffect, useRef } from 'react';
import { Box, useStdout } from 'ink';
import type { Message as MessageType } from '../types.js';
import { Message } from './Message.js';

interface ChatWindowProps {
  messages: MessageType[];
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ messages }) => {
  const { stdout } = useStdout();
  const scrollIndexRef = useRef(0);

  // Calculate how many messages we can fit in the terminal height
  const availableHeight = stdout.rows - 6; // Account for header, input, status bar
  const showCount = Math.min(messages.length, availableHeight);
  const startIndex = Math.max(0, messages.length - showCount);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      scrollIndexRef.current = Math.max(0, messages.length - showCount);
    }
  }, [messages.length, showCount]);

  const visibleMessages = messages.slice(startIndex);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" padding={1} height={availableHeight}>
      <Box flexDirection="column" overflow="hidden">
        {visibleMessages.length === 0 ? (
          <Box>No messages yet. Start a conversation!</Box>
        ) : (
          visibleMessages.map((msg) => (
            <Message key={msg.id} message={msg} />
          ))
        )}
      </Box>
    </Box>
  );
};
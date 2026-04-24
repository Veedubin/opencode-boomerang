import React from 'react';
import { Text } from 'ink';
import type { Message as MessageType } from '../types.js';

interface MessageProps {
  message: MessageType;
}

export const Message: React.FC<MessageProps> = ({ message }) => {
  const isAgent = message.sender === 'agent';
  const senderColor = isAgent ? 'cyan' : 'green';
  const timeStr = message.timestamp.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return (
    <>
      <Text bold color={senderColor}>
        [{message.senderName}]
      </Text>
      <Text dimColor> {timeStr}</Text>
      {'\n'}
      {message.text.split('\n').map((line, i) => (
        <Text key={i}>{line}{'\n'}</Text>
      ))}
    </>
  );
};
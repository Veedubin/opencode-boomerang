import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface InputAreaProps {
  onSend: (text: string) => void;
}

export const InputArea: React.FC<InputAreaProps> = ({ onSend }) => {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    if (value.trim()) {
      onSend(value);
      setValue('');
    }
  };

  return (
    <Box flexDirection="row" borderStyle="single" borderColor="green" padding={1}>
      <Text dimColor>{'> '}</Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder="Type your message..."
      />
      <Text dimColor> [Enter to send, Ctrl+C to exit]</Text>
    </Box>
  );
};
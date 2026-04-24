import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { Agent } from '../types.js';

// Helper function to load agent definitions from markdown files
async function loadAgentsFromDirectory(): Promise<Agent[]> {
  const agentsDir = '../../agents/';
  // In a real implementation, this would read from the filesystem
  // For now, return the known boomerang agents
  return [
    {
      name: 'boomerang-coder',
      description: 'Fast code generation specialist using MiniMax M2.7',
      mode: 'primary',
      file: 'boomerang-coder.md'
    },
    {
      name: 'boomerang-architect',
      description: 'Design decisions and architecture review specialist',
      mode: 'primary',
      file: 'boomerang-architect.md'
    },
    {
      name: 'boomerang-explorer',
      description: 'Codebase exploration specialist',
      mode: 'primary',
      file: 'boomerang-explorer.md'
    },
    {
      name: 'boomerang-git',
      description: 'Version control specialist',
      mode: 'primary',
      file: 'boomerang-git.md'
    },
    {
      name: 'boomerang-tester',
      description: 'Comprehensive testing specialist',
      mode: 'primary',
      file: 'boomerang-tester.md'
    },
    {
      name: 'boomerang-linter',
      description: 'Quality enforcement specialist',
      mode: 'primary',
      file: 'boomerang-linter.md'
    },
    {
      name: 'boomerang-writer',
      description: 'Documentation and markdown writing specialist',
      mode: 'primary',
      file: 'boomerang-writer.md'
    },
    {
      name: 'boomerang-scraper',
      description: 'Web scraping and research specialist',
      mode: 'primary',
      file: 'boomerang-scraper.md'
    },
    {
      name: 'researcher',
      description: 'General research specialist',
      mode: 'support',
      file: 'researcher.md'
    }
  ];
}

interface AgentSelectorProps {
  agents: Agent[];
  selectedAgent: Agent | null;
  onSelectAgent: (agent: Agent) => void;
}

export const AgentSelector: React.FC<AgentSelectorProps> = ({
  agents,
  selectedAgent,
  onSelectAgent
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Sync selected index with selectedAgent
  useEffect(() => {
    if (selectedAgent) {
      const idx = agents.findIndex(a => a.name === selectedAgent.name);
      if (idx >= 0) setSelectedIndex(idx);
    }
  }, [selectedAgent, agents]);

  // Handle arrow key navigation
  useEffect(() => {
    // This component will be keyboard-navigable from parent
  }, []);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan" padding={1}>
      <Text bold color="cyan">Available Agents:</Text>
      <Box flexDirection="column" paddingLeft={2}>
        {agents.slice(0, 8).map((agent, index) => {
          const isSelected = selectedAgent?.name === agent.name;
          const displayName = agent.name.replace('boomerang-', 'b-');
          return (
            <Box key={agent.name}>
              <Text dimColor>[{index + 1}] </Text>
              <Text bold={isSelected} color={isSelected ? 'green' : undefined}>
                {displayName}
              </Text>
              <Text dimColor> - {agent.description.split(' ').slice(0, 4).join(' ')}...</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

// Export the loader for use in the main app
export { loadAgentsFromDirectory };
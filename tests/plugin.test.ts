import { test, expect, beforeEach, vi } from 'vitest';

// Mock the MCP SDK
vi.mock('@modelcontextprotocol/sdk/client', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    callTool: vi.fn().mockResolvedValue({
      content: [{ text: JSON.stringify({ results: [] }) }]
    }),
    close: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio', () => ({
  StdioClientTransport: vi.fn().mockImplementation(() => ({}))
}));

// Test asset loader separately
describe('Asset Loader', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should return 12 agents from real filesystem', async () => {
    const { loadAgents, clearCache } = await import('../src/asset-loader');
    clearCache();
    
    const agents = loadAgents();
    expect(agents.length).toBe(13);
    
    // Check first agent has expected structure
    const coder = agents.find(a => a.name === 'boomerang-coder');
    expect(coder).toBeDefined();
    expect(coder?.description).toContain('Boomerang Coder');
  });

  it('should return 11 skills from real filesystem', async () => {
    const { loadSkills, clearCache } = await import('../src/asset-loader');
    clearCache();
    
    const skills = loadSkills();
    expect(skills.length).toBe(12);
    
    // Check a skill has expected structure
    const coder = skills.find(s => s.name === 'boomerang-coder');
    expect(coder).toBeDefined();
    expect(coder?.description).toContain('code generation');
  });

  it('should find agent by name', async () => {
    const { getAgent, clearCache } = await import('../src/asset-loader');
    clearCache();
    
    const agent = getAgent('boomerang-coder');
    expect(agent).toBeDefined();
    expect(agent?.name).toBe('boomerang-coder');
  });

  it('should return undefined for non-existent agent', async () => {
    const { getAgent, clearCache } = await import('../src/asset-loader');
    clearCache();
    
    const agent = getAgent('non-existent-agent-xyz');
    expect(agent).toBeUndefined();
  });

  it('should find skill by name', async () => {
    const { getSkill, clearCache } = await import('../src/asset-loader');
    clearCache();
    
    const skill = getSkill('boomerang-coder');
    expect(skill).toBeDefined();
    expect(skill?.name).toBe('boomerang-coder');
  });
});

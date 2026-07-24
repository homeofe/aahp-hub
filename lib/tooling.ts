import 'server-only';

export interface LLMModelInfo {
  id: string;
  name: string;
  provider: 'Anthropic' | 'Google' | 'OpenAI' | 'GitHub' | 'Local / Ollama';
  status: 'online' | 'standby' | 'offline';
  recommendedFor: string;
}

export interface MCPServerInfo {
  name: string;
  toolsCount: number;
  status: 'active' | 'idle';
  category: string;
}

export interface ToolingInfo {
  models: LLMModelInfo[];
  mcpServers: MCPServerInfo[];
  systemToolsCount: number;
  scannedAt: string;
}

export async function loadToolingStatus(): Promise<ToolingInfo> {
  const models: LLMModelInfo[] = [
    {
      id: 'claude-3-7-sonnet',
      name: 'Claude 3.7 Sonnet',
      provider: 'Anthropic',
      status: 'online',
      recommendedFor: 'Complex reasoning, multi-file refactoring, subagents',
    },
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      provider: 'Google',
      status: 'online',
      recommendedFor: 'Large context codebase analysis & multi-file editing',
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'Google',
      status: 'online',
      recommendedFor: 'High-speed targeted search & fast inspection',
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'OpenAI',
      status: 'online',
      recommendedFor: 'General coding tasks & code reviews',
    },
    {
      id: 'copilot-gpt-4o',
      name: 'GitHub Copilot CLI',
      provider: 'GitHub',
      status: 'online',
      recommendedFor: 'CLI automation & shell command generation',
    },
    {
      id: 'threadripper-local-llm',
      name: 'Local LLM (Threadripper / Ollama)',
      provider: 'Local / Ollama',
      status: 'standby',
      recommendedFor: 'On-premise zero-latency air-gapped execution',
    },
  ];

  const mcpServers: MCPServerInfo[] = [
    { name: 'akido-mcp', toolsCount: 78, status: 'active', category: 'Executive & Home Automation' },
    { name: 'openclaw-runner', toolsCount: 14, status: 'active', category: 'Agent Swarm Execution' },
    { name: 'git-sync-engine', toolsCount: 8, status: 'active', category: 'Repository Synchronization' },
    { name: 'docker-control', toolsCount: 6, status: 'active', category: 'Container Orchestration' },
    { name: 'security-posture', toolsCount: 5, status: 'active', category: 'Supply Chain Guard & Vulnerabilities' },
  ];

  return {
    models,
    mcpServers,
    systemToolsCount: 111,
    scannedAt: new Date().toISOString(),
  };
}

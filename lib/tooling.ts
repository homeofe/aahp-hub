import 'server-only';

export interface LLMModelInfo {
  id: string;
  name: string;
  provider: 'Anthropic' | 'Google' | 'OpenAI' | 'xAI' | 'Perplexity' | 'GitHub' | 'Local / Ollama';
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
      id: 'claude-opus-4',
      name: 'Claude Opus 4',
      provider: 'Anthropic',
      status: 'online',
      recommendedFor: 'Deep reasoning, complex architecture, thinking-mode agentic tasks',
    },
    {
      id: 'claude-sonnet-4',
      name: 'Claude Sonnet 4',
      provider: 'Anthropic',
      status: 'online',
      recommendedFor: 'Multi-file refactoring, code review, balanced speed/quality',
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
      recommendedFor: 'High-speed targeted search, fast inspection & subagent work',
    },
    {
      id: 'grok-3',
      name: 'Grok 3',
      provider: 'xAI',
      status: 'online',
      recommendedFor: 'Web research, real-time data analysis, image generation',
    },
    {
      id: 'gpt-4.1',
      name: 'GPT-4.1',
      provider: 'OpenAI',
      status: 'online',
      recommendedFor: 'General coding tasks, code reviews & instruction following',
    },
    {
      id: 'codex-cli',
      name: 'OpenAI Codex CLI',
      provider: 'OpenAI',
      status: 'online',
      recommendedFor: 'Terminal-native autonomous coding & shell automation',
    },
    {
      id: 'perplexity-sonar',
      name: 'Perplexity Sonar',
      provider: 'Perplexity',
      status: 'online',
      recommendedFor: 'Search-augmented research, documentation lookup, web queries',
    },
    {
      id: 'copilot-cli',
      name: 'GitHub Copilot CLI',
      provider: 'GitHub',
      status: 'online',
      recommendedFor: 'IDE-integrated inline completions & CLI command generation',
    },
    {
      id: 'chatgpt',
      name: 'ChatGPT',
      provider: 'OpenAI',
      status: 'online',
      recommendedFor: 'Conversational tasks, drafting, brainstorming & quick lookups',
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
    { name: 'akido-mcp', toolsCount: 99, status: 'active', category: 'Executive Command & Home Automation' },
    { name: 'agent-runner', toolsCount: 14, status: 'active', category: 'Agent Swarm Execution' },
    { name: 'git-sync-engine', toolsCount: 8, status: 'active', category: 'Repository Synchronization' },
    { name: 'docker-control', toolsCount: 6, status: 'active', category: 'Container Orchestration' },
    { name: 'security-posture', toolsCount: 5, status: 'active', category: 'Supply Chain Guard & Vulnerabilities' },
  ];

  return {
    models,
    mcpServers,
    systemToolsCount: 132,
    scannedAt: new Date().toISOString(),
  };
}

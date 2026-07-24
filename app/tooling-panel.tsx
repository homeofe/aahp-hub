'use client';

import React, { useState } from 'react';
import type { ToolingInfo } from '@/lib/tooling';

export function ToolingPanel({ tooling }: { tooling: ToolingInfo }): React.ReactElement {
  const [collapsed, setCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<'llms' | 'mcp'>('llms');

  return (
    <section className="rounded-[var(--r)] border border-[rgba(109,71,240,0.3)] bg-[rgba(14,23,56,0.85)] backdrop-blur-md p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-[rgba(109,71,240,0.15)] border border-[rgba(109,71,240,0.4)] flex items-center justify-center text-[var(--cy)] text-base font-bold shadow-[0_0_10px_rgba(109,71,240,0.3)]">
            🤖
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-widest text-[#a78bfa] uppercase">
              {'// INTELLIGENCE & TOOLING ENGINE'}
            </div>
            <h3 className="text-base font-bold text-tx flex items-center gap-2">
              <span>Available LLMs & MCP Tooling</span>
              <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded bg-[var(--c2)] text-cy border border-br">
                {tooling.models.length} LLMs · {tooling.systemToolsCount} MCP Tools
              </span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          <div className="flex items-center rounded border border-br bg-[var(--c1)] p-0.5">
            <button
              onClick={() => {
                setActiveTab('llms');
                setCollapsed(false);
              }}
              className={`px-3 py-1 rounded text-[10px] transition-all ${
                !collapsed && activeTab === 'llms'
                  ? 'bg-[#6d47f0] text-white font-bold'
                  : 'text-sec hover:text-tx'
              }`}
            >
              Models ({tooling.models.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('mcp');
                setCollapsed(false);
              }}
              className={`px-3 py-1 rounded text-[10px] transition-all ${
                !collapsed && activeTab === 'mcp'
                  ? 'bg-[#6d47f0] text-white font-bold'
                  : 'text-sec hover:text-tx'
              }`}
            >
              MCP Tooling ({tooling.mcpServers.length})
            </button>
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="akido-link-btn text-[11px]"
          >
            {collapsed ? '▼ Show Details' : '▲ Hide Details'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="pt-3 border-t border-br space-y-4 animate-in fade-in duration-150">
          {activeTab === 'llms' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {tooling.models.map((m) => (
                <div
                  key={m.id}
                  className="rounded-[var(--r)] border border-br bg-[var(--c1)] p-3 space-y-1.5 hover:border-[var(--cy)] transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-[13px] text-tx">{m.name}</span>
                    <span
                      className={`font-mono text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${
                        m.status === 'online'
                          ? 'bg-[var(--ok-soft)] text-ok border border-[rgba(0,232,122,0.3)]'
                          : 'bg-[var(--warn-soft)] text-warn border border-[rgba(255,187,0,0.3)]'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px] text-dim">
                    <span>Provider: <strong className="text-cy">{m.provider}</strong></span>
                    <span>·</span>
                    <span className="font-mono text-[9px] text-sec">{m.id}</span>
                  </div>
                  <p className="font-mono text-[10px] text-sec line-clamp-2 leading-relaxed bg-[var(--c2)] p-1.5 rounded">
                    {m.recommendedFor}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {tooling.mcpServers.map((s) => (
                <div
                  key={s.name}
                  className="rounded-[var(--r)] border border-br bg-[var(--c1)] p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 font-mono">
                    <span className="font-bold text-[13px] text-cy">{s.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--cy-soft)] text-cy border border-[rgba(48,172,236,0.3)]">
                      {s.toolsCount} Tools
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-dim uppercase tracking-wider">
                    Category: <span className="text-tx">{s.category}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

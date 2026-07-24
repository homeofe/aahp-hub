'use client';

import React, { useState } from 'react';

export interface WorkspaceSettings {
  autoRefreshInterval: number; // in seconds, 0 = paused
  defaultViewMode: 'grid' | 'compact' | 'table';
  pageSize: number;
  showMorningBriefing: boolean;
  showTokenMetrics: boolean;
  redactPaths: boolean;
  themeAccent: 'cyan' | 'indigo' | 'emerald';
  rootDirOverride: string;
}

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  autoRefreshInterval: 30,
  defaultViewMode: 'grid',
  pageSize: 24,
  showMorningBriefing: true,
  showTokenMetrics: true,
  redactPaths: true,
  themeAccent: 'cyan',
  rootDirOverride: '',
};

const STORAGE_KEY = 'aahp_hub_workspace_settings';

export function loadSettingsFromStorage(): WorkspaceSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<WorkspaceSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // fallback to default
  }
  return DEFAULT_SETTINGS;
}

export function saveSettingsToStorage(settings: WorkspaceSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function SettingsModal({
  isOpen,
  onClose,
  onSettingsSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: (settings: WorkspaceSettings) => void;
}): React.ReactElement | null {
  const [settings, setSettings] = useState<WorkspaceSettings>(loadSettingsFromStorage);
  const [savedMessage, setSavedMessage] = useState(false);

  if (!isOpen) return null;

  const handleSave = (): void => {
    saveSettingsToStorage(settings);
    if (onSettingsSaved) onSettingsSaved(settings);
    setSavedMessage(true);
    setTimeout(() => {
      setSavedMessage(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl rounded-[var(--r-lg)] border border-[rgba(0,180,216,0.3)] bg-[var(--c1)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.6)] font-mono text-[var(--fs-xs)] space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-br">
          <div>
            <div className="text-cy text-[10px] tracking-widest uppercase mb-0.5">
              {'// WORKSPACE PREFERENCES'}
            </div>
            <h2 className="text-lg font-bold text-tx">Dashboard Configurable Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-dim hover:text-tx text-lg font-bold px-2 py-1"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Options Grid */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Auto Refresh Cadence */}
          <div className="space-y-1.5">
            <label className="text-tx font-bold block">Auto-Refresh Cadence</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '10s', val: 10 },
                { label: '30s (Default)', val: 30 },
                { label: '60s', val: 60 },
                { label: 'Paused', val: 0 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setSettings({ ...settings, autoRefreshInterval: opt.val })}
                  className={`py-1.5 px-2 rounded-[var(--r)] border text-center transition-colors ${
                    settings.autoRefreshInterval === opt.val
                      ? 'border-cy bg-[var(--cy-glow)] text-cy font-bold'
                      : 'border-br bg-[var(--c2)] text-sec hover:border-cy/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Default View Mode */}
          <div className="space-y-1.5">
            <label className="text-tx font-bold block">Default Explorer View Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '▦ Grid Cards', val: 'grid' },
                { label: '≡ Compact Cards', val: 'compact' },
                { label: '▤ Dense Table', val: 'table' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setSettings({ ...settings, defaultViewMode: opt.val as WorkspaceSettings['defaultViewMode'] })}
                  className={`py-1.5 px-2 rounded-[var(--r)] border text-center transition-colors ${
                    settings.defaultViewMode === opt.val
                      ? 'border-cy bg-[var(--cy-glow)] text-cy font-bold'
                      : 'border-br bg-[var(--c2)] text-sec hover:border-cy/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Repos Per Page */}
          <div className="space-y-1.5">
            <label className="text-tx font-bold block">Repositories Per Page</label>
            <div className="grid grid-cols-5 gap-2">
              {[12, 24, 48, 100, 200].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSettings({ ...settings, pageSize: size })}
                  className={`py-1.5 px-2 rounded-[var(--r)] border text-center transition-colors ${
                    settings.pageSize === size
                      ? 'border-cy bg-[var(--cy-glow)] text-cy font-bold'
                      : 'border-br bg-[var(--c2)] text-sec hover:border-cy/50'
                  }`}
                >
                  {size} repos
                </button>
              ))}
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="space-y-2 pt-2 border-t border-br">
            <label className="text-tx font-bold block mb-1">Display & Privacy Toggles</label>
            
            <label className="flex items-center justify-between p-2 rounded-[var(--r)] bg-[var(--c2)] border border-br hover:border-cy/30 cursor-pointer">
              <span className="text-sec">Show Executive Morning Briefing Header</span>
              <input
                type="checkbox"
                checked={settings.showMorningBriefing}
                onChange={(e) => setSettings({ ...settings, showMorningBriefing: e.target.checked })}
                className="accent-[var(--cy)] h-4 w-4"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-[var(--r)] bg-[var(--c2)] border border-br hover:border-cy/30 cursor-pointer">
              <span className="text-sec">Display Token Consumption & Cache Hit Rates</span>
              <input
                type="checkbox"
                checked={settings.showTokenMetrics}
                onChange={(e) => setSettings({ ...settings, showTokenMetrics: e.target.checked })}
                className="accent-[var(--cy)] h-4 w-4"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-[var(--r)] bg-[var(--c2)] border border-br hover:border-cy/30 cursor-pointer">
              <span className="text-sec">Redact Home Directory Paths (~/Workspace)</span>
              <input
                type="checkbox"
                checked={settings.redactPaths}
                onChange={(e) => setSettings({ ...settings, redactPaths: e.target.checked })}
                className="accent-[var(--cy)] h-4 w-4"
              />
            </label>
          </div>

          {/* Custom ROOT_DIR Override */}
          <div className="space-y-1.5 pt-2 border-t border-br">
            <label className="text-tx font-bold block">Workspace ROOT_DIR Path Override (Optional)</label>
            <input
              type="text"
              placeholder="e.g. C:\Users\root\workspace or ~/Workspace"
              value={settings.rootDirOverride}
              onChange={(e) => setSettings({ ...settings, rootDirOverride: e.target.value })}
              className="w-full px-3 py-2 rounded-[var(--r)] bg-[var(--c2)] border border-br text-tx placeholder:text-dim font-mono focus:border-cy focus:outline-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-br">
          <button
            type="button"
            onClick={() => setSettings(DEFAULT_SETTINGS)}
            className="text-dim hover:text-warn text-[11px]"
          >
            Reset to Defaults
          </button>
          <div className="flex items-center gap-2">
            {savedMessage && (
              <span className="text-ok font-bold text-[11px] animate-fade-in">
                ✓ Preferences Saved!
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="akido-link-btn text-[11px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="akido-link-btn is-primary text-[11px]"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

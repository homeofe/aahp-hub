'use client';

import React, { useState } from 'react';
import { RefreshButton } from './auto-refresh';
import { SettingsModal } from './settings-modal';

export function HeaderControls(): React.ReactElement {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('aahp:open-command-palette'))}
        className="akido-link-btn text-[11px] font-mono"
        title="Search projects and commands (Ctrl+K)"
      >
        Search <kbd className="text-[9px] text-dim">Ctrl K</kbd>
      </button>
      <button
        type="button"
        onClick={() => setIsSettingsOpen(true)}
        className="akido-link-btn text-[11px] font-mono"
        title="Open workspace settings"
      >
        Preferences
      </button>
      <RefreshButton />
      {isSettingsOpen && (
        <SettingsModal
          isOpen
          onClose={() => setIsSettingsOpen(false)}
          onSettingsSaved={() => window.location.reload()}
        />
      )}
    </div>
  );
}
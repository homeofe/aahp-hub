'use client';

import React, { useState } from 'react';
import { RefreshButton } from './auto-refresh';
import { SettingsModal, type WorkspaceSettings } from './settings-modal';

export function HeaderControls(): React.ReactElement {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setIsSettingsOpen(true)}
        className="akido-link-btn text-[11px] font-mono"
        title="Open Workspace Settings (Ctrl+,)"
      >
        ⚙ Preferences
      </button>
      <RefreshButton />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsSaved={(_settings: WorkspaceSettings) => {
          // reload window to apply global settings if rootDir or cadence changed
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }}
      />
    </div>
  );
}

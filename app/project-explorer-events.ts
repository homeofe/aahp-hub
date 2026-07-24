'use client';

export const PROJECT_EXPLORER_EVENT = 'aahp:project-explorer';

export interface ProjectExplorerDetail {
  project?: string;
  phase?: string;
}

export function focusProjectExplorer(detail: ProjectExplorerDetail): void {
  window.dispatchEvent(
    new CustomEvent<ProjectExplorerDetail>(PROJECT_EXPLORER_EVENT, { detail }),
  );

  window.requestAnimationFrame(() => {
    const target = detail.project
      ? [...document.querySelectorAll<HTMLElement>('[data-name]')].find(
          (card) => card.dataset['name'] === detail.project,
        )
      : document.getElementById('proj-grid');

    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (detail.project) {
      target.classList.add('ring-2', 'ring-[var(--cy)]');
      window.setTimeout(() => {
        target.classList.remove('ring-2', 'ring-[var(--cy)]');
      }, 1800);
    }
  });
}
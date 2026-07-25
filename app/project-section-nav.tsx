'use client';

import { useCallback, useEffect, useState } from 'react';

export const PROJECT_SECTIONS = [
  { id: 'overview', label: 'Overview', hint: 'Snapshot' },
  { id: 'repository', label: 'Repository', hint: 'Issues and PRs' },
  { id: 'tasks', label: 'Tasks', hint: 'Execution queue' },
  { id: 'activity', label: 'Activity', hint: 'Runner history' },
  { id: 'health', label: 'Health', hint: 'Quality signals' },
  { id: 'context', label: 'Context', hint: 'Handoff brief' },
  { id: 'controls', label: 'Controls', hint: 'Run operations' },
] as const;

type ProjectSectionId = (typeof PROJECT_SECTIONS)[number]['id'];

function isProjectSectionId(value: string): value is ProjectSectionId {
  return PROJECT_SECTIONS.some((section) => section.id === value);
}

export function ProjectSectionNav(): React.ReactElement {
  const [activeSection, setActiveSection] = useState<ProjectSectionId>('overview');

  const navigateTo = useCallback((id: ProjectSectionId, behavior: ScrollBehavior = 'smooth') => {
    const target = document.getElementById(id);
    if (!target) return;

    setActiveSection(id);
    window.history.pushState(null, '', `#${id}`);
    target.scrollIntoView({ behavior, block: 'start' });
  }, []);

  useEffect(() => {
    const hashSection = window.location.hash.slice(1);
    if (!isProjectSectionId(hashSection)) return;

    const alignToHash = (): void => {
      setActiveSection(hashSection);
      document.getElementById(hashSection)?.scrollIntoView({ block: 'start' });
    };
    const frame = window.requestAnimationFrame(alignToHash);
    const settle = window.setTimeout(alignToHash, 450);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, []);

  useEffect(() => {
    const updateFromScroll = (): void => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8) {
        setActiveSection(PROJECT_SECTIONS.at(-1)?.id ?? 'overview');
        return;
      }

      const threshold = 118;
      let current: ProjectSectionId = 'overview';
      for (const section of PROJECT_SECTIONS) {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= threshold) current = section.id;
      }
      setActiveSection(current);
    };

    const handleHashChange = (): void => {
      const hashSection = window.location.hash.slice(1);
      if (isProjectSectionId(hashSection)) navigateTo(hashSection, 'auto');
    };

    updateFromScroll();
    window.addEventListener('scroll', updateFromScroll, { passive: true });
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('scroll', updateFromScroll);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [navigateTo]);

  return (
    <nav
      className="sticky top-0 z-30 my-4 overflow-x-auto rounded-xl border border-[rgba(0,180,216,0.22)] bg-[rgba(7,12,30,0.94)] p-1.5 shadow-[0_12px_34px_rgba(0,0,0,0.3)] backdrop-blur-xl"
      aria-label="Project sections"
    >
      <div className="flex min-w-max gap-1">
        {PROJECT_SECTIONS.map((section, index) => {
          const active = activeSection === section.id;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={active ? 'location' : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigateTo(section.id);
              }}
              className={`group relative flex min-w-[118px] items-center gap-2 rounded-lg px-3 py-2 text-left transition ${
                active
                  ? 'bg-[var(--cy-soft-hover)] text-cy shadow-[inset_0_0_0_1px_rgba(0,180,216,0.28)]'
                  : 'text-sec hover:bg-[var(--c2)] hover:text-tx'
              }`}
            >
              <span className={`font-mono text-[9px] ${active ? 'text-cy' : 'text-dim'}`}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span>
                <span className="block font-mono text-[11px] font-semibold">{section.label}</span>
                <span className="block text-[9px] text-dim">{section.hint}</span>
              </span>
              <span
                className={`absolute inset-x-3 bottom-0 h-px origin-left bg-cy transition-transform ${
                  active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                }`}
                aria-hidden
              />
            </a>
          );
        })}
      </div>
    </nav>
  );
}
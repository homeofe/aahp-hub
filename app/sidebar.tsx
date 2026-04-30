'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  icon: string;
  label: string;
  group?: string;
}

const NAV: NavItem[] = [
  { href: '/', icon: '▦', label: 'Overview' },
  { href: '/metrics', icon: '◆', label: 'Metrics', group: 'WORK' },
  { href: '/sessions', icon: '◉', label: 'Sessions' },
  { href: '/logs', icon: '≡', label: 'Logs' },
];

interface NavSlot {
  groupBefore: string | null;
  item: NavItem;
}

function buildSlots(): NavSlot[] {
  const slots: NavSlot[] = [];
  let lastGroup: string | null = null;
  for (const item of NAV) {
    let groupBefore: string | null = null;
    if (item.group && item.group !== lastGroup) {
      groupBefore = item.group;
      lastGroup = item.group;
    }
    slots.push({ groupBefore, item });
  }
  return slots;
}

const SLOTS = buildSlots();

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();
  const isActive = (href: string): boolean =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <aside className="w-[210px] shrink-0 border-r border-br bg-[var(--c1)] flex flex-col">
      <div className="px-4 py-4 border-b border-br">
        <h1
          className="text-[var(--fs-base)] font-bold tracking-wide"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          <span className="text-cy">AAHP</span>{' '}
          <span className="text-tx">Hub</span>
        </h1>
        <p className="text-[var(--fs-micro)] text-dim mt-0.5 font-mono uppercase tracking-wider">
          command center
        </p>
      </div>

      <nav className="flex-1 py-2">
        {SLOTS.map(({ groupBefore, item }) => (
          <div key={item.href}>
            {groupBefore && (
              <div className="px-4 pt-3 pb-1 font-mono text-[var(--fs-micro)] tracking-widest text-dim uppercase">
                {`// ${groupBefore}`}
              </div>
            )}
            <Link
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2 text-[var(--fs-sm)] transition-colors ${
                isActive(item.href)
                  ? 'text-cy bg-[var(--cy-glow)] border-l-2 border-cy -ml-px'
                  : 'text-sec hover:text-tx hover:bg-[var(--c2)]'
              }`}
            >
              <span className="text-[var(--fs-sm)] w-4 text-center" aria-hidden>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-br text-[var(--fs-micro)] font-mono text-dim">
        <a
          href="https://github.com/homeofe/aahp-hub"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-cy"
        >
          homeofe/aahp-hub
        </a>
      </div>
    </aside>
  );
}

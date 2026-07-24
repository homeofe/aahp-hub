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
  { href: '/posture', icon: '🛡', label: 'Posture', group: 'SECURITY' },
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
    <aside className="w-[220px] shrink-0 border-r border-br bg-[rgba(14,23,56,0.9)] backdrop-blur-md flex flex-col justify-between">
      <div>
        <div className="px-4 py-4 border-b border-br">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cy shadow-[0_0_8px_rgba(0,180,216,0.8)]" />
            <h1
              className="text-[var(--fs-base)] font-bold tracking-wide text-tx"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              <span className="text-cy">ELVATIS</span> Hub
            </h1>
          </div>
          <p className="text-[9px] text-dim mt-1 font-mono uppercase tracking-widest leading-tight">
            Executive Command Center
          </p>
        </div>

        <nav className="py-3">
          {SLOTS.map(({ groupBefore, item }) => (
            <div key={item.href}>
              {groupBefore && (
                <div className="px-4 pt-4 pb-1 font-mono text-[9px] tracking-widest text-dim uppercase opacity-80">
                  {`// ${groupBefore}`}
                </div>
              )}
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2 text-[var(--fs-sm)] font-mono transition-all ${
                  isActive(item.href)
                    ? 'text-cy bg-[var(--cy-glow)] border-l-2 border-cy -ml-px font-bold shadow-[inset_4px_0_12px_rgba(0,180,216,0.15)]'
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
      </div>

      <div className="px-4 py-3 border-t border-br text-[9px] font-mono text-dim space-y-1">
        <div className="flex items-center justify-between text-sec">
          <span>ELVATIS GROUP</span>
          <span className="text-cy">v3.8.1</span>
        </div>
        <a
          href="https://github.com/homeofe/aahp-hub"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-cy block truncate"
        >
          homeofe/aahp-hub
        </a>
      </div>
    </aside>
  );
}

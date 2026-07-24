'use client';

import React from 'react';

interface HealthBadgeProps {
  score: number;
  grade: string;
  size?: number;
}

export function HealthBadge({ score, grade, size = 36 }: HealthBadgeProps): React.ReactElement {
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const remaining = circumference - progress;

  const color =
    score >= 90 ? 'var(--ok)'
    : score >= 75 ? 'var(--cy)'
    : score >= 60 ? 'var(--warn)'
    : 'var(--er)';

  const bgColor =
    score >= 90 ? 'var(--ok-soft)'
    : score >= 75 ? 'var(--cy-soft)'
    : score >= 60 ? 'var(--warn-soft)'
    : 'var(--er-soft)';

  return (
    <div
      className="relative shrink-0 flex items-center justify-center"
      style={{ width: size, height: size }}
      title={`Health: ${score}/100 (${grade})`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--br)"
          strokeWidth="3"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={`${progress} ${remaining}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <span
        className="absolute font-mono font-bold"
        style={{ fontSize: size * 0.28, color, background: bgColor, borderRadius: '50%', width: size * 0.65, height: size * 0.65, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {grade}
      </span>
    </div>
  );
}

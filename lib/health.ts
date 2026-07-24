import 'server-only';
import type { ProjectSummary } from './manifest';

export interface HealthFactor {
  name: string;
  score: number;
  weight: number;
  detail: string;
}

export interface HealthScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  factors: HealthFactor[];
}

export function computeHealth(project: ProjectSummary): HealthScore {
  const factors: HealthFactor[] = [];

  // Task completion ratio (30% weight)
  const taskScore = project.totalTasks > 0
    ? Math.round((project.doneTasks / project.totalTasks) * 100)
    : 100;
  factors.push({
    name: 'completion',
    score: taskScore,
    weight: 30,
    detail: project.totalTasks > 0
      ? `${project.doneTasks}/${project.totalTasks} tasks done`
      : 'no formal tasks recorded',
  });

  // Success rate from metrics (25% weight)
  const successScore = project.metrics?.successRate ?? (project.totalTasks === 0 ? 100 : 50);
  factors.push({
    name: 'success',
    score: successScore,
    weight: 25,
    detail: project.metrics ? `${successScore}% pass rate` : 'no metrics yet',
  });

  // Activity recency (20% weight)
  const runs7d = project.metrics?.runs7d ?? 0;
  const activityScore = Math.min(100, runs7d * 15);
  factors.push({
    name: 'activity',
    score: activityScore,
    weight: 20,
    detail: `${runs7d} runs in 7d`,
  });

  // Freshness / staleness (15% weight)
  let staleDays = 30;
  if (project.lastUpdated) {
    const ts = Date.parse(project.lastUpdated);
    if (!Number.isNaN(ts)) {
      staleDays = Math.max(0, (Date.now() - ts) / (1000 * 60 * 60 * 24));
    }
  }
  const staleScore =
    staleDays <= 1 ? 100
    : staleDays <= 3 ? 80
    : staleDays <= 7 ? 50
    : staleDays <= 14 ? 25
    : 0;
  factors.push({
    name: 'freshness',
    score: staleScore,
    weight: 15,
    detail: staleDays < 1 ? 'updated today' : `${Math.round(staleDays)}d since update`,
  });

  // Stability - abort rate (10% weight)
  const totalRuns = project.metrics?.totalRuns ?? 0;
  const aborted = project.metrics?.abortedRuns ?? 0;
  const abortScore = totalRuns > 0
    ? Math.max(0, Math.round(100 - (aborted / totalRuns) * 100))
    : 100;
  factors.push({
    name: 'stability',
    score: abortScore,
    weight: 10,
    detail: aborted > 0 ? `${aborted} aborted of ${totalRuns}` : 'no aborts',
  });

  const total = factors.reduce((sum, f) => sum + f.score * f.weight, 0) / 100;
  const score = Math.round(total);
  const grade: HealthScore['grade'] =
    score >= 90 ? 'A'
    : score >= 75 ? 'B'
    : score >= 60 ? 'C'
    : score >= 40 ? 'D'
    : 'F';

  return { score, grade, factors };
}

import 'server-only';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { scanProjects, type ProjectSummary } from './manifest';

export async function detectSupplyChainGuard(repoPath: string): Promise<SupplyChainGuardStatus> {
  const workflowsDir = join(/* turbopackIgnore: true */ repoPath, '.github', 'workflows');
  try {
    const files = await readdir(/* turbopackIgnore: true */ workflowsDir);
    let foundScg = false;
    let foundVerify = false;

    for (const file of files) {
      const lower = file.toLowerCase();
      if (lower.endsWith('.yml') || lower.endsWith('.yaml')) {
        if (lower.includes('supply-chain-guard') || lower.includes('scg') || lower.includes('security')) {
          foundScg = true;
          break;
        }
        if (lower.includes('aahp-verify') || lower.includes('verify') || lower.includes('ci')) {
          foundVerify = true;
        }
      }
    }

    if (foundScg || foundVerify) {
      return {
        status: 'passed',
        lastRun: new Date().toISOString(),
        details: foundScg
          ? 'Supply Chain Guard workflow active in .github/workflows'
          : 'AAHP verification workflow active in .github/workflows',
      };
    }
  } catch {
    // .github/workflows directory missing or unreadable
  }

  return {
    status: 'missing',
    lastRun: null,
    details: 'No Supply Chain Guard or AAHP verification workflow found',
  };
}

export interface SupplyChainGuardStatus {
  status: 'passed' | 'failed' | 'stale' | 'missing';
  lastRun: string | null;
  details?: string;
}

export interface ContainerScanStatus {
  status: 'passed' | 'failed' | 'unsupported' | 'missing';
  lastRun: string | null;
  details?: string;
}

export interface RepoPosture {
  repoName: string;
  path: string;
  githubRepo: string | null;
  ecosystem: 'npm' | 'python' | 'go' | 'docker' | 'unsupported';
  lastDependencyScan: string | null;
  supplyChainGuard: SupplyChainGuardStatus;
  containerScan: ContainerScanStatus | null;
  lastDependencyUpdate: string | null;
  openAdvisories: {
    critical: number;
    high: number;
    total: number;
  };
  permissions: {
    hasAccess: boolean;
    missingPermissions: string[];
  };
  isStale: boolean;
  staleReason?: string;
}

export interface EstatePostureSummary {
  totalRepos: number;
  healthyCount: number;
  staleCount: number;
  vulnerableCount: number;
  missingPermissionsCount: number;
  totalCriticalAdvisories: number;
  totalHighAdvisories: number;
}

export interface EstatePostureResult {
  summary: EstatePostureSummary;
  repos: RepoPosture[];
  scannedAt: string;
}

export interface RawPostureFile {
  repoName?: string;
  ecosystem?: string;
  lastDependencyScan?: string;
  supplyChainGuard?: {
    status?: string;
    lastRun?: string;
    details?: string;
  };
  containerScan?: {
    status?: string;
    lastRun?: string;
    details?: string;
  };
  lastDependencyUpdate?: string;
  openAdvisories?: {
    critical?: number;
    high?: number;
    total?: number;
  };
  permissions?: {
    hasAccess?: boolean;
    missingPermissions?: string[];
  };
}

const STALE_THRESHOLD_DAYS = 7;

function isFileStale(isoTimestamp: string | null): boolean {
  if (!isoTimestamp) return true;
  const time = new Date(isoTimestamp).getTime();
  if (isNaN(time)) return true;
  const now = Date.now();
  const diffDays = (now - time) / (1000 * 60 * 60 * 24);
  return diffDays > STALE_THRESHOLD_DAYS;
}

export async function detectEcosystem(repoPath: string): Promise<RepoPosture['ecosystem']> {
  try {
    const pkgJson = join(/* turbopackIgnore: true */ repoPath, 'package.json');
    const sPkg = await stat(/* turbopackIgnore: true */ pkgJson).catch(() => null);
    if (sPkg && sPkg.isFile()) return 'npm';

    const reqTxt = join(/* turbopackIgnore: true */ repoPath, 'requirements.txt');
    const sReq = await stat(/* turbopackIgnore: true */ reqTxt).catch(() => null);
    if (sReq && sReq.isFile()) return 'python';

    const pyProject = join(/* turbopackIgnore: true */ repoPath, 'pyproject.toml');
    const sPy = await stat(/* turbopackIgnore: true */ pyProject).catch(() => null);
    if (sPy && sPy.isFile()) return 'python';

    const goMod = join(/* turbopackIgnore: true */ repoPath, 'go.mod');
    const sGo = await stat(/* turbopackIgnore: true */ goMod).catch(() => null);
    if (sGo && sGo.isFile()) return 'go';

    const dockerFile = join(/* turbopackIgnore: true */ repoPath, 'Dockerfile');
    const sDock = await stat(/* turbopackIgnore: true */ dockerFile).catch(() => null);
    if (sDock && sDock.isFile()) return 'docker';

    return 'unsupported';
  } catch {
    return 'unsupported';
  }
}

export async function evaluateRepoPosture(project: ProjectSummary): Promise<RepoPosture> {
  const repoPath = project.path;
  const postureFile = join(/* turbopackIgnore: true */ repoPath, '.ai', 'posture.json');

  let rawData: RawPostureFile | null = null;
  let fileError: string | null = null;

  try {
    const content = await readFile(/* turbopackIgnore: true */ postureFile, 'utf8');
    rawData = JSON.parse(content) as RawPostureFile;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EACCES' || code === 'EPERM') {
      fileError = 'Permission denied reading .ai/posture.json';
    } else if (code !== 'ENOENT') {
      fileError = err instanceof Error ? err.message : String(err);
    }
  }

  const ecosystem = rawData?.ecosystem as RepoPosture['ecosystem'] ?? await detectEcosystem(repoPath);

  // Default permissions state
  const hasAccess = fileError ? false : rawData?.permissions?.hasAccess ?? true;
  const missingPermissions = fileError
    ? ['read_posture_file']
    : rawData?.permissions?.missingPermissions ?? [];

  // Default posture values if file missing or unreadable
  const lastScan = rawData?.lastDependencyScan ?? project.lastUpdated ?? null;

  const detectedScg = await detectSupplyChainGuard(repoPath);
  const scgStatusRaw = rawData?.supplyChainGuard?.status;
  const scgStatus: SupplyChainGuardStatus['status'] =
    scgStatusRaw === 'passed' || scgStatusRaw === 'failed' || scgStatusRaw === 'stale' || scgStatusRaw === 'missing'
      ? scgStatusRaw
      : rawData?.supplyChainGuard
        ? 'stale'
        : detectedScg.status;

  const scgLastRun = rawData?.supplyChainGuard?.lastRun ?? detectedScg.lastRun;
  const scgDetails = rawData?.supplyChainGuard?.details ?? detectedScg.details;

  const containerScanRaw = rawData?.containerScan?.status;
  const containerScan: ContainerScanStatus | null = rawData?.containerScan
    ? {
        status:
          containerScanRaw === 'passed' || containerScanRaw === 'failed' || containerScanRaw === 'unsupported'
            ? containerScanRaw
            : 'missing',
        lastRun: rawData.containerScan.lastRun ?? null,
        details: rawData.containerScan.details,
      }
    : ecosystem === 'docker'
      ? { status: 'missing', lastRun: null, details: 'Dockerfile present but container scan not executed' }
      : null;

  const openAdvisories = {
    critical: rawData?.openAdvisories?.critical ?? 0,
    high: rawData?.openAdvisories?.high ?? 0,
    total: rawData?.openAdvisories?.total ?? (rawData?.openAdvisories?.critical ?? 0) + (rawData?.openAdvisories?.high ?? 0),
  };

  const isStale = isFileStale(lastScan) || scgStatus === 'stale' || scgStatus === 'missing' || !hasAccess;

  let staleReason: string | undefined = undefined;
  if (!hasAccess) {
    staleReason = `Access restricted: ${missingPermissions.join(', ')}`;
  } else if (isFileStale(lastScan)) {
    staleReason = `Last scan date (${lastScan ?? 'never'}) is older than ${STALE_THRESHOLD_DAYS} days`;
  } else if (scgStatus === 'stale') {
    staleReason = 'Supply Chain Guard run is stale';
  } else if (scgStatus === 'missing') {
    staleReason = 'Supply Chain Guard workflow missing';
  }

  return {
    repoName: project.name,
    path: repoPath,
    githubRepo: project.githubRepo,
    ecosystem,
    lastDependencyScan: lastScan,
    supplyChainGuard: {
      status: scgStatus,
      lastRun: scgLastRun,
      details: scgDetails,
    },
    containerScan,
    lastDependencyUpdate: rawData?.lastDependencyUpdate ?? null,
    openAdvisories,
    permissions: {
      hasAccess,
      missingPermissions,
    },
    isStale,
    staleReason,
  };
}

export async function loadEstatePosture(): Promise<EstatePostureResult> {
  const scan = await scanProjects();
  const repos = await Promise.all(scan.projects.map((p) => evaluateRepoPosture(p)));

  let healthyCount = 0;
  let staleCount = 0;
  let vulnerableCount = 0;
  let missingPermissionsCount = 0;
  let totalCritical = 0;
  let totalHigh = 0;

  for (const r of repos) {
    if (!r.permissions.hasAccess) {
      missingPermissionsCount++;
    }
    if (r.isStale) {
      staleCount++;
    }
    if (r.openAdvisories.total > 0 || r.supplyChainGuard.status === 'failed') {
      vulnerableCount++;
    }
    if (!r.isStale && r.permissions.hasAccess && r.openAdvisories.total === 0 && r.supplyChainGuard.status === 'passed') {
      healthyCount++;
    }

    totalCritical += r.openAdvisories.critical;
    totalHigh += r.openAdvisories.high;
  }

  return {
    summary: {
      totalRepos: repos.length,
      healthyCount,
      staleCount,
      vulnerableCount,
      missingPermissionsCount,
      totalCriticalAdvisories: totalCritical,
      totalHighAdvisories: totalHigh,
    },
    repos,
    scannedAt: new Date().toISOString(),
  };
}

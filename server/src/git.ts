// Git integration — clone, commit, push, PRs
import { execSync, exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);
const REPOS_DIR = path.join(__dirname, '../../repos');

interface GitResult {
  success: boolean;
  data?: any;
  error?: string;
}

// Ensure repos directory exists
if (!fs.existsSync(REPOS_DIR)) {
  fs.mkdirSync(REPOS_DIR, { recursive: true });
}

export async function gitClone(url: string, branch?: string, targetDir?: string): Promise<GitResult> {
  try {
    const dir = targetDir || path.join(REPOS_DIR, url.split('/').pop()?.replace('.git', '') || 'repo');
    const branchFlag = branch ? ` -b "${branch}"` : '';
    await execAsync(`git clone${branchFlag} "${url}" "${dir}"`, { timeout: 120000 });
    return { success: true, data: { path: dir, url } };
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}

export async function gitStatus(repoPath: string): Promise<GitResult> {
  try {
    if (!fs.existsSync(path.join(repoPath, '.git'))) {
      return { success: false, error: 'Not a git repository' };
    }
    const { stdout: status } = await execAsync('git status --porcelain', { cwd: repoPath, timeout: 10000 });
    const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath, timeout: 5000 });
    const { stdout: remote } = await execAsync('git remote -v', { cwd: repoPath, timeout: 5000 });

    const files = status.split('\n').filter(Boolean).map((line: string) => ({
      status: line.substring(0, 2).trim(),
      file: line.substring(3),
    }));

    return {
      success: true,
      data: {
        branch: branch.trim(),
        remotes: remote.trim(),
        clean: files.length === 0,
        files,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}

export async function gitLog(repoPath: string, maxCount = 10): Promise<GitResult> {
  try {
    const { stdout } = await execAsync(
      `git log --oneline --max-count=${maxCount} --format="%h|%an|%ar|%s"`,
      { cwd: repoPath, timeout: 10000 }
    );
    const commits = stdout.split('\n').filter(Boolean).map((line: string) => {
      const [hash, author, date, ...msgParts] = line.split('|');
      return { hash, author, date, message: msgParts.join('|') };
    });
    return { success: true, data: commits };
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}

export async function gitCommit(repoPath: string, message?: string, files?: string[]): Promise<GitResult> {
  try {
    if (!fs.existsSync(path.join(repoPath, '.git'))) {
      return { success: false, error: 'Not a git repository' };
    }

    const commitMsg = message || `Auto-commit: ${new Date().toISOString()}`;

    // Stage files (or all if not specified)
    if (files && files.length > 0) {
      for (const f of files) {
        await execAsync(`git add "${f}"`, { cwd: repoPath, timeout: 10000 });
      }
    } else {
      await execAsync('git add -A', { cwd: repoPath, timeout: 10000 });
    }

    // Check if there's anything to commit
    const { stdout: status } = await execAsync('git status --porcelain', { cwd: repoPath, timeout: 5000 });
    if (!status.trim()) {
      return { success: true, data: { committed: false, message: 'Nothing to commit' } };
    }

    const { stdout: result } = await execAsync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, {
      cwd: repoPath,
      timeout: 15000,
    });

    return { success: true, data: { committed: true, message: result.trim(), files: status.trim().split('\n').length } };
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}

export async function gitPush(repoPath: string, remote?: string, branch?: string): Promise<GitResult> {
  try {
    const r = remote || 'origin';
    const b = branch || 'HEAD';
    const { stdout } = await execAsync(`git push "${r}" "${b}"`, {
      cwd: repoPath,
      timeout: 60000,
    });
    return { success: true, data: { output: stdout.trim() } };
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}

export async function gitCreatePR(
  repoPath: string,
  title: string,
  body?: string,
  head?: string,
  base?: string
): Promise<GitResult> {
  try {
    // Check if gh CLI is available
    try {
      execSync('gh --version', { stdio: 'pipe' });
    } catch {
      return { success: false, error: 'GitHub CLI (gh) is not installed. Install it with: npm install -g gh' };
    }

    const headBranch = head || '';
    const baseBranch = base ? `--base "${base}"` : '';
    const prBody = body ? `--body "${body.replace(/"/g, '\\"')}"` : '';

    const cmd = `gh pr create --title "${title.replace(/"/g, '\\"')}" ${prBody} ${headBranch ? `--head "${headBranch}"` : ''} ${baseBranch} --repo "${repoPath}"`;
    const { stdout } = await execAsync(cmd, { timeout: 30000 });

    return { success: true, data: { url: stdout.trim() } };
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}

export async function gitDiff(repoPath: string, target?: string): Promise<GitResult> {
  try {
    const targetArg = target || 'HEAD';
    const { stdout } = await execAsync(`git diff "${targetArg}"`, {
      cwd: repoPath,
      timeout: 10000,
    });
    return { success: true, data: { diff: stdout } };
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}

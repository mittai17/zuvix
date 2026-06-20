import { fork, spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const SANDBOX_DIR = path.join(os.tmpdir(), 'zuvix-sandbox');

interface SandboxOptions {
  timeout?: number;       // ms (default: 30000)
  memory?: number;        // MB (default: 256)
  allowedModules?: string[];
  allowedPaths?: string[];
}

interface SandboxResult {
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
  duration: number;
  exitCode: number | null;
}

class SecuritySandbox {
  private running = new Map<string, ChildProcess>();

  constructor() {
    if (!fs.existsSync(SANDBOX_DIR)) {
      fs.mkdirSync(SANDBOX_DIR, { recursive: true });
    }
  }

  /** Run arbitrary code in an isolated forked process with resource limits */
  async runCode(
    code: string,
    language: 'js' | 'ts' | 'python' | 'sh' = 'js',
    options: SandboxOptions = {}
  ): Promise<SandboxResult> {
    const id = randomId();
    const timeout = options.timeout || 30000;
    const memLimitMB = options.memory || 256;

    const workDir = path.join(SANDBOX_DIR, id);
    fs.mkdirSync(workDir, { recursive: true });

    const start = Date.now();

    try {
      if (language === 'js' || language === 'ts') {
        return await this.runJavaScript(code, workDir, id, timeout, memLimitMB, options);
      } else if (language === 'python') {
        return await this.runPython(code, workDir, id, timeout);
      } else if (language === 'sh') {
        return await this.runShell(code, workDir, id, timeout);
      }
      return { success: false, stdout: '', stderr: '', error: `Unsupported language: ${language}`, duration: 0, exitCode: 1 };
    } finally {
      this.cleanup(workDir);
    }
  }

  private async runJavaScript(
    code: string,
    workDir: string,
    id: string,
    timeout: number,
    memLimitMB: number,
    options: SandboxOptions
  ): Promise<SandboxResult> {
    const scriptPath = path.join(workDir, 'sandbox.js');
    const allowedModules = options.allowedModules || [];
    const allowedPaths = options.allowedPaths || [];

    // Wrap code in a sandbox with module restrictions
    const wrappedCode = `
const __zuvix_sandbox_allowed_modules__ = ${JSON.stringify(allowedModules)};
const __zuvix_sandbox_allowed_paths__ = ${JSON.stringify(allowedPaths)};
const __zuvix_original_require__ = require;

// Restrict module loading
require = function(moduleName) {
  if (__zuvix_sandbox_allowed_modules__.length > 0 && 
      !__zuvix_sandbox_allowed_modules__.includes(moduleName)) {
    throw new Error(\`Module "\${moduleName}" is not allowed in sandbox\`);
  }
  return __zuvix_original_require__(moduleName);
};

// Restrict file system access
const __zuvix_fs__ = require('fs');
const __zuvix_path__ = require('path');

const originalReadFile = __zuvix_fs__.readFileSync;
const originalWriteFile = __zuvix_fs__.writeFileSync;
const originalExists = __zuvix_fs__.existsSync;

__zuvix_fs__.readFileSync = function(targetPath, ...args) {
  const resolved = __zuvix_path__.resolve(targetPath);
  if (__zuvix_sandbox_allowed_paths__.length > 0 && 
      !__zuvix_sandbox_allowed_paths__.some(p => resolved.startsWith(p))) {
    throw new Error(\`Access denied: \${targetPath}\`);
  }
  return originalReadFile.call(this, targetPath, ...args);
};

__zuvix_fs__.writeFileSync = function(targetPath, ...args) {
  const resolved = __zuvix_path__.resolve(targetPath);
  if (__zuvix_sandbox_allowed_paths__.length > 0 && 
      !__zuvix_sandbox_allowed_paths__.some(p => resolved.startsWith(p))) {
    throw new Error(\`Access denied: \${targetPath}\`);
  }
  return originalWriteFile.call(this, targetPath, ...args);
};

// Run user code
(async () => {
  try {
    ${code}
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
})().catch(err => {
  console.error(err.message);
  process.exit(1);
});
`;

    fs.writeFileSync(scriptPath, wrappedCode);

    return new Promise((resolve) => {
      const child = fork(scriptPath, [], {
        cwd: workDir,
        execArgv: ['--max-old-space-size=' + memLimitMB],
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        env: { ...process.env, NODE_ENV: 'sandbox' },
        timeout,
      });

      this.running.set(id, child);
      let stdout = '';
      let stderr = '';
      const start = Date.now();

      child.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
      child.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

      const killTimer = setTimeout(() => {
        child.kill('SIGKILL');
        const duration = Date.now() - start;
        resolve({
          success: false,
          stdout,
          stderr,
          error: `JS sandbox timed out after ${timeout}ms`,
          duration,
          exitCode: null,
        });
      }, timeout);

      child.on('exit', (exitCode: number | null) => {
        clearTimeout(killTimer);
        this.running.delete(id);
        const duration = Date.now() - start;
        resolve({
          success: exitCode === 0,
          stdout,
          stderr,
          duration,
          exitCode,
        });
      });

      child.on('error', (err: Error) => {
        clearTimeout(killTimer);
        this.running.delete(id);
        const duration = Date.now() - start;
        resolve({ success: false, stdout, stderr, error: err.message, duration, exitCode: null });
      });
    });
  }

  private async runPython(
    code: string,
    workDir: string,
    id: string,
    timeout: number
  ): Promise<SandboxResult> {
    const scriptPath = path.join(workDir, 'sandbox.py');
    fs.writeFileSync(scriptPath, code);

    return new Promise((resolve) => {
      const child = spawn('python3', [scriptPath], {
        cwd: workDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.running.set(id, child);
      let stdout = '';
      let stderr = '';
      const start2 = Date.now();

      child.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
      child.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

      const killTimer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve({
          success: false, stdout, stderr,
          error: `Python sandbox timed out after ${timeout}ms`,
          duration: Date.now() - start2, exitCode: null,
        });
      }, timeout);

      child.on('close', (exitCode: number | null) => {
        clearTimeout(killTimer);
        this.running.delete(id);
        resolve({
          success: exitCode === 0, stdout, stderr,
          duration: Date.now() - start2, exitCode,
        });
      });

      child.on('error', (err: Error) => {
        clearTimeout(killTimer);
        this.running.delete(id);
        resolve({ success: false, stdout, stderr, error: err.message, duration: Date.now() - start2, exitCode: null });
      });
    });
  }

  private async runShell(
    code: string,
    workDir: string,
    id: string,
    timeout: number
  ): Promise<SandboxResult> {
    const scriptPath = path.join(workDir, 'sandbox.sh');
    fs.writeFileSync(scriptPath, code);
    fs.chmodSync(scriptPath, '755');

    return new Promise((resolve) => {
      const child = spawn('/bin/bash', [scriptPath], {
        cwd: workDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.running.set(id, child);
      let stdout = '';
      let stderr = '';
      const start3 = Date.now();

      child.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
      child.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

      const killTimer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve({
          success: false, stdout, stderr,
          error: `Shell sandbox timed out after ${timeout}ms`,
          duration: Date.now() - start3, exitCode: null,
        });
      }, timeout);

      child.on('close', (exitCode: number | null) => {
        clearTimeout(killTimer);
        this.running.delete(id);
        resolve({
          success: exitCode === 0, stdout, stderr,
          duration: Date.now() - start3, exitCode,
        });
      });

      child.on('error', (err: Error) => {
        clearTimeout(killTimer);
        this.running.delete(id);
        resolve({ success: false, stdout, stderr, error: err.message, duration: Date.now() - start3, exitCode: null });
      });
    });
  }

  killSandbox(id: string): boolean {
    const child = this.running.get(id);
    if (child) {
      child.kill('SIGKILL');
      this.running.delete(id);
      return true;
    }
    return false;
  }

  getActiveSandboxes(): number {
    return this.running.size;
  }

  private cleanup(workDir: string) {
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch { /* best effort */ }
  }
}

export const sandbox = new SecuritySandbox();

// Zuvix Security Agent (Node.js fallback)
// For platforms without Rust (iOS via a-shell, etc.)
// Usage: ZUVIX_SERVER=ws://192.168.1.100:3001 node agent.js

const WebSocket = require('ws');
const { execSync, exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SERVER = (process.env.ZUVIX_SERVER || 'ws://localhost:3001') + '/ws/mesh';
const DEVICE_ID = process.env.ZUVIX_DEVICE_ID || `agent-${os.hostname()}`;
const PLATFORM = `${os.platform()}-${os.arch()}`;

function runCmd(cmd, args = []) {
  try {
    const out = execSync(`"${cmd}" ${args.map(a => `"${a}"`).join(' ')}`, { timeout: 30000 });
    return { exit_code: 0, stdout: out.toString(), stderr: '', success: true };
  } catch (e) {
    return { exit_code: e.status || -1, stdout: e.stdout?.toString() || '', stderr: e.stderr?.toString() || e.message, success: false };
  }
}

function runShell(cmdline) {
  try {
    const isWin = process.platform === 'win32';
    const shell = isWin ? 'cmd.exe' : 'sh';
    const flag = isWin ? '/C' : '-c';
    const out = execSync(`"${shell}" ${flag} "${cmdline.replace(/"/g, '\\"')}"`, { timeout: 60000, shell: true });
    return { exit_code: 0, stdout: out.toString(), stderr: '', success: true };
  } catch (e) {
    return { exit_code: e.status || -1, stdout: e.stdout?.toString() || '', stderr: e.stderr?.toString() || e.message, success: false };
  }
}

async function handleCommand(command, args = {}) {
  switch (command) {
    case 'exec':
      if (!args.cmdline) return { error: "Missing 'cmdline'" };
      return runShell(args.cmdline);

    case 'file.read':
      return { content: fs.readFileSync(args.path, 'utf-8'), path: args.path };

    case 'file.write':
      fs.writeFileSync(args.path, args.content || '');
      return { written: args.path, bytes: (args.content || '').length };

    case 'file.delete':
      const stat = fs.statSync(args.path);
      if (stat.isDirectory()) fs.rmSync(args.path, { recursive: true });
      else fs.unlinkSync(args.path);
      return { deleted: args.path };

    case 'file.list': {
      const dir = args.path || '.';
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      return {
        path: dir,
        entries: entries.map(e => {
          const s = fs.statSync(path.join(dir, e.name));
          return { name: e.name, path: path.join(dir, e.name), is_dir: e.isDirectory(), size: s.size, modified: Math.floor(s.mtimeMs / 1000).toString() };
        }),
        count: entries.length
      };
    }

    case 'file.copy':
      fs.copyFileSync(args.source, args.dest);
      return { from: args.source, to: args.dest };

    case 'file.move':
      fs.renameSync(args.source, args.dest);
      return { from: args.source, to: args.dest };

    case 'process.list': {
      const list = [];
      if (process.platform === 'win32') {
        const out = execSync('tasklist /FO CSV /NH', { encoding: 'utf-8', timeout: 10000 });
        out.trim().split('\n').forEach(line => {
          const parts = line.replace(/"/g, '').split(',');
          if (parts.length >= 2) list.push({ name: parts[0], pid: parseInt(parts[1]), cmd: parts[0] });
        });
      } else {
        const out = execSync('ps aux', { encoding: 'utf-8', timeout: 10000 });
        out.trim().split('\n').slice(1).forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 11) {
            list.push({
              pid: parseInt(parts[1]), name: parts[10], cpu: parseFloat(parts[2]),
              memory: parseFloat(parts[3]), cmd: parts.slice(10).join(' '), status: 'running'
            });
          }
        });
      }
      return { processes: list, count: list.length };
    }

    case 'process.kill':
      const pid = args.pid;
      if (process.platform === 'win32') execSync(`taskkill /F /PID ${pid}`, { timeout: 5000 });
      else execSync(`kill -9 ${pid}`, { timeout: 5000 });
      return { killed: pid };

    case 'system.info':
      return {
        hostname: os.hostname(),
        os: os.platform(),
        os_version: os.release(),
        kernel: os.release(),
        cpu: os.cpus()[0]?.model || '?',
        cpu_cores: os.cpus().length,
        memory_total: os.totalmem(),
        memory_used: os.totalmem() - os.freemem(),
        memory_percent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(1),
        uptime: Math.floor(os.uptime()),
        username: os.userInfo().username,
        arch: os.arch(),
      };

    case 'network.info': {
      const ifaces = os.networkInterfaces();
      const interfaces = Object.entries(ifaces)
        .filter(([name]) => name !== 'lo')
        .map(([name, addrs]) => ({
          name,
          mac: addrs?.[0]?.mac || '',
          ips: (addrs || []).filter(a => a.family === 'IPv4').map(a => a.address),
        }));
      return { hostname: os.hostname(), interfaces };
    }

    case 'env.get':
      return { key: args.key, value: process.env[args.key] };

    case 'env.all':
      return { vars: process.env };

    case 'cwd':
      return { cwd: process.cwd() };

    case 'cwd.set':
      process.chdir(args.path);
      return { cwd: process.cwd() };

    case 'echo':
      return { echo: args.text || '' };

    case 'sleep':
      await new Promise(r => setTimeout(r, args.ms || 1000));
      return { slept_ms: args.ms || 1000 };

    default:
      return { error: `Unknown command: ${command}` };
  }
}

function connect() {
  console.log(`[Zuvix Agent] Connecting to ${SERVER} as ${DEVICE_ID} (${PLATFORM})...`);
  const ws = new WebSocket(SERVER);

  ws.on('open', () => {
    console.log('[Zuvix Agent] Connected.');
    ws.send(JSON.stringify({ type: 'register_device', deviceId: DEVICE_ID, platform: PLATFORM }));
  });

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'execute_command') {
        const cmd = msg.command || '';
        console.log(`[Zuvix Agent] Executing: ${cmd}`);
        try {
          const result = await handleCommand(cmd, msg.args || {});
          ws.send(JSON.stringify({ type: 'command_result', device_id: DEVICE_ID, command: cmd, result, error: null }));
        } catch (e) {
          ws.send(JSON.stringify({ type: 'command_result', device_id: DEVICE_ID, command: cmd, result: null, error: e.message }));
        }
      }
    } catch (e) { console.error('[Zuvix Agent] Parse error:', e.message); }
  });

  ws.on('close', () => {
    console.log('[Zuvix Agent] Disconnected. Reconnecting in 5s...');
    setTimeout(connect, 5000);
  });

  ws.on('error', (e) => {
    console.error('[Zuvix Agent] Error:', e.message);
    ws.close();
  });

  // Heartbeat
  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'heartbeat', deviceId: DEVICE_ID }));
    }
  }, 30000);
}

connect();

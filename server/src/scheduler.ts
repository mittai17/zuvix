import { memoryEngine } from './memory/vector';

export interface ScheduledTask {
  id: string;
  taskName: string;
  cronExpr: string;
  naturalLanguage: string;
  nextRun: Date;
  lastRun: Date | null;
  status: 'running' | 'stopped';
  payload: any;
}

const activeTimers: Map<string, NodeJS.Timeout> = new Map();
let tasks: ScheduledTask[] = [];

const PERSIST_KEY = 'scheduler:tasks';

async function persistTasks() {
  try {
    const data = JSON.stringify(tasks.map(t => ({
      ...t,
      nextRun: t.nextRun.toISOString(),
      lastRun: t.lastRun?.toISOString() || null,
    })));
    await memoryEngine.saveMemory('system', `[${PERSIST_KEY}] ${data}`, 'system');
  } catch (err) {
    console.error('[Scheduler] Failed to persist tasks:', err);
  }
}

async function loadPersistedTasks(): Promise<ScheduledTask[]> {
  try {
    const recent = await memoryEngine.getRecentMemory('system', 50);
    for (const entry of recent) {
      const match = entry.match(/\[scheduler:tasks\] (.+)/);
      if (match) {
        const raw = JSON.parse(match[1]);
        return raw.map((t: any) => ({
          ...t,
          nextRun: new Date(t.nextRun),
          lastRun: t.lastRun ? new Date(t.lastRun) : null,
        }));
      }
    }
  } catch (err) {
    console.error('[Scheduler] Failed to load persisted tasks:', err);
  }
  return [];
}

/** Minimal cron parser — supports: every N [seconds|minutes|hours|days], daily at HH:MM, hourly */
function parseNLtoInterval(nl: string): { intervalMs: number; label: string } | null {
  const lower = nl.toLowerCase().trim();

  // "every N seconds/minutes/hours/days"
  const everyMatch = lower.match(/^every\s+(\d+)\s*(second|minute|hour|day)s?$/);
  if (everyMatch) {
    const num = parseInt(everyMatch[1]);
    const unit = everyMatch[2];
    const map: Record<string, number> = { second: 1000, minute: 60000, hour: 3600000, day: 86400000 };
    return { intervalMs: num * (map[unit] || 60000), label: `every ${num} ${unit}${num > 1 ? 's' : ''}` };
  }

  // "every second/minute/hour/day"
  const everySingle = lower.match(/^every\s+(second|minute|hour|day)$/);
  if (everySingle) {
    const map: Record<string, number> = { second: 1000, minute: 60000, hour: 3600000, day: 86400000 };
    return { intervalMs: map[everySingle[1]], label: `every ${everySingle[1]}` };
  }

  // "daily at HH:MM" or "every day at HH:MM"
  const dailyMatch = lower.match(/(?:daily|every day)\s+at\s+(\d{1,2}):(\d{2})/);
  if (dailyMatch) {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(dailyMatch[1]), parseInt(dailyMatch[2]));
    if (target <= now) target.setDate(target.getDate() + 1);
    const ms = target.getTime() - now.getTime();
    return { intervalMs: ms, label: `daily at ${dailyMatch[1]}:${dailyMatch[2]}` };
  }

  // "hourly"
  if (lower === 'hourly') return { intervalMs: 3600000, label: 'hourly' };
  if (lower === 'daily') return { intervalMs: 86400000, label: 'daily' };
  if (lower === 'weekly') return { intervalMs: 604800000, label: 'weekly' };

  return null;
}

export async function initScheduler() {
  console.log('[Scheduler] Initialized — restoring persisted tasks...');
  const persisted = await loadPersistedTasks();
  for (const task of persisted) {
    if (task.status === 'running') {
      // Restore timer — estimate interval from cronExpr label
      const parsed = parseNLtoInterval(task.naturalLanguage);
      if (parsed) {
        task.nextRun = new Date(Date.now() + parsed.intervalMs);
        const timer = setInterval(async () => {
          console.log(`[Scheduler] Executing: ${task.taskName} (${task.id})`);
          task.lastRun = new Date();
          task.nextRun = new Date(Date.now() + parsed.intervalMs);
          try {
            // Generic execution — fires payload
            memoryEngine.saveMemory('system', `[Cron] Task "${task.taskName}" executed successfully`);
          } catch (err: any) {
            console.error(`[Scheduler] Error in ${task.taskName}:`, err);
            memoryEngine.saveMemory('system', `[Cron] Task "${task.taskName}" failed: ${err.message}`);
          }
        }, parsed.intervalMs);
        activeTimers.set(task.id, timer);
        tasks.push(task);
        console.log(`[Scheduler] Restored task: "${task.taskName}" — ${parsed.label}`);
      }
    }
  }
  console.log(`[Scheduler] Restored ${tasks.length} tasks`);
}

export async function scheduleTaskFromNL(
  taskName: string,
  naturalLanguage: string,
  executeFn: (payload: any) => Promise<void>,
  payload?: any
): Promise<ScheduledTask | { error: string }> {
  const parsed = parseNLtoInterval(naturalLanguage);
  if (!parsed) return { error: `Could not parse: "${naturalLanguage}". Try "every 5 minutes", "daily at 09:00", "hourly".` };

  const now = new Date();
  const task: ScheduledTask = {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    taskName,
    cronExpr: parsed.label,
    naturalLanguage,
    nextRun: new Date(now.getTime() + parsed.intervalMs),
    lastRun: null,
    status: 'running',
    payload,
  };

  const timer = setInterval(async () => {
    console.log(`[Scheduler] Executing: ${taskName} (${task.id})`);
    task.lastRun = new Date();
    task.nextRun = new Date(Date.now() + parsed.intervalMs);
    try {
      await executeFn(payload);
      memoryEngine.saveMemory('system', `[Cron] Task "${taskName}" executed successfully`);
    } catch (err: any) {
      console.error(`[Scheduler] Error in ${taskName}:`, err);
      memoryEngine.saveMemory('system', `[Cron] Task "${taskName}" failed: ${err.message}`);
    }
  }, parsed.intervalMs);

  activeTimers.set(task.id, timer);
  tasks.push(task);
  await persistTasks();
  console.log(`[Scheduler] Scheduled "${taskName}" — ${parsed.label} (every ${parsed.intervalMs}ms)`);
  return task;
}

export function getScheduledTasks(): ScheduledTask[] {
  return tasks;
}

export async function stopScheduledTask(taskId: string): Promise<boolean> {
  const timer = activeTimers.get(taskId);
  if (timer) {
    clearInterval(timer);
    activeTimers.delete(taskId);
  }
  const task = tasks.find(t => t.id === taskId);
  if (task) task.status = 'stopped';
  await persistTasks();
  return true;
}

export async function deleteScheduledTask(taskId: string): Promise<boolean> {
  stopScheduledTask(taskId);
  tasks = tasks.filter(t => t.id !== taskId);
  await persistTasks();
  return true;
}

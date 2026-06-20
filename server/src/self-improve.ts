export interface ActionRecord {
  id: string;
  agentId: string;
  action: string;
  args: any;
  result: any;
  success: boolean;
  feedback?: 'up' | 'down';
  timestamp: number;
  context: string;
}

export interface LearnedPattern {
  id: string;
  trigger: string;
  action: string;
  args: any;
  successRate: number;
  uses: number;
  lastUsed: number;
  created: number;
}

const MAX_RECORDS = 500;
const MIN_PATTERN_CONFIDENCE = 0.6;

class SelfImprovementEngine {
  private records: ActionRecord[] = [];
  private patterns: Map<string, LearnedPattern> = new Map();

  recordAction(agentId: string, action: string, args: any, result: any, success: boolean, context: string): ActionRecord {
    const record: ActionRecord = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      agentId, action, args, result, success, context,
      timestamp: Date.now(),
    };
    this.records.push(record);
    if (this.records.length > MAX_RECORDS) this.records.shift();

    if (success) this.learnPattern(record);
    return record;
  }

  submitFeedback(recordId: string, feedback: 'up' | 'down'): boolean {
    const record = this.records.find(r => r.id === recordId);
    if (!record) return false;
    record.feedback = feedback;
    if (feedback === 'up' && record.success) this.learnPattern(record);
    return true;
  }

  private learnPattern(record: ActionRecord) {
    const key = `${record.action}:${JSON.stringify(record.args).slice(0, 80)}`;
    const existing = this.patterns.get(key);
    if (existing) {
      existing.uses++;
      existing.lastUsed = Date.now();
      existing.successRate = ((existing.successRate * (existing.uses - 1)) + 1) / existing.uses;
      if (existing.successRate > 1) existing.successRate = 1;
    } else {
      this.patterns.set(key, {
        id: `pat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        trigger: record.context.slice(0, 120),
        action: record.action,
        args: record.args,
        successRate: 1.0,
        uses: 1,
        lastUsed: Date.now(),
        created: Date.now(),
      });
    }
  }

  getPatterns(minSuccessRate = 0): LearnedPattern[] {
    return Array.from(this.patterns.values())
      .filter(p => p.successRate >= minSuccessRate)
      .sort((a, b) => b.successRate - a.successRate || b.uses - a.uses);
  }

  getRecentRecords(limit = 50): ActionRecord[] {
    return this.records.slice(-limit).reverse();
  }

  getStats() {
    const total = this.records.length;
    const successes = this.records.filter(r => r.success).length;
    const failures = total - successes;
    const feedbackUp = this.records.filter(r => r.feedback === 'up').length;
    const feedbackDown = this.records.filter(r => r.feedback === 'down').length;
    return {
      totalActions: total,
      successRate: total > 0 ? Math.round((successes / total) * 100) : 0,
      totalPatterns: this.patterns.size,
      activePatterns: this.getPatterns(MIN_PATTERN_CONFIDENCE).length,
      successes,
      failures,
      feedbackUp,
      feedbackDown,
    };
  }

  getContextForPrompt(goal: string): string {
    const relevant = this.getPatterns(MIN_PATTERN_CONFIDENCE)
      .filter(p => goal.toLowerCase().includes(p.trigger.slice(0, 20).toLowerCase()) || p.uses > 3)
      .slice(0, 5);

    if (relevant.length === 0) return '';

    let ctx = '\n## Self-Improvement Memory\n';
    ctx += 'From past tasks, these patterns proved successful:\n';
    for (const p of relevant) {
      ctx += `- When context includes "${p.trigger.slice(0, 60)}", using "${p.action}" succeeded ${Math.round(p.successRate * 100)}% of the time (used ${p.uses}x)\n`;
    }
    ctx += 'Apply these patterns when relevant.\n';
    return ctx;
  }

  reset() {
    this.records = [];
    this.patterns.clear();
  }
}

export const selfImprove = new SelfImprovementEngine();

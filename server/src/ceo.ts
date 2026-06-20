import { getLLMClient, getModelName, resolveProvider, createChatCompletion } from './llm';
import { metricsCollector } from './agent';
import { getInstalledSkillsAsync, executeSkill } from './skills';
import { selfImprove } from './self-improve';
import { memoryEngine } from './memory/vector';
import { getSoul, getMemory } from './memory';

export interface SubTask {
  id: string;
  goal: string;
  agentId: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  result?: string;
  dependsOn: string[];
  createdAt: number;
  completedAt?: number;
}

export interface CEOPlan {
  id: string;
  originalGoal: string;
  subTasks: SubTask[];
  status: 'planning' | 'executing' | 'done' | 'failed';
  createdAt: number;
}

type LogFn = (msg: string) => void;

export class CEOOrchestrator {
  private plans: Map<string, CEOPlan> = new Map();
  private active = false;

  getPlans(): CEOPlan[] {
    return Array.from(this.plans.values());
  }

  getPlan(id: string): CEOPlan | undefined {
    return this.plans.get(id);
  }

  async orchestrate(goal: string, modelConfig?: any, log?: LogFn): Promise<CEOPlan> {
    const logFn = log || ((msg: string) => console.log(`[CEO] ${msg}`));

    const plan: CEOPlan = {
      id: `plan_${Date.now()}`,
      originalGoal: goal,
      subTasks: [],
      status: 'planning',
      createdAt: Date.now(),
    };
    this.plans.set(plan.id, plan);

    logFn(`CEO orchestrating: "${goal}"`);

    try {
      // Phase 1: Decompose goal into sub-tasks using LLM
      const subTasks = await this.decomposeGoal(goal, modelConfig, logFn);
      plan.subTasks = subTasks;
      logFn(`Decomposed into ${subTasks.length} sub-tasks`);

      // Store plan in memory
      await memoryEngine.saveMemory('system',
        `[CEO] Plan ${plan.id}: "${goal}" → ${subTasks.length} sub-tasks`
      );

      // Phase 2: Execute sub-tasks respecting DAG
      plan.status = 'executing';
      await this.executeDAG(plan, modelConfig, logFn);

      plan.status = 'done';
      logFn('All sub-tasks completed');

      // Check if we should auto-create a skill
      await this.maybeCreateSkill(plan, modelConfig, logFn);

    } catch (err: any) {
      plan.status = 'failed';
      logFn(`CEO orchestration failed: ${err.message}`);
    }

    return plan;
  }

  private async decomposeGoal(goal: string, modelConfig?: any, log?: LogFn): Promise<SubTask[]> {
    const logFn = log || (() => {});
    const openai = getLLMClient(modelConfig);
    const modelName = getModelName(modelConfig);
    const skills = await getInstalledSkillsAsync();

    const skillList = skills.map(s => `- ${s.id}: ${s.description}`).join('\n');

    const prompt = `You are a CEO agent. Decompose this user goal into concrete sub-tasks:

GOAL: "${goal}"

Available skills/tools:
${skillList || '(none available)'}

INSTRUCTIONS:
1. Break the goal into 2-6 sequential or parallel sub-tasks.
2. Each sub-task must be concrete and independently executable.
3. Use "dependsOn" to express task DAG dependencies (empty array = no dependency).
4. Each sub-task should have a clear agentId like "researcher", "coder", "verifier", "executor".
5. Return ONLY a JSON array of objects with fields: goal, agentId, dependsOn (string array).

Example:
[
  {"goal": "Research the current stock price of AAPL", "agentId": "researcher", "dependsOn": []},
  {"goal": "Analyze the research data and determine buy/sell", "agentId": "analyst", "dependsOn": ["researcher"]},
  {"goal": "Execute the trade on the exchange", "agentId": "executor", "dependsOn": ["analyst"]}
]`;

    const response = await createChatCompletion(openai, {
      model: modelName,
      messages: [
        { role: 'system', content: 'You are a CEO agent that decomposes goals into sub-tasks. Return ONLY a JSON array.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    }, resolveProvider(modelConfig));

    const text = response.choices[0]?.message?.content || '[]';
    const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let parsed: any[];
    try {
      parsed = JSON.parse(clean);
    } catch {
      logFn(`Failed to parse CEO decomposition: ${text.substring(0, 200)}`);
      // Fallback: create a single sub-task
      return [{
        id: `st_${Date.now()}_0`,
        goal,
        agentId: 'executor',
        status: 'pending' as const,
        dependsOn: [],
        createdAt: Date.now(),
      }];
    }

    return parsed.map((t: any, i: number) => ({
      id: `st_${Date.now()}_${i}`,
      goal: t.goal || `Sub-task ${i + 1}`,
      agentId: t.agentId || `agent_${i}`,
      status: 'pending' as const,
      dependsOn: t.dependsOn || [],
      createdAt: Date.now(),
    }));
  }

  private async executeDAG(plan: CEOPlan, modelConfig?: any, log?: LogFn) {
    const logFn = log || (() => {});
    let completed = new Set<string>();

    while (completed.size < plan.subTasks.length) {
      // Find ready tasks (all dependencies met)
      const ready = plan.subTasks.filter(
        st => st.status === 'pending' && st.dependsOn.every(d => {
          const dep = plan.subTasks.find(s => s.agentId === d || s.id === d);
          return dep && dep.status === 'done';
        })
      );

      if (ready.length === 0 && completed.size < plan.subTasks.length) {
        // Check for deadlock
        const blocked = plan.subTasks.filter(st => st.status === 'pending');
        logFn(`Deadlock detected: ${blocked.length} tasks blocked. Breaking dependency.`);
        // Force-run the first blocked task
        if (blocked.length > 0) blocked[0].dependsOn = [];
        continue;
      }

      // Execute ready tasks in parallel
      await Promise.all(ready.map(async (task) => {
        task.status = 'running';
        logFn(`[${task.agentId}] Starting: ${task.goal}`);

        metricsCollector.registerAgent(task.id, task.agentId);
        metricsCollector.updateAgentStatus(task.id, 'busy', '');

        try {
          // Try to execute as a skill first
          const skills = await getInstalledSkillsAsync();
          const matchingSkill = skills.find(s =>
            task.goal.toLowerCase().includes(s.id.toLowerCase())
          );

          let result: string;
          if (matchingSkill) {
            const r = await executeSkill(matchingSkill.id, [task.goal]);
            result = JSON.stringify(r);
          } else {
            // Use the LLM directly for this sub-task
            result = await this.runSubTask(task.goal, modelConfig, logFn);
          }

          task.result = result;
          task.status = 'done';
          task.completedAt = Date.now();
          completed.add(task.id);

          logFn(`[${task.agentId}] Done: ${result.substring(0, 100)}`);
          metricsCollector.updateAgentStatus(task.id, 'idle', '');
          selfImprove.recordAction(task.id, 'ceo_subtask', [task.goal], { result }, true, plan.originalGoal);

          // Save to memory
          await memoryEngine.saveMemory('system',
            `[CEO] Task "${task.goal}" completed: ${result.substring(0, 200)}`
          );
        } catch (err: any) {
          task.status = 'failed';
          task.result = err.message;
          completed.add(task.id);
          logFn(`[${task.agentId}] Failed: ${err.message}`);
          metricsCollector.updateAgentStatus(task.id, 'idle', '');
          selfImprove.recordAction(task.id, 'ceo_subtask', [task.goal], { error: err.message }, false, plan.originalGoal);
        }
      }));
    }
  }

  private async runSubTask(goal: string, modelConfig?: any, log?: LogFn): Promise<string> {
    const logFn = log || (() => {});
    const openai = getLLMClient(modelConfig);
    const modelName = getModelName(modelConfig);
    const skills = await getInstalledSkillsAsync();

    let systemPrompt = `You are a focused worker agent. Your task:\n${goal}\n\n`;
    systemPrompt += 'Available tools:\n';
    skills.forEach(s => {
      systemPrompt += `- ${s.id}: ${s.description}\n`;
    });
    systemPrompt += '\nRespond with the result of your work. Be concise and factual.';

    const response = await createChatCompletion(openai, {
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Execute: ${goal}` },
      ],
      temperature: 0.2,
    }, resolveProvider(modelConfig));

    return response.choices[0]?.message?.content || 'No result';
  }

  private async maybeCreateSkill(plan: CEOPlan, modelConfig?: any, log?: LogFn) {
    if (plan.status !== 'done') return;
    const logFn = log || (() => {});

    // Check if this pattern is worth saving as a skill
    const existingSkills = await getInstalledSkillsAsync();
    const skillName = plan.originalGoal
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 40);

    // Don't create if similar skill exists
    if (existingSkills.some(s => s.id.includes(skillName) || skillName.includes(s.id))) {
      logFn('Similar skill exists, skipping auto-creation');
      return;
    }

    const openai = getLLMClient(modelConfig);
    const modelName = getModelName(modelConfig);

    const steps = plan.subTasks
      .map(t => `- ${t.agentId}: ${t.goal} → ${t.status}`)
      .join('\n');

    const code = await createChatCompletion(openai, {
      model: modelName,
      messages: [
        { role: 'system', content: 'You generate TypeScript agent skill code. Return ONLY the code, no explanation.' },
        { role: 'user', content: `Create a reusable TypeScript skill for this goal:

Goal: ${plan.originalGoal}

Steps:
${steps}

The skill should be an async function "execute" that takes args and returns { success, result }.
Use TypeScript with proper types. Include input validation and error handling.` },
      ],
      temperature: 0.2,
    }, resolveProvider(modelConfig));

    const codeText = code.choices[0]?.message?.content || '';
    const cleanCode = codeText.replace(/```typescript/g, '').replace(/```ts/g, '').replace(/```/g, '').trim();

    if (cleanCode.length > 50) {
      try {
        const { saveSkill } = await import('./skills');
        saveSkill({
          id: skillName,
          name: plan.originalGoal.substring(0, 50),
          description: `Auto-created from CEO plan: ${plan.originalGoal.substring(0, 100)}`,
          code: cleanCode,
          readme: `# ${plan.originalGoal}\n\nAuto-created by CEO orchestrator from completed plan.`,
          dependencies: [],
        });
        logFn(`Auto-created skill "${skillName}" from completed plan`);
        await memoryEngine.saveMemory('system',
          `[CEO] Auto-created skill "${skillName}" from plan ${plan.id}`
        );
      } catch (err: any) {
        logFn(`Failed to auto-create skill: ${err.message}`);
      }
    }
  }
}

export const ceo = new CEOOrchestrator();

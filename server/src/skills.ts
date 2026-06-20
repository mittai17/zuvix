/* server/src/skills.ts */
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import * as ts from 'typescript';

export interface BackendSkill {
  id: string;
  name: string;
  description: string;
  code: string;
  readme: string;
  dependencies: string[];
}

const SKILLS_DIR = path.join(__dirname, '../skills');

// Ensure skills directory exists
if (!fs.existsSync(SKILLS_DIR)) {
  fs.mkdirSync(SKILLS_DIR, { recursive: true });
}

// Default skill files to write if empty
const DEFAULT_SKILL_TEMPLATES: Record<string, { name: string; desc: string; code: string; readme: string; deps: string[] }> = {
  'web-search': {
    name: 'Web Search',
    desc: 'Perform a web search using DuckDuckGo HTML scraping.',
    code: `const axios = require('axios');\nconst cheerio = require('cheerio');\n\nexport async function execute(query: string) {\n  try {\n    const res = await axios.get('https://html.duckduckgo.com/html/', {\n      params: { q: query },\n      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }\n    });\n    const $ = cheerio.load(res.data);\n    const results: string[] = [];\n    $('.result__snippet').each((i: number, el: any) => {\n      results.push($(el).text());\n    });\n    return { success: true, results: results.slice(0, 5) };\n  } catch (err: any) {\n    return { success: false, error: err.message };\n  }\n}`,
    readme: '# Web Search\nSearches the web and returns snippets.',
    deps: ['axios', 'cheerio']
  },
  'shell-exec': {
    name: 'Shell Execution',
    desc: 'Executes a command in the shell.',
    code: `const { execSync } = require('child_process');\n\nexport async function execute(command: string) {\n  try {\n    const output = execSync(command, { encoding: 'utf8', timeout: 10000 });\n    return { success: true, output };\n  } catch (err: any) {\n    return { success: false, error: err.message, stderr: err.stderr?.toString() };\n  }\n}`,
    readme: '# Shell Execution\nRuns shell commands.',
    deps: []
  },
  'file-system': {
    name: 'File System Ops',
    desc: 'Read or write local files. Args: action (read/write), path, content?',
    code: `const fs = require('fs');\nconst path = require('path');\n\nexport async function execute(action: string, filePath: string, content?: string) {\n  const fullPath = path.resolve(filePath);\n  try {\n    if (action === 'read') {\n      const data = fs.readFileSync(fullPath, 'utf8');\n      return { success: true, content: data };\n    } else if (action === 'write') {\n      fs.writeFileSync(fullPath, content || '', 'utf8');\n      return { success: true, message: 'File written successfully' };\n    }\n    return { success: false, error: 'Unknown action' };\n  } catch(err: any) {\n    return { success: false, error: err.message };\n  }\n}`,
    readme: '# File System Ops\nReads and writes files.',
    deps: []
  }
};

// Write defaults
for (const [id, tpl] of Object.entries(DEFAULT_SKILL_TEMPLATES)) {
  const skillFile = path.join(SKILLS_DIR, `${id}.json`);
  if (!fs.existsSync(skillFile)) {
    fs.writeFileSync(skillFile, JSON.stringify({
      id,
      name: tpl.name,
      description: tpl.desc,
      code: tpl.code,
      readme: tpl.readme,
      dependencies: tpl.deps
    }, null, 2));
  }
}

// Load all local skills synchronously
export function getInstalledSkills(): BackendSkill[] {
  const files = fs.readdirSync(SKILLS_DIR);
  const skills: BackendSkill[] = [];

  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const content = fs.readFileSync(path.join(SKILLS_DIR, file), 'utf8');
        skills.push(JSON.parse(content));
      } catch (err) {
        console.error(`Error loading skill file: ${file}`, err);
      }
    }
  }

  return skills;
}

import { fetchToolsFromDatabase } from './db';
import { mcpManager } from './mcp';

let cloudToolsCache: BackendSkill[] = [];
let lastCacheUpdate = 0;

// Loads massive volumes of tools natively merging local disk, Supabase Postgres, and MCP Servers
export async function getInstalledSkillsAsync(): Promise<BackendSkill[]> {
  const localSkills = getInstalledSkills();
  const mcpSkills = await mcpManager.getToolsAsSkills();
  
  if (Date.now() - lastCacheUpdate > 60000) {
    const dbTools = await fetchToolsFromDatabase();
    cloudToolsCache = dbTools.map((t: any) => ({
      id: t.id || t.name.toLowerCase(),
      name: t.name,
      description: t.description || 'Cloud Tool',
      code: t.code || '',
      readme: '',
      dependencies: []
    }));
    lastCacheUpdate = Date.now();
  }
  
  // Deduplicate by ID
  const map = new Map<string, BackendSkill>();
  [...cloudToolsCache, ...localSkills, ...mcpSkills].forEach(s => map.set(s.id, s));
  return Array.from(map.values());
}

// Save a skill
export function saveSkill(skill: BackendSkill): void {
  const skillFile = path.join(SKILLS_DIR, `${skill.id}.json`);
  fs.writeFileSync(skillFile, JSON.stringify(skill, null, 2), 'utf8');
}

// Transpile TS/TSX and run inside sandboxed context
export async function executeSkill(skillId: string, args: any[]): Promise<any> {
  const skills = await getInstalledSkillsAsync();
  const target = skills.find(s => s.id === skillId);

  if (!target) {
    throw new Error(`Skill with ID "${skillId}" is not installed.`);
  }

  // Handle MCP Native Tool Routing
  if (target.id.startsWith('mcp-')) {
    const parts = target.id.split('-');
    // format: mcp-{serverId}-{toolName}
    // Since toolName could have hyphens, we reconstruct it
    const serverId = parts[1];
    const toolName = target.id.substring(`mcp-${serverId}-`.length);
    console.log(`Routing MCP Execution to server: ${serverId}, tool: ${toolName}`);
    return await mcpManager.callTool(serverId, toolName, args.length === 1 && typeof args[0] === 'object' ? args[0] : args);
  }

  console.log(`Compiling and executing skill: ${target.name}`);

  // Transpile TypeScript / TSX to JavaScript
  const transpileResult = ts.transpileModule(target.code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React
    }
  });

  const jsCode = transpileResult.outputText;

  // Sandbox setup
  const sandbox = {
    console: {
      log: (...msg: any[]) => console.log(`[SKILL:${skillId}]`, ...msg),
      error: (...msg: any[]) => console.error(`[SKILL:${skillId}]`, ...msg),
      info: (...msg: any[]) => console.info(`[SKILL:${skillId}]`, ...msg)
    },
    fetch: global.fetch,
    require: require,
    setTimeout,
    clearTimeout,
    module: { exports: {} as any },
    exports: {} as any
  };

  const context = vm.createContext(sandbox);
  const script = new vm.Script(jsCode);
  script.runInContext(context);

  const executeFn = sandbox.module.exports.execute || sandbox.exports.execute;
  if (!executeFn || typeof executeFn !== 'function') {
    throw new Error(`Skill "${skillId}" does not export an "execute" function.`);
  }

  return await executeFn(...args);
}

/* server/src/skillfish.ts — Skillfish (MCP Market) integration wrapper */
import { execSync } from 'child_process';

const SKILLFISH_CLI = require.resolve('skillfish/dist/index.js');

export interface SkillfishSearchResult {
  name: string;
  slug: string;
  owner: string;
  github: string;
  url: string;
  description: string;
  stars: number;
}

interface SkillfishSearchResponse {
  success: boolean;
  exit_code: number;
  errors: string[];
  query: string;
  results: SkillfishSearchResult[];
  total_count: number;
}

/** Run skillfish CLI with given args, return parsed JSON output */
function runSkillfish(...args: string[]): any {
  const cmd = `node "${SKILLFISH_CLI}" ${args.join(' ')} --json 2>/dev/null`;
  const stdout = execSync(cmd, { timeout: 30000, encoding: 'utf8' });
  return JSON.parse(stdout);
}

/** Search the skillfish registry */
export function searchSkills(query: string): SkillfishSearchResult[] {
  try {
    const res: SkillfishSearchResponse = runSkillfish('search', JSON.stringify(query));
    return res.results || [];
  } catch (err: any) {
    console.error('[Skillfish] Search error:', err.message);
    return [];
  }
}

/** Install a skill from its github path (owner/repo/...) */
export function installSkill(githubPath: string): boolean {
  try {
    const res = runSkillfish('add', githubPath);
    return res?.success === true;
  } catch (err: any) {
    console.error('[Skillfish] Install error:', err.message);
    return false;
  }
}

/** List installed skills */
export function listInstalled(): any[] {
  try {
    const res = runSkillfish('list');
    return Array.isArray(res) ? res : [];
  } catch (err: any) {
    console.error('[Skillfish] List error:', err.message);
    return [];
  }
}

/** Remove a skill by name */
export function removeSkill(name: string): boolean {
  try {
    const res = runSkillfish('remove', JSON.stringify(name));
    return res?.success === true;
  } catch (err: any) {
    console.error('[Skillfish] Remove error:', err.message);
    return false;
  }
}

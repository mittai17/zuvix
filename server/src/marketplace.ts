import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { BackendSkill, saveSkill } from './skills';

const REGISTRY_API = 'https://registry.npmjs.org/-/v1/search';
const SKILLS_DIR = path.join(__dirname, '../skills');

interface NpmPackage {
  name: string;
  description: string;
  version: string;
  keywords?: string[];
  publisher?: { username: string };
}

interface MarketplaceSearchResult {
  name: string;
  description: string;
  version: string;
  publisher: string;
  score: number;
}

class SkillMarketplace {
  /** Search npm registry for skill-like packages */
  async search(query: string, limit = 20): Promise<MarketplaceSearchResult[]> {
    const searchTerms = query
      ? query
      : 'keywords:zuvix-agent,keywords:zuvix-skill';

    try {
      const url = `${REGISTRY_API}?text=${encodeURIComponent(searchTerms)}&size=${limit}`;
      const res = await fetch(url);
      const data = await res.json() as any;

      return (data.objects || []).map((obj: any) => ({
        name: obj.package.name,
        description: obj.package.description || '',
        version: obj.package.version,
        publisher: obj.package.publisher?.username || 'unknown',
        score: obj.score?.final || 0,
      }));
    } catch (err: any) {
      console.error('[Marketplace] Search error:', err.message);
      // Try alternative search
      return this.fallbackSearch(query, limit);
    }
  }

  private async fallbackSearch(query: string, limit: number): Promise<MarketplaceSearchResult[]> {
    try {
      const url = `${REGISTRY_API}?text=${encodeURIComponent(query || 'agent')}&size=${limit}`;
      const res = await fetch(url);
      const data = await res.json() as any;
      return (data.objects || []).map((obj: any) => ({
        name: obj.package.name,
        description: obj.package.description || '',
        version: obj.package.version,
        publisher: obj.package.publisher?.username || 'unknown',
        score: obj.score?.final || 0,
      }));
    } catch {
      return [];
    }
  }

  /** Install an npm package as a Zuvix skill */
  async install(packageName: string): Promise<BackendSkill> {
    const sanitized = packageName.replace(/[^a-z0-9@/_.-]/gi, '_');
    const installDir = path.join(SKILLS_DIR, 'node_modules', sanitized);

    // Install the package
    try {
      execSync(`npm install --prefix "${SKILLS_DIR}" "${sanitized}"`, {
        stdio: 'pipe',
        timeout: 120000,
      });
    } catch (err: any) {
      throw new Error(`Failed to install ${sanitized}: ${err.stderr?.toString() || err.message}`);
    }

    // Find the entry point
    const pkgJsonPath = path.join(installDir, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
      throw new Error(`Package installed but package.json not found at ${pkgJsonPath}`);
    }

    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const mainFile = pkg.main || 'index.js';
    const mainPath = path.join(installDir, mainFile);

    let code = '';
    if (fs.existsSync(mainPath)) {
      code = fs.readFileSync(mainPath, 'utf8');
    }

    const skillId = `npm:${sanitized}`;
    const skill: BackendSkill = {
      id: skillId,
      name: pkg.name || sanitized,
      description: pkg.description || `Imported from npm: ${sanitized}`,
      code,
      readme: `# ${pkg.name}\n\n${pkg.description || ''}\n\nInstalled from npm.`,
      dependencies: Object.keys(pkg.dependencies || {}),
    };

    saveSkill(skill);
    return skill;
  }

  /** List all npm-installed skills */
  listInstalled(): BackendSkill[] {
    if (!fs.existsSync(SKILLS_DIR)) return [];
    const skillsDir = path.join(SKILLS_DIR, 'node_modules');
    if (!fs.existsSync(skillsDir)) return [];

    const skills: BackendSkill[] = [];
    const entries = fs.readdirSync(skillsDir);
    for (const entry of entries) {
      const pkgPath = path.join(skillsDir, entry, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          const mainPath = path.join(skillsDir, entry, pkg.main || 'index.js');
          const code = fs.existsSync(mainPath) ? fs.readFileSync(mainPath, 'utf8') : '';
          skills.push({
            id: `npm:${entry}`,
            name: pkg.name || entry,
            description: pkg.description || '',
            code,
            readme: `# ${pkg.name}\n\n${pkg.description || ''}`,
            dependencies: Object.keys(pkg.dependencies || {}),
          });
        } catch { /* skip broken packages */ }
      }
    }
    return skills;
  }

  /** Uninstall a skill */
  async uninstall(skillId: string): Promise<void> {
    const pkgName = skillId.replace(/^npm:/, '');
    if (pkgName.startsWith('local:') || pkgName.startsWith('ceo:')) return;

    try {
      execSync(`npm uninstall --prefix "${SKILLS_DIR}" "${pkgName}"`, {
        stdio: 'pipe',
        timeout: 30000,
      });
    } catch {
      // Force remove the directory
      const dir = path.join(SKILLS_DIR, 'node_modules', pkgName);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    }

    // Remove from skills registry
    const skillFiles = fs.readdirSync(SKILLS_DIR)
      .filter(f => f.endsWith('.json'));
    for (const file of skillFiles) {
      const content = JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, file), 'utf8'));
      if (content.id === skillId) {
        fs.unlinkSync(path.join(SKILLS_DIR, file));
        break;
      }
    }
  }
}

export const skillMarketplace = new SkillMarketplace();

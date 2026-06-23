/* server/src/skillsmp.ts — SkillsMP marketplace integration wrapper */
import axios from 'axios';

const BASE = 'https://skillsmp.com';

export interface SkillsMPSkill {
  id: string;
  name: string;
  author: string;
  description: string;
  githubUrl: string;
  skillUrl: string;
  stars: number;
  updatedAt: number;
}

interface SearchResponse {
  success: boolean;
  data: {
    skills: SkillsMPSkill[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  };
  meta?: { requestId: string; responseTimeMs: number };
}

/** Search SkillsMP by keyword */
export async function searchSkills(query: string, limit = 20): Promise<SkillsMPSkill[]> {
  try {
    const res = await axios.get<SearchResponse>(`${BASE}/api/v1/skills/search`, {
      params: { q: query, limit, sortBy: 'recent' },
      timeout: 10000,
    });
    return res.data?.data?.skills || [];
  } catch (err: any) {
    console.error('[SkillsMP] Search error:', err.message);
    return [];
  }
}

/** Fetch a single skill detail (uses search with exact match) */
export async function getSkill(id: string): Promise<SkillsMPSkill | null> {
  try {
    const skills = await searchSkills(id, 1);
    return skills.find(s => s.id === id) || null;
  } catch {
    return null;
  }
}

// Auto knowledge graph builder — extract entities & relationships from memory
import { memoryEngine } from './memory/vector';
import { graphAPI, KNode } from './knowledge-graph';

// Simple NLP entity extraction patterns
const ENTITY_PATTERNS: { type: string; patterns: RegExp[] }[] = [
  { type: 'person', patterns: [/@(\w+)/g, /(?:user|author):\s*(\w+)/gi] },
  { type: 'topic', patterns: [/(?:about|regarding|discuss)\s+(\w+(?:\s+\w+){0,3})/gi] },
  { type: 'technology', patterns: [/(\w+(?:JS|TS|API|SDK|DB|OS|AI|ML|UI|UX))/g] },
  { type: 'project', patterns: [/(?:project|repo|repository)\s+(?:called\s+)?["']?(\w+(?:[-_]\w+)*)["']?/gi] },
  { type: 'url', patterns: [/(https?:\/\/[^\s]+)/g] },
  { type: 'concept', patterns: [/(?:concept|idea|notion|principle)\s+(?:of\s+)?(\w+(?:\s+\w+){0,2})/gi] },
  { type: 'location', patterns: [/(?:in|at|from)\s+(\w+(?:\s+\w+)?)(?:\.|,|\s|$)/gi] },
  { type: 'skill', patterns: [/(?:skill|ability|capability)\s+(?:of\s+)?(\w+(?:\s+\w+){0,2})/gi] },
];

interface ExtractedEntity {
  name: string;
  type: string;
  mentions: number;
  contexts: string[];
}

interface ExtractedRelation {
  source: string;
  target: string;
  label: string;
  context: string;
}

export async function autoBuildGraph(sessionId?: string): Promise<{
  nodesAdded: number;
  edgesAdded: number;
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
}> {
  // Get all history from a session, or from all sessions
  let allText = '';

  if (sessionId) {
    const history = await memoryEngine.getHistory(sessionId);
    allText = history.map((h: any) => h.content || h.text || '').join('\n');
  } else {
    // Scan all sessions by reading unlabeled memory entries
    const sessions = await memoryEngine.listSessions?.() || [];
    for (const sid of sessions) {
      const history = await memoryEngine.getHistory(sid);
      allText += history.map((h: any) => h.content || h.text || '').join('\n') + '\n';
    }
  }

  const entities = extractEntities(allText);
  const relations = extractRelations(allText, entities);

  // Add to knowledge graph
  let nodesAdded = 0;
  let edgesAdded = 0;

  for (const entity of entities) {
    try {
      const existing = graphAPI.findNode(entity.name);
      if (!existing) {
        const nodeType = mapType(entity.type);
        graphAPI.addNode({
          label: entity.name,
          type: nodeType,
          weight: entity.mentions,
          metadata: {
            extractedFrom: 'auto-kg',
            contexts: entity.contexts.slice(0, 5),
            mentions: entity.mentions,
          },
        });
        nodesAdded++;
      }
    } catch { /* node may already exist */ }
  }

  for (const rel of relations) {
    try {
      const sourceNode = graphAPI.findNode(rel.source);
      const targetNode = graphAPI.findNode(rel.target);
      if (sourceNode && targetNode) {
        graphAPI.addEdge(sourceNode.id, targetNode.id, rel.label);
        edgesAdded++;
      }
    } catch { /* edge may already exist */ }
  }

  return {
    nodesAdded,
    edgesAdded,
    entities: entities.slice(0, 50),
    relations: relations.slice(0, 50),
  };
}

export async function autoBuildAllSessions(): Promise<{
  nodesAdded: number;
  edgesAdded: number;
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
}> {
  return autoBuildGraph();
}

function extractEntities(text: string): ExtractedEntity[] {
  const entityMap = new Map<string, ExtractedEntity>();

  for (const { type, patterns } of ENTITY_PATTERNS) {
    for (const regex of patterns) {
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const name = match[1]?.trim();
        if (!name || name.length < 2 || name.length > 50) continue;

        // Get context (surrounding ~60 chars)
        const start = Math.max(0, match.index - 30);
        const end = Math.min(text.length, match.index + match[0].length + 30);
        const context = text.slice(start, end).replace(/\n/g, ' ').trim();

        const key = `${type}:${name.toLowerCase()}`;
        if (entityMap.has(key)) {
          const existing = entityMap.get(key)!;
          existing.mentions++;
          if (!existing.contexts.includes(context)) {
            existing.contexts.push(context);
          }
        } else {
          entityMap.set(key, {
            name,
            type,
            mentions: 1,
            contexts: [context],
          });
        }
      }
    }
  }

  return Array.from(entityMap.values())
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 100);
}

function extractRelations(text: string, entities: ExtractedEntity[]): ExtractedRelation[] {
  const names = entities.map(e => e.name);
  const relations: ExtractedRelation[] = [];
  const relationPatterns = [
    { label: 'uses', pattern: /(\w+)\s+(?:uses?|utilizes?|employs?|runs?)\s+(\w+)/gi },
    { label: 'created_by', pattern: /(\w+)\s+(?:created|built|developed|made)\s+(?:by|with)\s+(\w+)/gi },
    { label: 'depends_on', pattern: /(\w+)\s+(?:depends?\s+on|requires?|needs?)\s+(\w+)/gi },
    { label: 'part_of', pattern: /(\w+)\s+(?:is\s+(?:a\s+)?part\s+of|belongs?\s+to|in\s+)\s+(\w+)/gi },
    { label: 'related_to', pattern: /(\w+)\s+(?:relates?\s+to|connected?\s+to|linked?\s+to|associated?\s+with)\s+(\w+)/gi },
    { label: 'discusses', pattern: /(\w+)\s+(?:discusses?|talks?\s+about|mentions?|references?)\s+(\w+)/gi },
  ];

  for (const { label, pattern } of relationPatterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const source = match[1]?.trim();
      const target = match[2]?.trim();
      if (!source || !target) continue;
      if (!names.includes(source) || !names.includes(target)) continue;

      const start = Math.max(0, match.index - 20);
      const end = Math.min(text.length, match.index + match[0].length + 20);
      const context = text.slice(start, end).replace(/\n/g, ' ').trim();

      relations.push({ source, target, label, context });
    }
  }

  return relations.slice(0, 100);
}

function mapType(entityType: string): KNode['type'] {
  switch (entityType) {
    case 'person': return 'agent';
    case 'technology': return 'concept';
    case 'project': return 'concept';
    case 'topic': return 'concept';
    case 'skill': return 'action';
    case 'url': return 'memory';
    case 'location': return 'entity';
    case 'concept': return 'concept';
    default: return 'entity';
  }
}

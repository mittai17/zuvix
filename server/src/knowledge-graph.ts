// Knowledge Graph — agent memory connections (inspired by OpenFang)
// Auto-discovers relations from stored memories

export interface KNode {
  id: string;
  label: string;
  type: 'concept' | 'memory' | 'agent' | 'entity' | 'action';
  weight: number;
  metadata?: Record<string, any>;
  created: number;
}

export interface KEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  weight: number;
  created: number;
}

export interface KnowledgeGraph {
  nodes: KNode[];
  edges: KEdge[];
}

// In-memory store
let nodes: Map<string, KNode> = new Map();
let edges: Map<string, KEdge> = new Map();

// Initialize with some seed nodes
function seed() {
  const now = Date.now();
  const seedNodes: KNode[] = [
    { id: 'zuvix', label: 'Zuvix OS', type: 'agent', weight: 10, created: now },
    { id: 'memory', label: 'Memory System', type: 'concept', weight: 8, created: now },
    { id: 'security', label: 'Security Agent', type: 'agent', weight: 7, created: now },
    { id: 'mesh', label: 'Mesh Network', type: 'concept', weight: 6, created: now },
    { id: 'skills', label: 'Skill Workshop', type: 'concept', weight: 6, created: now },
    { id: 'canvas', label: 'Canvas Renderer', type: 'concept', weight: 5, created: now },
  ];
  for (const n of seedNodes) nodes.set(n.id, n);

  const seedEdges: KEdge[] = [
    { id: 'e1', source: 'zuvix', target: 'memory', label: 'manages', weight: 8, created: now },
    { id: 'e2', source: 'zuvix', target: 'security', label: 'deploys', weight: 7, created: now },
    { id: 'e3', source: 'zuvix', target: 'mesh', label: 'connects_via', weight: 6, created: now },
    { id: 'e4', source: 'zuvix', target: 'skills', label: 'hosts', weight: 6, created: now },
    { id: 'e5', source: 'zuvix', target: 'canvas', label: 'renders', weight: 5, created: now },
    { id: 'e6', source: 'security', target: 'mesh', label: 'uses', weight: 5, created: now },
    { id: 'e7', source: 'memory', target: 'skills', label: 'feeds', weight: 4, created: now },
  ];
  for (const e of seedEdges) edges.set(e.id, e);
}
seed();

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could',
    'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
    'from', 'as', 'if', 'then', 'so', 'than', 'just', 'about', 'also', 'very',
    'not', 'no', 'yes', 'i', 'you', 'he', 'she', 'we', 'my', 'me', 'your',
    'what', 'which', 'who', 'how', 'when', 'where', 'why',
  ]);
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
  const unique = [...new Set(words)];
  return unique.filter(w => w.length > 3 && !stopWords.has(w)).slice(0, 10);
}

export function addMemoryToGraph(sessionId: string, text: string): void {
  const keywords = extractKeywords(text);
  const now = Date.now();

  // Create or update node for this memory
  const memoryId = `mem-${sessionId}-${now}`;
  if (!nodes.has(memoryId)) {
    nodes.set(memoryId, {
      id: memoryId, label: text.substring(0, 60), type: 'memory',
      weight: 3, metadata: { sessionId }, created: now,
    });
  }

  // Create nodes for each keyword, connect to memory
  for (const kw of keywords) {
    if (!nodes.has(kw)) {
      nodes.set(kw, {
        id: kw, label: kw, type: 'concept',
        weight: Math.min(keywords.indexOf(kw) + 2, 8), created: now,
      });
    } else {
      const existing = nodes.get(kw)!;
      existing.weight = Math.min(existing.weight + 1, 10);
      nodes.set(kw, existing);
    }

    const edgeId = `${memoryId}-${kw}`;
    if (!edges.has(edgeId)) {
      edges.set(edgeId, {
        id: edgeId, source: memoryId, target: kw,
        label: 'mentions', weight: 2, created: now,
      });
    }
  }
}

export const graphAPI = {
  getAll(): KnowledgeGraph {
    return { nodes: [...nodes.values()], edges: [...edges.values()] };
  },

  getNode(id: string): KNode | undefined {
    return nodes.get(id);
  },

  findNode(label: string): KNode | undefined {
    for (const node of nodes.values()) {
      if (node.label.toLowerCase() === label.toLowerCase()) return node;
    }
    return undefined;
  },

  addNode(node: Omit<KNode, 'id' | 'created'>): KNode {
    const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newNode: KNode = { ...node, id, created: Date.now() };
    nodes.set(id, newNode);
    return newNode;
  },

  updateNode(id: string, updates: Partial<Omit<KNode, 'id' | 'created'>>): KNode | null {
    const existing = nodes.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    nodes.set(id, updated);
    return updated;
  },

  deleteNode(id: string): boolean {
    // Also remove all edges connected to this node
    for (const [eid, edge] of edges) {
      if (edge.source === id || edge.target === id) edges.delete(eid);
    }
    return nodes.delete(id);
  },

  addEdge(source: string, target: string, label: string): KEdge | null {
    if (!nodes.has(source) || !nodes.has(target)) return null;
    const id = `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newEdge: KEdge = { id, source, target, label, weight: 1, created: Date.now() };
    edges.set(id, newEdge);
    return newEdge;
  },

  deleteEdge(id: string): boolean {
    return edges.delete(id);
  },

  getConnections(nodeId: string): { nodes: KNode[]; edges: KEdge[] } {
    const connected = { nodes: new Set<string>(), edges: [] as KEdge[] };
    for (const edge of edges.values()) {
      if (edge.source === nodeId || edge.target === nodeId) {
        connected.edges.push(edge);
        connected.nodes.add(edge.source);
        connected.nodes.add(edge.target);
      }
    }
    connected.nodes.delete(nodeId);
    return {
      edges: connected.edges,
      nodes: [...connected.nodes].map(id => nodes.get(id)!),
    };
  },

  reset(): void {
    nodes.clear();
    edges.clear();
    seed();
  },
};

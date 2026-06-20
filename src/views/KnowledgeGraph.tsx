// src/views/KnowledgeGraph.tsx — Advanced graph with path finding, filtering, export
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  GitBranch, Plus, Trash2, Link2, RotateCcw, Search,
  Circle, Download, Route, X
} from 'lucide-react';
import { config } from '../config';

interface KNode {
  id: string; label: string; type: 'concept' | 'memory' | 'agent' | 'entity' | 'action';
  weight: number; metadata?: Record<string, any>; created: number;
}
interface KEdge { id: string; source: string; target: string; label: string; weight: number; created: number; }
interface Pos { x: number; y: number; vx: number; vy: number; }

const NODE_RADIUS = 28;
const TYPE_COLORS: Record<string, string> = {
  agent: '#3b82f6', concept: '#10b981', memory: '#f59e0b', entity: '#8b5cf6', action: '#ef4444',
};
const TYPE_GLOW: Record<string, string> = {
  agent: 'rgba(59,130,246,0.3)', concept: 'rgba(16,185,129,0.3)',
  memory: 'rgba(245,158,11,0.3)', entity: 'rgba(139,92,246,0.3)', action: 'rgba(239,68,68,0.3)',
};
const TYPES = ['agent', 'concept', 'memory', 'entity', 'action'] as const;

// BFS path finding
function findPath(nodes: KNode[], edges: KEdge[], from: string, to: string): { path: KNode[]; edges: KEdge[] } {
  if (from === to) return { path: [], edges: [] };
  const adj = new Map<string, string[]>();
  const edgeMap = new Map<string, KEdge[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push(e.target);
    adj.get(e.target)!.push(e.source);
    const key1 = `${e.source}-${e.target}`;
    const key2 = `${e.target}-${e.source}`;
    if (!edgeMap.has(key1)) edgeMap.set(key1, []);
    if (!edgeMap.has(key2)) edgeMap.set(key2, []);
    edgeMap.get(key1)!.push(e);
    edgeMap.get(key2)!.push(e);
  }

  const visited = new Set<string>([from]);
  const prev = new Map<string, { node: string; edge: KEdge | null }>();
  const queue = [from];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === to) break;
    for (const next of adj.get(cur) || []) {
      if (!visited.has(next)) {
        visited.add(next);
        const eKey = `${cur}-${next}`;
        const eList = edgeMap.get(eKey);
        prev.set(next, { node: cur, edge: eList?.[0] || null });
        queue.push(next);
      }
    }
  }

  if (!prev.has(to)) return { path: [], edges: [] };

  const pathNodes: KNode[] = [];
  const pathEdges: KEdge[] = [];
  let cur = to;
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  while (cur !== from) {
    const p = prev.get(cur);
    if (!p) break;
    const node = nodeMap.get(cur);
    if (node) pathNodes.unshift(node);
    if (p.edge) pathEdges.unshift(p.edge);
    cur = p.node;
  }
  const fromNode = nodeMap.get(from);
  if (fromNode) pathNodes.unshift(fromNode);
  return { path: pathNodes, edges: pathEdges };
}

export const KnowledgeGraphView: React.FC = () => {
  const [nodes, setNodes] = useState<KNode[]>([]);
  const [edges, setEdges] = useState<KEdge[]>([]);
  const [positions, setPositions] = useState<Map<string, Pos>>(new Map());
  const [selected, setSelected] = useState<string | null>(null);
  const [connections, setConnections] = useState<{ nodes: KNode[]; edges: KEdge[] }>({ nodes: [], edges: [] });
  const [search, setSearch] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set(TYPES));
  const [pathFrom, setPathFrom] = useState('');
  const [pathTo, setPathTo] = useState('');
  const [pathResult, setPathResult] = useState<{ path: KNode[]; edges: KEdge[] } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const animRef = useRef<number>(0);
  const dragging = useRef<string | null>(null);

  const fetchGraph = useCallback(async () => {
    try {
      const res = await fetch(`${config.API_BASE}/api/knowledge-graph`);
      if (res.ok) { const d = await res.json(); setNodes(d.nodes); setEdges(d.edges); }
    } catch { /* offline */ }
  }, []);
  useEffect(() => { fetchGraph(); }, [fetchGraph]);

  // Init positions
  useEffect(() => {
    setPositions(prev => {
      const next = new Map(prev);
      for (const node of nodes) {
        if (!next.has(node.id)) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 100 + Math.random() * 150;
          next.set(node.id, { x: 300 + Math.cos(angle) * dist, y: 300 + Math.sin(angle) * dist, vx: 0, vy: 0 });
        }
      }
      return next;
    });
  }, [nodes.length]);

  // Force simulation
  const simRef = useRef<Map<string, Pos>>(new Map());
  const edgeListRef = useRef<KEdge[]>([]);
  useEffect(() => {
    simRef.current = new Map(positions);
    edgeListRef.current = edges;
  }, [positions, edges]);

  useEffect(() => {
    let running = true;
    const step = () => {
      if (!running) return;
      const sim = simRef.current;
      const edgeList = edgeListRef.current;
      const center = { x: 400, y: 350 };
      for (const [, a] of sim) {
        a.vx += (center.x - a.x) * 0.001;
        a.vy += (center.y - a.y) * 0.001;
      }
      for (const [id, a] of sim) {
        for (const [jid, b] of sim) {
          if (id >= jid) continue;
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 3000 / (dist * dist);
          a.vx += (dx / dist) * force; a.vy += (dy / dist) * force;
          b.vx -= (dx / dist) * force; b.vy -= (dy / dist) * force;
        }
      }
      for (const edge of edgeList) {
        const a = sim.get(edge.source), b = sim.get(edge.target);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = 80 + NODE_RADIUS * 2;
        const force = (dist - targetDist) * 0.005;
        a.vx += (dx / dist) * force; a.vy += (dy / dist) * force;
        b.vx -= (dx / dist) * force; b.vy -= (dy / dist) * force;
      }
      for (const [, p] of sim) { p.vx *= 0.9; p.vy *= 0.9; p.x += p.vx; p.y += p.vy;
        p.x = Math.max(50, Math.min(750, p.x)); p.y = Math.max(50, Math.min(650, p.y)); }
      setPositions(new Map(sim));
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, []);

  const selectNode = async (id: string) => {
    setSelected(id === selected ? null : id);
    if (id !== selected) {
      try {
        const res = await fetch(`${config.API_BASE}/api/knowledge-graph/nodes/${id}/connections`);
        if (res.ok) setConnections(await res.json());
      } catch { /* offline */ }
    }
  };

  const addNode = async () => {
    const label = prompt('Node label:');
    if (!label) return;
    const type = prompt('Type (agent/concept/memory/entity/action):', 'concept') || 'concept';
    try {
      const res = await fetch(`${config.API_BASE}/api/knowledge-graph/nodes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, type, weight: 1 }),
      });
      if (res.ok) {
        const nn = await res.json();
        setNodes(prev => [...prev, nn]);
        setPositions(prev => { const n = new Map(prev); n.set(nn.id, { x: 300 + Math.random() * 200, y: 300 + Math.random() * 200, vx: 0, vy: 0 }); return n; });
      }
    } catch { /* offline */ }
  };

  const deleteSelected = async () => {
    if (!selected) return;
    try {
      await fetch(`${config.API_BASE}/api/knowledge-graph/nodes/${selected}`, { method: 'DELETE' });
      setNodes(prev => prev.filter(n => n.id !== selected));
      setEdges(prev => prev.filter(e => e.source !== selected && e.target !== selected));
      setSelected(null);
    } catch { /* offline */ }
  };

  const connectNodes = async () => {
    if (!selected) return;
    const targetId = prompt('Target node ID:');
    if (!targetId) return;
    const label = prompt('Edge label:', 'connected_to') || 'connected_to';
    try {
      const res = await fetch(`${config.API_BASE}/api/knowledge-graph/edges`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: selected, target: targetId, label }),
      });
      if (res.ok) { const e = await res.json(); setEdges(prev => [...prev, e]); }
    } catch { /* offline */ }
  };

  const resetGraph = async () => {
    try { await fetch(`${config.API_BASE}/api/knowledge-graph/reset`, { method: 'POST' }); fetchGraph(); } catch { /* offline */ }
  };

  const exportGraph = () => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'zuvix-knowledge-graph.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFindPath = () => {
    const from = pathFrom || selected || '';
    const to = pathTo || '';
    if (!from || !to) return;
    setPathResult(findPath(nodes, edges, from, to));
  };

  const toggleTypeFilter = (t: string) => {
    setTypeFilter(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const filteredNodes = nodes.filter(n =>
    typeFilter.has(n.type) &&
    (!search.trim() || n.label.toLowerCase().includes(search.toLowerCase()) || n.id.includes(search))
  );
  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredEdges = edges.filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));
  const relevantNodeIds = selected ? new Set([selected, ...connections.nodes.map(n => n.id)]) : null;
  const pathNodeIds = pathResult ? new Set(pathResult.path.map(n => n.id)) : null;
  const pathEdgeKeys = pathResult ? new Set(pathResult.edges.map(e => `${e.source}-${e.target}`)) : null;

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <GitBranch size={24} style={{ color: 'var(--primary)' }} /> Knowledge Graph
          </h1>
          <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>
            {filteredNodes.length} nodes · {filteredEdges.length} edges · {pathResult ? `Path: ${pathResult.path.map(n => n.label).join(' → ')}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 8, top: 7, color: '#666' }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search..." className="glass-input"
              style={{ padding: '5px 8px 5px 24px', fontSize: 11, width: 130 }} />
          </div>
          {TYPES.map(t => (
            <button key={t} onClick={() => toggleTypeFilter(t)}
              className="glass-btn" style={{ padding: '4px 8px', fontSize: 10, border: typeFilter.has(t) ? `1px solid ${TYPE_COLORS[t]}44` : '1px solid transparent', color: typeFilter.has(t) ? TYPE_COLORS[t] : '#666' }}>
              <Circle size={6} fill={TYPE_COLORS[t]} stroke="none" style={{ marginRight: 3 }} />{t}
            </button>
          ))}
          <button onClick={exportGraph} className="glass-btn" style={{ padding: '5px 8px' }}><Download size={11} /></button>
          <button onClick={addNode} className="glass-btn" style={{ padding: '5px 8px' }}><Plus size={11} /></button>
          <button onClick={connectNodes} disabled={!selected} className="glass-btn" style={{ padding: '5px 8px' }}><Link2 size={11} /></button>
          <button onClick={deleteSelected} disabled={!selected} className="glass-btn" style={{ padding: '5px 8px', color: '#ef4444' }}><Trash2 size={11} /></button>
          <button onClick={resetGraph} className="glass-btn" style={{ padding: '5px 8px' }}><RotateCcw size={11} /></button>
        </div>
      </div>

      {/* Path finding bar */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '8px 12px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px' }}>
        <Route size={13} style={{ color: '#888' }} />
        <input type="text" value={pathFrom || selected || ''} onChange={e => setPathFrom(e.target.value)}
          placeholder="From node ID..." className="dynamic-input" style={{ padding: '5px 8px', fontSize: 11, width: 120, fontFamily: 'var(--font-mono)' }} />
        <span style={{ color: '#555', fontSize: 11 }}>→</span>
        <input type="text" value={pathTo} onChange={e => setPathTo(e.target.value)}
          placeholder="To node ID..." className="dynamic-input" style={{ padding: '5px 8px', fontSize: 11, width: 120, fontFamily: 'var(--font-mono)' }} />
        <button onClick={handleFindPath} className="glass-btn glass-btn-primary" style={{ padding: '5px 10px', fontSize: 10 }}>Find Path</button>
        {pathResult && <button onClick={() => setPathResult(null)} className="glass-btn" style={{ padding: '5px 8px', fontSize: 10 }}><X size={10} /> Clear</button>}
      </div>

      <div style={{ display: 'flex', gap: '16px', flex: 1, overflow: 'hidden' }}>
        {/* Canvas */}
        <div style={{ flex: 1, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '14px', overflow: 'hidden', position: 'relative' }}>
          <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 800 700"
            onMouseMove={e => { if (dragging.current) { const r = svgRef.current?.getBoundingClientRect(); if (r) { setPositions(prev => { const n = new Map(prev); const p = n.get(dragging.current!); if (p) { p.x = e.clientX - r.left; p.y = e.clientY - r.top; } return n; }); } } }}
            onMouseUp={() => dragging.current = null}
            onClick={e => { if (e.target === svgRef.current) { setSelected(null); setPathResult(null); } }}
            style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}>
            {filteredEdges.map(e => {
              const a = positions.get(e.source), b = positions.get(e.target);
              if (!a || !b) return null;
              const edgeKey = `${e.source}-${e.target}`;
              const inPath = pathEdgeKeys?.has(edgeKey) || pathEdgeKeys?.has(`${e.target}-${e.source}`);
              const isConn = selected && (e.source === selected || e.target === selected);
              const dx = b.x - a.x, dy = b.y - a.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const nx = -(dy / dist) * NODE_RADIUS, ny = (dx / dist) * NODE_RADIUS;
              const sw = inPath ? 3 : isConn ? 1.5 : 0.8;
              const color = inPath ? '#f59e0b' : isConn ? '#3b82f6' : 'rgba(255,255,255,0.06)';
              return (
                <g key={e.id}>
                  <line x1={a.x + nx} y1={a.y + ny} x2={b.x - nx} y2={b.y - ny}
                    stroke={color} strokeWidth={sw} strokeOpacity={inPath ? 1 : isConn ? 0.5 : 0.3} />
                  {inPath && <line x1={a.x + nx} y1={a.y + ny} x2={b.x - nx} y2={b.y - ny}
                    stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 3" opacity={0.4} />}
                </g>
              );
            })}
            {filteredNodes.map(node => {
              const p = positions.get(node.id);
              if (!p) return null;
              const isSelected = selected === node.id;
              const isConn = selected && relevantNodeIds?.has(node.id) && node.id !== selected;
              const inPath = pathNodeIds?.has(node.id);
              const radius = NODE_RADIUS + (node.weight * 0.5);
              const color = TYPE_COLORS[node.type] || '#888';
              const glow = TYPE_GLOW[node.type] || 'rgba(136,136,136,0.2)';
              const isHovered = hovered === node.id;
              return (
                <g key={node.id}
                  onMouseDown={() => { dragging.current = node.id; }}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={e => { e.stopPropagation(); selectNode(node.id); }}
                  style={{ cursor: 'pointer' }}>
                  {isSelected && <circle cx={p.x} cy={p.y} r={radius + 6} fill="none" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 3" opacity={0.6} className="connecting-line" />}
                  {inPath && <circle cx={p.x} cy={p.y} r={radius + 8} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 3" opacity={0.5} />}
                  <circle cx={p.x} cy={p.y} r={radius} fill={glow} />
                  <circle cx={p.x} cy={p.y} r={radius - 2}
                    fill={isSelected ? '#1e293b' : '#0f172a'}
                    stroke={inPath ? '#f59e0b' : isConn ? '#3b82f6' : isHovered ? color : 'rgba(255,255,255,0.1)'}
                    strokeWidth={inPath ? 2.5 : isConn ? 2 : isHovered ? 1.5 : 1}
                    opacity={isSelected || !selected || inPath ? 1 : isConn ? 0.8 : 0.4} />
                  <circle cx={p.x + radius - 6} cy={p.y - radius + 6} r={4} fill={color} />
                  <text x={p.x} y={p.y + radius + 14} textAnchor="middle"
                    fill={isSelected || inPath || !selected ? '#e2e8f0' : isConn ? '#94a3b8' : '#555'}
                    fontSize={10} fontWeight={isSelected || inPath ? 700 : 400} fontFamily="system-ui">
                    {node.label.length > 16 ? node.label.substring(0, 15) + '…' : node.label}
                  </text>
                  <text x={p.x} y={p.y + 4} textAnchor="middle" fill="#888" fontSize={9} fontFamily="var(--font-mono)">
                    {node.weight}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Side Panel */}
        {selected && (() => {
          const node = nodeMap.get(selected);
          if (!node) return null;
          return (
            <div style={{ width: 240, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
              <div style={{ padding: 14, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Circle size={8} fill={TYPE_COLORS[node.type] || '#888'} stroke="none" />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{node.label}</span>
                </div>
                <div style={{ fontSize: 10, color: '#888', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div><span style={{ color: '#555' }}>ID:</span> <code style={{ fontSize: 9 }}>{node.id}</code></div>
                  <div><span style={{ color: '#555' }}>Type:</span> {node.type} · Weight: {node.weight}</div>
                  <div><span style={{ color: '#555' }}>Created:</span> {new Date(node.created).toLocaleString()}</div>
                </div>
              </div>
              <div style={{ padding: 14, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Connections ({connections.nodes.length})</div>
                {connections.nodes.length === 0 ? (
                  <div style={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>None</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {connections.nodes.map(cn => (
                      <button key={cn.id} onClick={() => selectNode(cn.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 5, cursor: 'pointer', color: 'inherit', textAlign: 'left', fontSize: 10, width: '100%' }}>
                        <Circle size={5} fill={TYPE_COLORS[cn.type] || '#888'} stroke="none" />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cn.label}</span>
                        <span style={{ color: '#555', fontSize: 9 }}>{cn.type}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {pathResult && pathResult.path.length > 0 && (
                <div style={{ padding: 14, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: '#f59e0b' }}>Path ({pathResult.path.length} nodes)</div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', lineHeight: 1.8, color: '#94a3b8' }}>
                    {pathResult.path.map((n, i) => (
                      <span key={n.id}>{i > 0 && <span style={{ color: '#f59e0b' }}> → </span>}{n.label}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
};
export default KnowledgeGraphView;

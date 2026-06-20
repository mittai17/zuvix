/* src/components/NodeGraph.tsx */
import React from 'react';
import type { AgentNode, Connection } from '../store/agentStore';

interface NodeGraphProps {
  agents: AgentNode[];
  connections: Connection[];
  onAgentClick?: (agent: AgentNode) => void;
  selectedAgentId?: string | null;
}

export const NodeGraph: React.FC<NodeGraphProps> = ({
  agents,
  connections,
  onAgentClick,
  selectedAgentId
}) => {
  return (
    <div 
      className="node-graph-wrapper"
      style={{
        position: 'relative',
        width: '100%',
        height: '400px',
        backgroundColor: '#0c0f1d',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.6)'
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 600 400" style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <linearGradient id="link-grad-active" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="50%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          
          <linearGradient id="link-grad-selected" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>

          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          <filter id="selected-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
            <feComponentTransfer in="coloredBlur" result="boostedBlur">
              <feFuncA type="linear" slope="1.5"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="boostedBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          <filter id="deep-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
            <feComponentTransfer in="coloredBlur" result="boostedBlur">
              <feFuncA type="linear" slope="2"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="boostedBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          <radialGradient id="visor-grad" cx="70%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#93c5fd" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </radialGradient>

          {/* High-End Among Us Character Component */}
          <g id="among-us">
            <ellipse cx="0" cy="22" rx="16" ry="5" fill="rgba(0,0,0,0.6)" filter="blur(2px)" />
            <g stroke="#000" strokeWidth="2.5" strokeLinejoin="round">
              <path d="M-13,-4 Q-17,-4 -17,5 L-17,9 Q-17,14 -13,14 L-11,14 L-11,-4 Z" fill="currentColor" />
              <path d="M-11,-12 Q-11,-22 0,-22 Q11,-22 11,-12 L11,14 Q11,21 6,21 L3,21 Q2,21 2,19 L2,12 Q2,11 1,11 L-1,11 Q-2,11 -2,12 L-2,19 Q-2,21 -3,21 L-6,21 Q-11,21 -11,14 Z" fill="currentColor" />
            </g>
            <path d="M-8,-12 Q-8,-19 0,-19 Q8,-19 8,-12" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
            <path d="M-14,0 L-14,8" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            <path d="M-3,-11 Q-3,-16 6,-16 Q15,-16 15,-11 L15,-3 Q15,2 6,2 Q-3,2 -3,-3 Z" fill="url(#visor-grad)" stroke="#000" strokeWidth="2" />
            <path d="M1,-11 Q1,-13 6,-13 Q11,-13 11,-11" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* Data flow particle (small circle traveling along connection) */}
          <circle id="data-particle" r="3" fill="#fbbf24" filter="url(#glow)" />

          {/* Sci-fi Workbench / Server Rack */}
          <g id="workbench">
            <rect x="-45" y="-35" width="90" height="70" rx="8" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" filter="url(#glow)" />
            <rect x="-35" y="-25" width="70" height="15" fill="#020617" rx="3" />
            <circle cx="-25" cy="-17" r="3" fill="#10b981" filter="url(#glow)" />
            <circle cx="-15" cy="-17" r="3" fill="#3b82f6" filter="url(#glow)" />
            <circle cx="-5" cy="-17" r="3" fill="#8b5cf6" />
            <rect x="-35" y="-5" width="70" height="15" fill="#020617" rx="3" />
            <circle cx="-25" cy="2" r="3" fill="#ef4444" filter="url(#glow)" />
            <rect x="5" y="2" width="20" height="4" fill="#f59e0b" rx="2" filter="url(#glow)" />
            <rect x="-35" y="15" width="70" height="10" fill="#020617" rx="3" />
            <path d="M-45,35 L45,35 L55,45 L-55,45 Z" fill="#1e293b" opacity="0.8" />
          </g>
        </defs>

        {/* Central Server/Workbench */}
        <g transform="translate(300, 200)">
          <use href="#workbench" />
          <text y="45" textAnchor="middle" fill="#888" fontSize="10" fontWeight="bold">ZUVIX CORE</text>
        </g>

        {/* Draw Connections */}
        {connections.map((conn, index) => {
          const fromNode = agents.find(a => a.id === conn.from);
          const toNode = agents.find(a => a.id === conn.to);

          if (!fromNode || !toNode) return null;

          const x1 = fromNode.x + 50, y1 = fromNode.y + 50;
          const x2 = toNode.x + 50, y2 = toNode.y + 50;
          const isSelectedFrom = selectedAgentId === conn.from;
          const isSelectedTo = selectedAgentId === conn.to;
          const isHighlighted = isSelectedFrom || isSelectedTo;

          return (
            <g key={index}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={isHighlighted ? 'url(#link-grad-selected)' : conn.active ? 'url(#link-grad-active)' : 'rgba(255, 255, 255, 0.08)'}
                strokeWidth={isHighlighted ? 4 : conn.active ? 3 : 1.5}
                strokeDasharray={conn.active ? "none" : "4 4"}
                strokeLinecap="round"
                filter={isHighlighted ? 'url(#selected-glow)' : conn.active ? 'url(#glow)' : 'none'}
                style={{ transition: 'stroke 0.4s, stroke-width 0.4s' }}
              />
              {conn.active && (
                <>
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="#ffffff"
                    strokeWidth={2}
                    className="connecting-line"
                    strokeLinecap="round"
                    filter="url(#glow)"
                  />
                  {/* Data flow particles */}
                  <g className="data-flow">
                    <use href="#data-particle" className="data-particle" style={{ '--x1': x1, '--y1': y1, '--x2': x2, '--y2': y2 } as React.CSSProperties} />
                    <use href="#data-particle" className="data-particle" style={{ '--x1': x1, '--y1': y1, '--x2': x2, '--y2': y2, animationDelay: '0.8s' } as React.CSSProperties} />
                  </g>
                </>
              )}
            </g>
          );
        })}

        {/* Draw Agent Characters */}
        {agents.map((agent, i) => {
          const isActive = agent.status === 'thinking' || agent.status === 'busy';
          const isError = agent.status === 'error';
          const isSelected = selectedAgentId === agent.id;

          const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
          const charColor = isError ? '#991b1b' : colors[i % colors.length];
          const animationClass = isActive ? "agent-bob-active" : "agent-bob-idle";

          return (
            <g 
              key={agent.id} 
              transform={`translate(${agent.x + 50}, ${agent.y + 50})`}
              onClick={() => onAgentClick?.(agent)}
              className={animationClass}
              style={{ cursor: 'pointer' }}
            >
              {/* Selection ring */}
              {isSelected && (
                <circle cx="0" cy="0" r="28" fill="none" stroke="#fbbf24" strokeWidth="2"
                  filter="url(#selected-glow)" className="selection-pulse" />
              )}
              {/* Error ring */}
              {isError && !isSelected && (
                <circle cx="0" cy="0" r="24" fill="none" stroke="#ef4444" strokeWidth="1.5"
                  strokeDasharray="3 3" opacity="0.6" />
              )}

              {/* Crewmate Avatar */}
              <use href="#among-us" style={{ color: isSelected ? '#fbbf24' : charColor }} />

              {/* Status Indicator Bubble */}
              {agent.status === 'thinking' && (
                <g transform="translate(15, -25)">
                  <ellipse cx="0" cy="0" rx="12" ry="8" fill="#fff" />
                  <circle cx="-2" cy="0" r="1.5" fill="#000" />
                  <circle cx="2" cy="0" r="1.5" fill="#000" />
                  <circle cx="6" cy="0" r="1.5" fill="#000" />
                  <circle cx="-8" cy="8" r="2" fill="#fff" />
                  <circle cx="-12" cy="12" r="1" fill="#fff" />
                </g>
              )}

              {/* Tool Execution Tag */}
              {agent.currentTool && agent.status === 'busy' && (
                <g transform="translate(0, -35)">
                  <rect x="-40" y="-10" width="80" height="16" rx="4"
                    fill="var(--primary)"
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                  />
                  <text textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold" y="1">
                    {agent.currentTool}
                  </text>
                </g>
              )}

              {/* Node Text Label */}
              <text textAnchor="middle" y="32" fill={isSelected ? '#fbbf24' : 'var(--text-main)'} fontSize="11" fontWeight={isSelected ? 700 : 600}
                style={{ letterSpacing: '0.5px', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}>
                {agent.name}
              </text>
              <text textAnchor="middle" y="44" fill="var(--text-muted)" fontSize="9">
                {agent.role}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
export default NodeGraph;

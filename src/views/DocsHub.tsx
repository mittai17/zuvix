/* src/views/DocsHub.tsx */
import React, { useState } from 'react';
import Card from '../components/Card';
import { BookOpen, ShieldAlert, Cpu, Database, ChevronRight } from 'lucide-react';

interface DocSection {
  id: string;
  title: string;
  category: string;
  icon: React.ReactNode;
  content: string;
}

export const DocsHub: React.FC = () => {
  const sections: DocSection[] = [
    {
      id: 'architecture',
      title: 'Platform Architecture',
      category: 'Overview',
      icon: <Cpu size={16} color="var(--primary)" />,
      content: `### Architecture Overview
**Zuvix** is a cross-platform autonomous agent client built on local-first principles. It integrates the core capabilities of **OpenClaw** (messaging connectivity, MCP server integration, task routing) with **Nous Research's Hermes Agent** (self-improving loop, skill persistence, vector-based long-term memory retrieval).

#### Key Components:
1. **Agent OS Kernel:** Orchestrates multi-agent execution threads. When a task is started, a planning agent parses user goals, generates sub-goals, and spawns specialised sub-agents (researcher, coder, verifier) to execute them.
2. **WebMCP Bridge:** Runs client-side browser tools. It registers functions dynamically in the tab container, allowing agents to execute DOM manipulations, form submissions, and local scrapes.
3. **Database Sync Layer:** Integrates local IndexedDB (powered by RxDB) with a Supabase PostgreSQL server. Any memory block, tool dependency, or newly-learned skill is synced in real-time, enabling Chrome-to-Firefox and Mobile-to-Desktop replication.

\`\`\`
  +-------------------------------------------------------+
  |                      Zuvix UI                         |
  |      (Glassmorphism / Neomorphism / Claymorphism)      |
  +-------------------------------------------------------+
                             |
                             v
  +-------------------------------------------------------+
  |                  Agent OS Kernel                      |
  |     [Planner] <--> [Coder] <--> [QA Verifier]          |
  +-------------------------------------------------------+
            |                                |
            v                                v
  +-------------------+            +---------------------+
  |   WebMCP Bridge   |            | Database Sync Layer |
  | (Local browser tab) |            | (IndexedDB/Supabase)|
  +-------------------+            +---------------------+
\`\`\``
    },
    {
      id: 'hermes-loop',
      title: 'Self-Improving Learning Loop',
      category: 'Hermes Engine',
      icon: <BookOpen size={16} color="var(--secondary)" />,
      content: `### Hermes Self-Improving Loop
Standard AI agents encounter runtime errors and fail. The Hermes engine inside Zuvix executes a recursive improvement loop:

1. **Failure Interception:** If a spawned agent attempts to run a tool and encounters an API failure or missing capability, the error logs are fed back to the Coordinator.
2. **Code Generation:** The Coordinator initiates a code generation cycle to build a standalone, reusable TypeScript/JavaScript tool (packaged as a "Skill").
3. **Sandbox Verification:** The newly created code is written to a temporary test file. A QA agent runs a linter and executes test suites against mock data to verify execution safety.
4. **Local Registry & Sync:** If tests pass, the skill is finalized (packaged with a \`SKILL.md\` instructions file) and stored in the database.
5. **Context Expansion:** The next time the agent runs, the newly-learned skill is automatically loaded into the active system context.`
    },
    {
      id: 'sync-system',
      title: 'Database & Supabase Sync',
      category: 'Data Layer',
      icon: <Database size={16} color="var(--success)" />,
      content: `### Sync Mechanics
To achieve cross-device synchronization between desktop apps, server terminals, and mobile layouts, Zuvix uses a local-first sync loop:

#### Database Schema:
- **chat_sessions:** Keeps track of conversational histories and user prompts.
- **skills:** Stores the TypeScript code, descriptions, and dependency metadata for all registered tools.
- **dependencies:** Records active MCP servers (URLs, auth headers) and node packages.
- **memory_blocks:** Vector embeddings representing facts, summaries, and learned context.

#### Conflict Resolution:
- Zuvix uses **Last-Write-Wins (LWW-Element-Set)** CRDTs based on client updates. If a skill is edited offline on mobile, it caches the edit. Once an internet connection is established, the Supabase sync engine compares timestamps and merges the changes.
- In the event of schema updates or dependency additions (like new MCP servers), the sync engine triggers hot-reloads of active agents so they are instantly aware of new tools.`
    }
  ];

  const [activeSectionId, setActiveSectionId] = useState<string>('architecture');
  const activeSection = sections.find(s => s.id === activeSectionId) || sections[0];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
      
      {/* View Header */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px' }}>Reference Documentation</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Explore detailed specifications of Zuvix's internal engines, multi-agent workspaces, WebMCP configurations, and sync schemas.
        </p>
      </div>

      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '24px', flex: 1, minHeight: '400px' }}>
        
        {/* Left Column: Doc Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card variant="dynamic" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Chapters</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sections.map((section) => {
                const isActive = section.id === activeSectionId;
                return (
                  <div
                    key={section.id}
                    onClick={() => setActiveSectionId(section.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: isActive ? 'rgba(124, 58, 237, 0.1)' : 'rgba(0, 0, 0, 0.15)',
                      border: isActive ? '1px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.05)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {section.icon}
                      <span style={{ fontSize: '13px', fontWeight: 600, color: isActive ? 'var(--text-main)' : 'var(--text-sub)' }}>{section.title}</span>
                    </div>
                    <ChevronRight size={14} color={isActive ? 'var(--primary)' : 'var(--text-muted)'} />
                  </div>
                );
              })}
            </div>
          </Card>

          <Card variant="dynamic" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--warning)', fontWeight: 600 }}>
              <ShieldAlert size={14} /> Security Notice
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Always run spawned skills in sandboxed environments (e.g. Docker container node interpretators) to prevent malicious filesystem access or arbitrary API command executions.
            </p>
          </Card>
        </div>

        {/* Right Column: Doc Reader */}
        <Card variant="dynamic" style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '380px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
              {activeSection.category}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Zuvix Manual v1.0</span>
          </div>

          <div 
            className="scroll-container" 
            style={{ 
              flex: 1, 
              lineHeight: '1.7', 
              fontSize: '14px', 
              color: 'var(--text-sub)',
              textAlign: 'left'
            }}
          >
            {/* Simple manual formatting for markdown style */}
            {activeSection.content.split('\n\n').map((para, pIdx) => {
              if (para.startsWith('### ')) {
                return <h2 key={pIdx} style={{ fontSize: '20px', color: 'var(--text-main)', fontWeight: 700, margin: '24px 0 12px 0' }}>{para.substring(4)}</h2>;
              }
              if (para.startsWith('#### ')) {
                return <h3 key={pIdx} style={{ fontSize: '16px', color: 'var(--text-main)', fontWeight: 600, margin: '18px 0 8px 0' }}>{para.substring(5)}</h3>;
              }
              if (para.startsWith('**') && para.endsWith('**')) {
                return <p key={pIdx} style={{ fontWeight: 'bold', margin: '12px 0' }}>{para.replace(/\*\*/g, '')}</p>;
              }
              if (para.startsWith('- ') || para.startsWith('* ')) {
                return (
                  <ul key={pIdx} style={{ paddingLeft: '20px', margin: '12px 0' }}>
                    {para.split('\n').map((li, lIdx) => (
                      <li key={lIdx} style={{ marginBottom: '6px' }}>
                        {li.replace(/^[\-\*]\s+/, '').replace(/\*\*([^*]+)\*\*/g, '$1')}
                      </li>
                    ))}
                  </ul>
                );
              }
              if (para.startsWith('```')) {
                const lines = para.split('\n');
                const codeLines = lines.slice(1, lines.length - 1).join('\n');
                return (
                  <pre key={pIdx} style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontSize: '12px', 
                    backgroundColor: '#0a0d16', 
                    padding: '16px', 
                    borderRadius: '8px', 
                    overflowX: 'auto',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    margin: '16px 0',
                    color: '#cbd5e1'
                  }}>
                    <code>{codeLines}</code>
                  </pre>
                );
              }
              return <p key={pIdx} style={{ marginBottom: '16px' }}>{para}</p>;
            })}
          </div>
        </Card>

      </div>
    </div>
  );
};
export default DocsHub;

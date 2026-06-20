/* src/components/Terminal.tsx */
import React, { useEffect, useRef } from 'react';
import type { LogEntry } from '../store/agentStore';

interface TerminalProps {
  logs: LogEntry[];
  title?: string;
}

export const Terminal: React.FC<TerminalProps> = ({ logs, title = 'Agent OS Console' }) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLogStyle = (type: LogEntry['type']) => {
    switch (type) {
      case 'thought':
        return { color: 'var(--text-muted)', fontStyle: 'italic' };
      case 'tool':
        return { color: 'hsl(190, 85%, 65%)' };
      case 'success':
        return { color: 'var(--success)' };
      case 'error':
        return { color: 'var(--danger)', fontWeight: 'bold' };
      default:
        return { color: 'var(--text-main)' };
    }
  };

  return (
    <div 
      className="terminal-container" 
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#0a0d16',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
        fontFamily: 'var(--font-mono)',
        fontSize: '13px'
      }}
    >
      {/* Window Controls */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          backgroundColor: '#111625',
          borderBottom: '1px solid rgba(255, 255, 255, 0.04)'
        }}
      >
        <div style={{ display: 'flex', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#eab308' }}></span>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 500 }}>{title}</div>
        <div style={{ width: '42px' }}></div> {/* Spacing balance */}
      </div>

      {/* Terminal Output */}
      <div 
        style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          lineHeight: '1.6',
          textAlign: 'left'
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>
            $ system_ready: Zuvix Kernel loaded. Waiting for task input...
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} style={{ marginBottom: '8px', wordBreak: 'break-word' }}>
              <span style={{ color: 'var(--primary)', marginRight: '8px' }}>
                [{log.timestamp}]
              </span>
              <span style={{ color: 'var(--secondary)', marginRight: '6px', fontWeight: 600 }}>
                {log.agentName}:
              </span>
              <span style={getLogStyle(log.type)}>
                {log.type === 'thought' && '🧠 '}
                {log.type === 'tool' && '🔧 '}
                {log.type === 'success' && '✨ '}
                {log.type === 'error' && '🚨 '}
                {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};
export default Terminal;

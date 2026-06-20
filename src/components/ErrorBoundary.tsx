/* src/components/ErrorBoundary.tsx */
import React from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props { children: React.ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, textAlign: 'center', color: '#ef4444' }}>
          <AlertTriangle size={48} style={{ margin: '0 auto 16px' }} />
          <h2 style={{ marginBottom: 8 }}>Something broke</h2>
          <pre style={{ fontSize: 12, color: '#888', marginBottom: 16, maxWidth: 600, margin: '0 auto 16px', whiteSpace: 'pre-wrap' }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="glass-btn"
            style={{ margin: '0 auto' }}
          >
            <RotateCcw size={14} /> Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

/* src/hooks/useWebSocket.ts */
import { useEffect, useRef, useState, useCallback } from 'react'
import { config } from '../config'

interface UseWebSocketOptions {
  url?: string
  onMessage?: (msg: any) => void
  onStatus?: (connected: boolean) => void
  autoReconnect?: boolean
}

export function useWebSocket({ url, onMessage, onStatus, autoReconnect = true }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const retriesRef = useRef(0)

  const connect = useCallback(() => {
    const wsUrl = url || config.WS_URL
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      setConnected(true)
      retriesRef.current = 0
      onStatus?.(true)
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        onMessage?.(msg)
      } catch { /* skip unparseable */ }
    }

    ws.onclose = () => {
      setConnected(false)
      onStatus?.(false)
      if (autoReconnect) {
        const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30000)
        retriesRef.current++
        setTimeout(connect, delay)
      }
    }

    ws.onerror = () => ws.close()
    wsRef.current = ws
  }, [url, onMessage, onStatus, autoReconnect])

  useEffect(() => {
    connect()
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
      }
    }
  }, [connect])

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { connected, send }
}

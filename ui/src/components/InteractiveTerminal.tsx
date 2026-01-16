/**
 * Interactive terminal emulator for a single terminal id (xterm.js).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface Props {
  projectName: string
  terminalId: string
  isActive: boolean
}

const TERMINAL_THEME = {
  background: '#1a1a1a',
  foreground: '#ffffff',
  cursor: '#ff006e',
  cursorAccent: '#1a1a1a',
  selectionBackground: 'rgba(255, 0, 110, 0.3)',
  selectionForeground: '#ffffff',
} as const

const RECONNECT_DELAY_BASE = 1000
const RECONNECT_DELAY_MAX = 30000

export function InteractiveTerminal({ projectName, terminalId, isActive }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectAttempts = useRef(0)
  const isConnectingRef = useRef(false)
  const isManualCloseRef = useRef(false)
  const isActiveRef = useRef(isActive)

  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  const encodeBase64 = useCallback((str: string): string => {
    const encoder = new TextEncoder()
    const bytes = encoder.encode(str)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  }, [])

  const decodeBase64ToBytes = useCallback((b64: string): Uint8Array => {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  }, [])

  const sendResize = useCallback(() => {
    const term = terminalRef.current
    const ws = wsRef.current
    if (!term || !ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
  }, [])

  const connect = useCallback(() => {
    if (!projectName || !terminalId || !isActiveRef.current) return
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return
    }
    if (isConnectingRef.current) return
    isConnectingRef.current = true
    isManualCloseRef.current = false

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/ws/projects/${encodeURIComponent(projectName)}/terminal/${encodeURIComponent(terminalId)}`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      isConnectingRef.current = false
      setIsConnected(true)
      reconnectAttempts.current = 0
      sendResize()
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as { type: string; data?: string; message?: string }
        if (message.type === 'output' && message.data) {
          const bytes = decodeBase64ToBytes(message.data)
          terminalRef.current?.write(bytes)
        } else if (message.type === 'error' && message.message) {
          terminalRef.current?.writeln(`\r\n[server error] ${message.message}\r\n`)
        }
      } catch {
        // ignore
      }
    }

    ws.onclose = () => {
      setIsConnected(false)
      isConnectingRef.current = false
      wsRef.current = null
      if (isManualCloseRef.current) return
      if (!isActiveRef.current) return

      const delay = Math.min(RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttempts.current), RECONNECT_DELAY_MAX)
      reconnectAttempts.current++
      reconnectTimeoutRef.current = window.setTimeout(() => connect(), delay)
    }

    ws.onerror = () => {
      try {
        ws.close()
      } catch {
        // ignore
      }
    }
  }, [projectName, terminalId, decodeBase64ToBytes, sendResize])

  useEffect(() => {
    if (!containerRef.current) return
    if (terminalRef.current) return

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 12,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      theme: TERMINAL_THEME,
      convertEol: true,
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    terminalRef.current = term
    fitAddonRef.current = fitAddon

    term.onData((data) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      ws.send(JSON.stringify({ type: 'input', data: encodeBase64(data) }))
    })

    const onResize = () => {
      fitAddonRef.current?.fit()
      sendResize()
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      term.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [encodeBase64, sendResize])

  useEffect(() => {
    // Active tab connects; inactive tab closes.
    if (!isActive) {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      if (wsRef.current) {
        isManualCloseRef.current = true
        wsRef.current.close()
        wsRef.current = null
      }
      setIsConnected(false)
      return
    }

    // Fit before connecting so we send correct cols/rows.
    fitAddonRef.current?.fit()
    connect()

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      if (wsRef.current) {
        isManualCloseRef.current = true
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [isActive, connect])

  return (
    <div className="h-full w-full overflow-hidden border border-[#333] bg-[#1a1a1a]">
      <div className="flex items-center justify-between px-2 py-1 border-b border-[#333] bg-[#111]">
        <div className="text-[11px] font-mono text-gray-400">
          {isConnected ? 'connected' : 'disconnected'}
        </div>
      </div>
      <div className="h-[calc(100%-28px)]" ref={containerRef} />
    </div>
  )
}


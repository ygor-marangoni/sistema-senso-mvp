import { useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'

const minimumBoardWidth = 820
const gatewayKey = 'gateway'
const interpreterKey = 'interpreter'
const nodeWidth = { gateway: 166, sensor: 174, room: 180, interpreter: 190 }
const nodeHeight = { gateway: 116, sensor: 96, room: 92, interpreter: 92 }

function roomIcon(name) {
  if (/cozinha/i.test(name)) return 'kitchen'
  if (/quarto/i.test(name)) return 'bedroom'
  if (/banheiro/i.test(name)) return 'bathroom'
  if (/servi/i.test(name)) return 'laundry'
  return 'living'
}

function defaultPositions(rooms, sensors, width = minimumBoardWidth) {
  const offset = Math.max(0, (width - minimumBoardWidth) / 2)
  const positions = {
    [gatewayKey]: { x: 20 + offset, y: 278 },
    [interpreterKey]: { x: 616 + offset, y: 290 },
  }
  sensors.forEach((device, index) => { positions[`sensor-${device.id}`] = { x: 194 + offset, y: 48 + index * 126 } })
  rooms.forEach((room, index) => { positions[`room-${room.id}`] = { x: 380 + offset, y: 40 + index * 120 } })
  return positions
}

function edgePath(from, fromWidth, fromHeight, to, toHeight) {
  const x1 = from.x + fromWidth
  const y1 = from.y + fromHeight / 2
  const x2 = to.x
  const y2 = to.y + toHeight / 2
  const bend = Math.max(34, (x2 - x1) * .48)
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`
}

function signalLabel(device) {
  return device.type === 'ambiental' ? 'Temperatura e umidade' : device.type === 'gateway' ? 'Gateway central' : 'Presença e movimento'
}

export default function ResidenceFlow({ rooms = [], devices = [], dashboard, activeRoom, onSelect }) {
  const boardRef = useRef(null)
  const boardWidthRef = useRef(minimumBoardWidth)
  const resizeObservedRef = useRef(false)
  const [boardWidth, setBoardWidth] = useState(minimumBoardWidth)
  const dragRef = useRef(null)
  const draggedRef = useRef(false)
  const skipPositionSaveRef = useRef(true)
  const storageKey = `senso-residence-flow-${dashboard?.residence?.id || 'demo'}`
  const gateway = devices.find((device) => device.type === 'gateway') || { id: 'principal', name: 'Gateway Senso', status: 'online' }
  const sensors = devices.filter((device) => device.type !== 'gateway')
  const boardHeight = Math.max(680, 48 + sensors.length * 126, 40 + rooms.length * 120)
  const signature = `${rooms.map((room) => room.id).join(',')}|${sensors.map((device) => device.id).join(',')}`
  const [positions, setPositions] = useState(() => {
    try { return { ...defaultPositions(rooms, sensors), ...JSON.parse(localStorage.getItem(storageKey) || '{}') } }
    catch { return defaultPositions(rooms, sensors) }
  })

  useEffect(() => {
    skipPositionSaveRef.current = true
    const measuredWidth = Math.max(minimumBoardWidth, boardRef.current?.clientWidth || boardWidthRef.current)
    boardWidthRef.current = measuredWidth
    setBoardWidth(measuredWidth)
    const defaults = defaultPositions(rooms, sensors, measuredWidth)
    let saved = {}
    try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') }
    catch { saved = {} }
    setPositions((current) => Object.fromEntries(Object.entries(defaults).map(([key, position]) => {
      const type = key.split('-')[0]
      const candidate = saved[key] || current[key] || position
      return [key, {
        x: Math.max(0, Math.min(measuredWidth - nodeWidth[type], Number(candidate.x) || 0)),
        y: Math.max(0, Math.min(Math.max(680, 48 + sensors.length * 126, 40 + rooms.length * 120) - nodeHeight[type], Number(candidate.y) || 0)),
      }]
    })))
  }, [signature, storageKey])

  useEffect(() => {
    if (skipPositionSaveRef.current) { skipPositionSaveRef.current = false; return }
    try { localStorage.setItem(storageKey, JSON.stringify(positions)) }
    catch { /* browser storage may be unavailable */ }
  }, [positions, storageKey])

  useEffect(() => {
    if (!boardRef.current) return undefined
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(minimumBoardWidth, entry.contentRect.width)
      const oldWidth = boardWidthRef.current
      if (!resizeObservedRef.current) {
        resizeObservedRef.current = true
        boardWidthRef.current = width
        setBoardWidth(width)
        let hasSavedPositions = false
        try { hasSavedPositions = Object.keys(JSON.parse(localStorage.getItem(storageKey) || '{}')).length > 0 }
        catch { hasSavedPositions = false }
        if (!hasSavedPositions && width > oldWidth) {
          const offset = (width - oldWidth) / 2
          setPositions(current => Object.fromEntries(Object.entries(current).map(([key, position]) => {
            const type = key.split('-')[0]
            return [key, { ...position, x: Math.min(width - nodeWidth[type], position.x + offset) }]
          })))
        }
        return
      }
      if (Math.abs(width - oldWidth) < 1) return
      boardWidthRef.current = width
      setBoardWidth(width)
      setPositions(current => Object.fromEntries(Object.entries(current).map(([key, position]) => {
        const type = key.split('-')[0]
        return [key, { ...position, x: Math.max(0, Math.min(width - nodeWidth[type], position.x + (width - oldWidth) / 2)) }]
      })))
    })
    observer.observe(boardRef.current)
    return () => observer.disconnect()
  }, [storageKey])

  function beginDrag(event, key) {
    if (event.button !== 0) return
    const bounds = boardRef.current?.getBoundingClientRect()
    const position = positions[key]
    if (!bounds || !position) return
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* optional browser pointer capture */ }
    dragRef.current = { key, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: position.x, originY: position.y, scaleX: boardWidth / bounds.width, scaleY: boardHeight / bounds.height }
    draggedRef.current = false
  }

  function moveDrag(event) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (Math.abs(dx) + Math.abs(dy) > 4) draggedRef.current = true
    if (!draggedRef.current) return
    setPositions((current) => ({ ...current, [drag.key]: {
      x: Math.min(boardWidth - nodeWidth[drag.key.split('-')[0]], Math.max(0, drag.originX + dx * drag.scaleX)),
      y: Math.min(boardHeight - nodeHeight[drag.key.split('-')[0]], Math.max(0, drag.originY + dy * drag.scaleY)),
    } }))
  }

  function endDrag(event) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  function moveByKeyboard(event, key) {
    const amount = event.shiftKey ? 32 : 12
    const offsets = { ArrowUp: [0, -amount], ArrowDown: [0, amount], ArrowLeft: [-amount, 0], ArrowRight: [amount, 0] }
    const offset = offsets[event.key]
    if (!offset) return
    event.preventDefault()
    setPositions((current) => {
      const position = current[key]
      const type = key.split('-')[0]
      return { ...current, [key]: { x: Math.min(boardWidth - nodeWidth[type], Math.max(0, position.x + offset[0])), y: Math.min(boardHeight - nodeHeight[type], Math.max(0, position.y + offset[1])) } }
    })
  }

  function resetLayout() {
    try { localStorage.removeItem(storageKey) } catch { /* browser storage may be unavailable */ }
    setPositions(defaultPositions(rooms, sensors, boardWidth))
  }
  function positionOf(key) { return positions[key] || { x: 0, y: 0 } }
  function selectRoom(room) {
    if (draggedRef.current) { draggedRef.current = false; return }
    if (room) onSelect(room)
  }

  const gatewayPosition = positionOf(gatewayKey)
  const interpreterPosition = positionOf(interpreterKey)
  const activeAlerts = dashboard?.metrics?.active_alerts || 0
  const edges = [
    ...sensors.flatMap((device) => {
      const sensorPosition = positionOf(`sensor-${device.id}`)
      const room = rooms.find((item) => item.id === device.room_id)
      const roomPosition = room ? positionOf(`room-${room.id}`) : null
      const state = device.status === 'online' ? 'online' : 'offline'
      return [
        { id: `gateway-sensor-${device.id}`, path: edgePath(gatewayPosition, nodeWidth.gateway, nodeHeight.gateway, sensorPosition, nodeHeight.sensor), state },
        ...(roomPosition ? [{ id: `sensor-room-${device.id}`, path: edgePath(sensorPosition, nodeWidth.sensor, nodeHeight.sensor, roomPosition, nodeHeight.room), state }] : []),
      ]
    }),
    ...rooms.map((room) => {
      const hasDevice = room.devices?.length > 0 || sensors.some((device) => device.room_id === room.id)
      const offline = room.devices?.some((device) => device.status !== 'online') || sensors.some((device) => device.room_id === room.id && device.status !== 'online')
      return { id: `room-interpreter-${room.id}`, path: edgePath(positionOf(`room-${room.id}`), nodeWidth.room, nodeHeight.room, interpreterPosition, nodeHeight.interpreter), state: offline ? 'offline' : hasDevice ? 'online' : 'empty' }
    }),
  ]

  return <div className="residence-flow-shell">
    <div className="flow-toolbar"><span><i className="flow-live-dot" />Sinais simulados</span><button type="button" className="flow-reset-button" onClick={resetLayout}><RotateCcw size={14} /> Restaurar fluxo</button></div>
    <div className="flow-viewport" aria-label="Fluxo visual dos dispositivos, ambientes e interpretação do monitoramento">
      <div className="flow-board" ref={boardRef} style={{ height: boardHeight }}>
        <svg className="flow-edges" style={{ height: boardHeight }} viewBox={`0 0 ${boardWidth} ${boardHeight}`} aria-hidden="true">
          <defs><marker id="flow-arrow-online" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#35a879" /></marker><marker id="flow-arrow-offline" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#c88b4f" /></marker><marker id="flow-arrow-empty" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#b9c9c1" /></marker></defs>
          {edges.map((edge) => <path key={edge.id} className={`flow-edge edge-${edge.state}`} d={edge.path} markerEnd={`url(#flow-arrow-${edge.state})`} />)}
        </svg>

        <div className={`flow-node flow-node-gateway${gateway.status !== 'online' ? ' is-offline' : ''}`} style={{ left: gatewayPosition.x, top: gatewayPosition.y }} role="group" aria-label={`${gateway.name}, ${gateway.status === 'online' ? 'conectado' : 'desconectado'}, arraste para mover`} tabIndex="0" onPointerDown={(event) => beginDrag(event, gatewayKey)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={(event) => moveByKeyboard(event, gatewayKey)}>
          <span className="flow-node-port port-output" /><img className="flow-node-art gateway-art" src="/images/senso-gateway-card.webp" alt="" /><div className="flow-node-copy"><small>GATEWAY</small><b>{gateway.name}</b><span><i className={gateway.status === 'online' ? 'online' : 'offline'} />{gateway.status === 'online' ? 'Conectado' : 'Sem comunicação'}</span></div>
        </div>

        {sensors.map((device) => {
          const key = `sensor-${device.id}`
          const position = positionOf(key)
          const room = rooms.find((item) => item.id === device.room_id)
          return <div key={key} className={`flow-node flow-node-sensor${device.status === 'online' ? '' : ' is-offline'}`} style={{ left: position.x, top: position.y }} role="group" aria-label={`${device.name}, associado a ${room?.name || 'residência'}, arraste para mover`} tabIndex="0" onPointerDown={(event) => beginDrag(event, key)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={(event) => moveByKeyboard(event, key)} onClick={() => selectRoom(room)}>
            <span className="flow-node-port port-input" /><span className="flow-node-port port-output" /><img className={`flow-node-art sensor-art${device.type === 'ambiental' ? ' environment-art' : ''}`} src={device.type === 'ambiental' ? '/images/senso-environment-node.webp' : '/images/senso-presence-node.webp'} alt="" /><div className="flow-node-copy"><small>{device.type === 'ambiental' ? 'SENSOR AMBIENTAL' : 'NÓ DE PRESENÇA'}</small><b>{device.room_name || room?.name || device.name.replace('Nó de presença · ', '')}</b><span><i className={device.status === 'online' ? 'online' : 'offline'} />{device.status === 'online' ? signalLabel(device) : 'Comunicação interrompida'}</span></div>
          </div>
        })}

        {rooms.map((room) => {
          const key = `room-${room.id}`
          const position = positionOf(key)
          const icon = roomIcon(room.name)
          const offline = room.devices?.some((device) => device.status !== 'online') || sensors.some((device) => device.room_id === room.id && device.status !== 'online')
          const hasDevice = room.devices?.length > 0 || sensors.some((device) => device.room_id === room.id)
          return <button key={key} type="button" className={`flow-node flow-node-room${activeRoom?.id === room.id ? ' is-selected' : ''}${offline ? ' is-offline' : ''}${!hasDevice ? ' has-no-sensor' : ''}`} style={{ left: position.x, top: position.y }} aria-label={`${room.name}, ${hasDevice ? offline ? 'cobertura reduzida' : 'sensores conectados' : 'sem sensor'}, arraste para mover`} aria-pressed={activeRoom?.id === room.id} onPointerDown={(event) => beginDrag(event, key)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={(event) => moveByKeyboard(event, key)} onClick={() => selectRoom(room)}>
            <span className="flow-node-port port-input" /><span className="flow-node-port port-output" /><span className={`flow-room-art art-${icon}`} aria-hidden="true" /><span className="flow-node-copy"><small>AMBIENTE</small><b>{room.name}</b><span><i className={hasDevice ? offline ? 'offline' : 'online' : 'empty'} />{hasDevice ? offline ? 'Cobertura reduzida' : `${room.online_count || 0} ${room.online_count === 1 ? 'dispositivo conectado' : 'dispositivos conectados'}` : 'Sem sensor neste ambiente'}</span></span>
          </button>
        })}

        <div className={`flow-node flow-node-interpreter${activeAlerts ? ' has-alert' : ''}`} style={{ left: interpreterPosition.x, top: interpreterPosition.y }} role="group" aria-label="Interpretação contextual do Sistema Senso, arraste para mover" tabIndex="0" onPointerDown={(event) => beginDrag(event, interpreterKey)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={(event) => moveByKeyboard(event, interpreterKey)}>
          <span className="flow-node-port port-input" /><span className="flow-room-art art-monitor" aria-hidden="true" /><div className="flow-node-copy"><small>INTERPRETAÇÃO</small><b>Senso</b><span>{activeAlerts ? `${activeAlerts} ocorrência${activeAlerts === 1 ? '' : 's'} em aberto` : dashboard?.status_label || 'Aguardando sinais'}</span></div>
        </div>
      </div>
    </div>
    <div className="flow-legend"><span><i className="online" />Sinal disponível</span><span><i className="offline" />Comunicação interrompida</span><span><i className="empty" />Ambiente sem sensor</span></div>
  </div>
}

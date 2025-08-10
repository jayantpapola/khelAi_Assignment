// src/socket.js
import { io } from 'socket.io-client'

let socket = null

export function connectSocket({ host = 'http://localhost', port = null, opts = {} } = {}) {
  if (socket && socket.connected) {
    try {
      socket.disconnect()
    } catch (e) {
      console.warn(e)
    }
    socket = null
  }
  const url = port ? `${host}:${port}` : host
  socket = io(url, { transports: ['websocket'], autoConnect: true, ...opts })
  // add small reconnect logging
  socket.on('connect', () => console.log('socket connected to', url, 'id', socket.id))
  socket.on('disconnect', (reason) => console.log('socket disconnected', reason))
  socket.on('connect_error', (err) => console.error('socket connect_error', err.message))
  return socket
}

export function getSocket() {
  return socket
}

export default { connectSocket, getSocket }

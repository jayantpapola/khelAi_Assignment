// src/main/index.js  (modify your existing main)
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// Node imports for hosting
import express from 'express'
import http from 'http'
import { Server as IOServer } from 'socket.io'
import dgram from 'dgram'
import os from 'os'

let hostServer = null
let io = null
let udpSocket = null
let hostPort = 5000
let udpPort = 41234

function getLocalIPv4() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return '127.0.0.1'
}

function startHostServer({ port = 5000, udpDiscoveryPort = 41234 } = {}) {
  // Prevent double start
  if (hostServer) return { success: true, port: hostPort }

  hostPort = port
  udpPort = udpDiscoveryPort

  const appExp = express()
  const server = http.createServer(appExp)
  io = new IOServer(server, { cors: { origin: '*' } })

  // mapping mobile -> socket.id
  const mobileToSocket = new Map()
  const socketToMobile = new Map()

  io.on('connection', (socket) => {
    console.log('host: client connected', socket.id)

    socket.on('register', (payload) => {
      const mobile = payload?.mobile
      if (mobile) {
        mobileToSocket.set(mobile, socket.id)
        socketToMobile.set(socket.id, mobile)
        console.log(`registered mobile ${mobile} -> ${socket.id}`)
      }
    })

    socket.on('connection_request', (data) => {
      // data: { from, to }
      console.log('host received connection_request', data)
      const targetSocketId = mobileToSocket.get(data.to)
      if (targetSocketId) {
        io.to(targetSocketId).emit(`incoming_request_${data.to}`, { from: data.from })
      } else {
        // If target not connected to host, notify sender about failure
        io.to(socket.id).emit(`requested_rejected_${data.from}`, {
          reason: 'User not online on this host'
        })
      }
    })

    socket.on('accept_request', (data) => {
      // data: { from, to }
      const targetSocketId = mobileToSocket.get(data.to)
      if (targetSocketId) {
        io.to(targetSocketId).emit(`requested_accepted_${data.to}`, { from: data.from })
      }
    })

    socket.on('reject_request', (data) => {
      const targetSocketId = mobileToSocket.get(data.to)
      if (targetSocketId) {
        io.to(targetSocketId).emit(`requested_rejected_${data.to}`, { from: data.from })
      }
    })

    socket.on('message', (payload) => {
      // payload: { to, text, from }
      console.log('host message payload', payload)
      const targetSocketId = mobileToSocket.get(payload.to)
      if (targetSocketId) {
        io.to(targetSocketId).emit(`message_${payload.to}`, payload.text)
      }
    })

    socket.on('disconnect', () => {
      const mobile = socketToMobile.get(socket.id)
      if (mobile) {
        mobileToSocket.delete(mobile)
        socketToMobile.delete(socket.id)
      }
      console.log('host: client disconnected', socket.id)
    })
  })

  server.listen(hostPort, () => {
    console.log('Host Socket.IO server listening on', hostPort)
  })

  hostServer = server

  // UDP responder for discovery
  udpSocket = dgram.createSocket('udp4')
  udpSocket.on('message', (msg, rinfo) => {
    const text = msg.toString()
    if (text === 'DISCOVER_CHAT_SERVER') {
      const info = { ip: getLocalIPv4(), socketPort: hostPort, name: 'LAN-Chat-Host' }
      const reply = Buffer.from(JSON.stringify(info))
      udpSocket.send(reply, 0, reply.length, rinfo.port, rinfo.address, (err) => {
        if (err) console.error('UDP reply failed', err)
      })
    }
  })

  udpSocket.bind(udpPort, () => {
    udpSocket.setBroadcast(true)
    console.log('UDP discovery responder bound on', udpPort)
  })

  return { success: true, port: hostPort }
}

function stopHostServer() {
  if (io) {
    try {
      io.close()
    } catch (e) {
      console.error('Error closing io', e)
    }
    io = null
  }
  if (hostServer) {
    try {
      hostServer.close()
    } catch (e) {
      console.error('Error closing host server', e)
    }
    hostServer = null
  }
  if (udpSocket) {
    try {
      udpSocket.close()
    } catch (e) {
      console.error('Error closing udp socket', e)
    }
    udpSocket = null
  }
  return { success: true }
}

/* ----------------- existing Electron window creation below ----------------- */

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC endpoints for renderer
  ipcMain.handle('start-host', async (ev, opts) => {
    try {
      const res = startHostServer(opts)
      return { ok: true, res }
    } catch (e) {
      console.error('start-host error', e)
      return { ok: false, error: e.message }
    }
  })

  ipcMain.handle('stop-host', async () => {
    try {
      const res = stopHostServer()
      return { ok: true, res }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  ipcMain.handle('get-local-ip', () => {
    return getLocalIPv4()
  })

  // keep discover in preload (renderer will do UDP broadcast), so no discover ipc needed
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

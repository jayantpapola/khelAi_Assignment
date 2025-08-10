// preload/index.js
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import os from 'os'
import dgram from 'dgram'

const UDP_PORT = 41234
const DISCOVER_TIMEOUT = 1500

function getLocalIPv4() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return '127.0.0.1'
}

async function startHost(opts = { port: 5000, udpDiscoveryPort: UDP_PORT }) {
  return ipcRenderer.invoke('start-host', opts)
}

async function stopHost() {
  return ipcRenderer.invoke('stop-host')
}

async function discoverLAN(timeout = DISCOVER_TIMEOUT) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4')
    const message = Buffer.from('DISCOVER_CHAT_SERVER')
    const discovered = {}

    socket.on('error', (err) => {
      console.error('discover error', err)
      socket.close()
      resolve([])
    })

    socket.on('message', (msg, rinfo) => {
      try {
        const json = JSON.parse(msg.toString())
        const key = `${rinfo.address}:${json.socketPort || UDP_PORT}`
        discovered[key] = {
          ip: json.ip || rinfo.address,
          socketPort: json.socketPort || UDP_PORT,
          name: json.name || 'LAN-Chat-Host'
        }
      } catch (e) {
        // ignore
      }
    })

    socket.bind(() => {
      socket.setBroadcast(true)
      socket.send(message, 0, message.length, UDP_PORT, '255.255.255.255', (err) => {
        if (err) console.error('discover send error', err)
      })
    })

    setTimeout(() => {
      socket.close()
      resolve(Object.values(discovered))
    }, timeout)
  })
}

const api = {
  getLocalIP: () => getLocalIPv4(),
  startHost,
  stopHost,
  discoverLAN
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('preload expose error', error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}

// src/Pairing.jsx
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import socketHelper from './socket'
import Header from './components/Header'

export default function Pairing() {
  const id = localStorage.getItem('mobile_number')
  const [pairingCode, setPairingCode] = useState('')
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [incomingRequest, setIncomingRequest] = useState(null)

  const [chat_mode, setChatMode] = useState(localStorage.getItem('chat_mode') || 'Internet')
  const [availableHosts, setAvailableHosts] = useState([])
  const [discovering, setDiscovering] = useState(false)
  const [hosting, setHosting] = useState(false)

  useEffect(() => {
    const connectForMode = () => {
      if (chat_mode === 'Internet') {
        let s = socketHelper.connectSocket({ host: 'https://socket-server-32yv.onrender.com' })
        // let s = socketHelper.connectSocket({ host: 'http://localhost', port: 4000 })
        s.on('connect', () => {
          s.emit('register', { mobile: id })
          registerSocketListeners(s)
        })
      } else {
        // If LAN and previous host info exists, reconnect
        const savedHost = localStorage.getItem('lan_server')
        if (savedHost) {
          const hostData = JSON.parse(savedHost)
          let s = socketHelper.connectSocket({
            host: `http://${hostData.ip}`,
            port: hostData.socketPort
          })
          s.on('connect', () => {
            s.emit('register', { mobile: id })
            registerSocketListeners(s)
          })
        }
      }
    }

    connectForMode()
  }, [chat_mode, id])

  const registerSocketListeners = (s) => {
    s.off(`incoming_request_${id}`)
    s.off(`requested_accepted_${id}`)
    s.off(`requested_rejected_${id}`)

    s.on(`incoming_request_${id}`, (data) => setIncomingRequest(data))
    s.on(`requested_accepted_${id}`, (data) => {
      localStorage.setItem('paired_with', data.from)
      navigate('/')
    })

    s.on(`requested_rejected_${id}`, () => {
      setConnecting(false)
      alert('Request Declined!!')
    })
  }

  const toggleMode = () => {
    const next = chat_mode === 'Internet' ? 'LAN' : 'Internet'
    setChatMode(next)
    localStorage.setItem('chat_mode', next)
  }

  // HOST: start the host server inside Electron main
  const handleHost = async () => {
    try {
      setHosting(true)
      const res = await window.api.startHost({ port: 5000, udpDiscoveryPort: 41234 })
      if (!res?.ok) throw new Error(res?.error || 'Failed to start host')
      // now connect to the local host server as a client
      const s = socketHelper.connectSocket({ host: 'http://localhost', port: 5000 })
      s.on('connect', () => {
        // register mobile for this host
        s.emit('register', { mobile: id })
        // host auto-accept behavior: the host might wait for incoming requests; we'll navigate to chat room so host can accept later
        localStorage.setItem('paired_with', id) // host is currently alone; actual paired partner set on accept
        navigate('/') // take host to ChatRoom UI
      })
    } catch (e) {
      console.error('host error', e)
      setError('Failed to host on this machine: ' + (e.message || e))
    } finally {
      setHosting(false)
    }
  }

  // JOIN: discover and connect
  const handleDiscover = async () => {
    setDiscovering(true)
    try {
      const hosts = await window.api.discoverLAN()
      setAvailableHosts(hosts || [])
      if (!hosts || hosts.length === 0) {
        // optionally show message
      }
    } catch (e) {
      console.error('discover error', e)
      setError('Discovery failed: ' + (e.message || e))
    } finally {
      setDiscovering(false)
    }
  }

  const connectToHost = async (host) => {
    // host: { ip, socketPort }
    try {
      setConnecting(true)
      const s = socketHelper.connectSocket({ host: `http://${host.ip}`, port: host.socketPort })
      s.on('connect', () => {
        s.emit('register', { mobile: id })
        localStorage.setItem('lan_server', JSON.stringify(host))
        registerSocketListeners(s) // <-- make sure listener is active
        s.emit('connection_request', { from: id, to: pairingCode })
      })
    } catch (e) {
      console.error('connect host error', e)
      setError('Connection to host failed: ' + (e.message || e))
      setConnecting(false)
    }
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    // if using Internet mode, ensure socket connected to internet server
    if (chat_mode === 'Internet') {
      let s = socketHelper.getSocket()
      if (!s || s.disconnected) {
        s = socketHelper.connectSocket({ host: 'http://localhost', port: 5000 }) // change to your deployed server
        s.on('connect', () => s.emit('register', { mobile: id }))
      }
    } else {
      // in LAN, user must either Host or Connect to a host first
      const s = socketHelper.getSocket()
      if (!s || s.disconnected) {
        setError('You must host or connect to a LAN host first (use Host a Room or Join a Room).')
        return
      }
    }

    if (!pairingCode.trim()) {
      setError('Please enter a valid pairing code.')
      return
    }
    if (pairingCode.trim() == id) {
      setError('Please use different id.')
      return
    }

    setError('')
    setConnecting(true)
    try {
      const active = socketHelper.getSocket()
      active.emit('connection_request', { from: id, to: pairingCode })
    } catch (err) {
      console.error(err)
      setError('Failed to send request. Try again.')
      setConnecting(false)
    }
  }

  const handleAccept = () => {
    const s = socketHelper.getSocket()
    if (!s) return
    s.emit('accept_request', { from: id, to: incomingRequest.from })
    setIncomingRequest(null)
    localStorage.setItem('paired_with', incomingRequest.from)
    navigate('/')
  }

  const handleCancel = () => {
    const s = socketHelper.getSocket()
    if (!s) return
    s.emit('reject_request', { from: id, to: incomingRequest.from })
    setIncomingRequest(null)
  }

  useEffect(() => {
    if (!id) {
      navigate('/mobile')
    }
  }, [])

  return (
    <div className="flex flex-col items-center">
      <Header />
      <div className="max-w-sm mx-auto mt-6 p-6 bg-[#222] rounded-xl shadow-md text-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Pair / Connect</h2>
          <button onClick={toggleMode} className="bg-green-600 py-1 px-3 rounded">
            Mode: {chat_mode}
          </button>
        </div>

        {chat_mode === 'LAN' ? (
          <>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleHost}
                disabled={hosting}
                className="w-full bg-blue-600 py-2 rounded"
              >
                {hosting ? 'Hosting...' : 'Host a Room'}
              </button>

              <div className="flex items-center gap-2">
                <input
                  value={pairingCode}
                  onChange={(e) => setPairingCode(e.target.value)}
                  placeholder="Enter partner mobile (to request after connect)"
                  className="flex-1 bg-[#111] border-2 border-blue-500 rounded px-3 py-2"
                />
                <button onClick={handleDiscover} className="bg-purple-600 px-3 py-2 rounded">
                  {discovering ? 'Scanning...' : 'Join a Room'}
                </button>
              </div>

              {availableHosts && availableHosts.length > 0 && (
                <div className="mt-3 bg-[#111] p-2 rounded">
                  <p className="mb-2">Discovered Hosts:</p>
                  <ul>
                    {availableHosts.map((h, i) => (
                      <li key={i} className="flex justify-between items-center py-1">
                        <span>
                          {h.name} — {h.ip}:{h.socketPort}
                        </span>
                        <button
                          onClick={() => connectToHost(h)}
                          className="bg-green-600 px-2 py-1 rounded"
                        >
                          Connect
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              minLength={10}
              maxLength={10}
              type="text"
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value)}
              className="w-full border-2 border-blue-500 bg-[#111] rounded-lg px-4 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter partner mobile number"
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" disabled={connecting} className="w-full bg-blue-500 py-2 rounded">
              {connecting ? 'Waiting...' : 'Send Request (Internet)'}
            </button>
          </form>
        )}
      </div>

      {incomingRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center w-80">
            <h2 className="text-lg font-semibold mb-3">
              Incoming request from {incomingRequest.from || 'Unknown User'}
            </h2>
            <div className="flex justify-around">
              <button onClick={handleAccept} className="bg-green-500 py-2 px-4 rounded">
                Accept
              </button>
              <button onClick={handleCancel} className="bg-red-500 py-2 px-4 rounded">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

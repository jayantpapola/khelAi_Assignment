import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import socket from './socket'
import Header from './components/Header'

export default function Pairing() {
  const id = localStorage.getItem('mobile_number')
  const [pairingCode, setPairingCode] = useState('')
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [incomingRequest, setIncomingRequest] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!pairingCode.trim()) {
      setError('Please enter a valid pairing code.')
      return
    }

    setError('')
    setConnecting(true)

    try {
      // Call parent handler or API
      // Example: send via WebSocket or HTTP API
      socket.emit('connection_request', {
        from: id,
        to: pairingCode // if you store mobile numbers
      })
      // navigate('/')
    } catch (err) {
      console.error(err)
      setError('Failed to send request. Try again.')
    } finally {
      setConnecting(false)
    }
  }
  const handleAccept = () => {
    socket.emit(`accept_request`, {
      from: id,
      to: incomingRequest.from // if you store mobile numbers
    })
    setIncomingRequest(null)
    localStorage.setItem('paired_with', incomingRequest.from)
    navigate('/')
  }

  const handleCancel = () => {
    socket.emit(`reject_request_${id}`, incomingRequest.from)
    setIncomingRequest(null)
  }

  useEffect(() => {
    socket.on(`incoming_request_${id}`, (data) => {
      setIncomingRequest(data)
    })
    socket.on(`requested_accepted_${id}`, (data) => {
      localStorage.setItem('paired_with', data.from)
      navigate('/')
    })

    return () => {
      socket.off(`incoming_request_${id}`)
      socket.off(`requested_accepted_${id}`)
    }
  }, [id])

  return (
    <div>
      <Header />
      <form
        onSubmit={handleSubmit}
        className="max-w-sm mx-auto mt-10 p-6 bg-[#222] rounded-xl shadow-md text-white"
      >
        <h2 className="text-2xl font-semibold mb-4 text-center">Enter Id</h2>
        <input
          minLength={10}
          maxLength={10}
          type="text"
          value={pairingCode}
          onChange={(e) => setPairingCode(e.target.value)}
          className="w-full border-2 border-blue-500 bg-[#111] rounded-lg px-4 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <button
          type="submit"
          disabled={connecting}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition"
        >
          {connecting ? 'Waiting...' : 'Send Request'}
        </button>
      </form>
      {incomingRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center w-80">
            <h2 className="text-lg font-semibold mb-3">
              Incoming request from {incomingRequest.mobile || 'Unknown User'}
            </h2>
            <div className="flex justify-around">
              <button
                onClick={handleAccept}
                className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded"
              >
                Accept
              </button>
              <button
                onClick={handleCancel}
                className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

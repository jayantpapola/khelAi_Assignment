// src/ChatRoom.jsx
import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import socketHelper from './socket'

const ChatRoom = () => {
  const navigate = useNavigate()
  const isPaired = localStorage.getItem('paired_with')
  const mobile = localStorage.getItem('mobile_number')
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [incoming, setIncoming] = useState(null) // store incoming request details
  const messagesEndRef = useRef(null)

useEffect(() => {
  let s = socketHelper.getSocket()

  if (!s || s.disconnected) {
    const lan = localStorage.getItem('lan_server')
    if (lan) {
      const host = JSON.parse(lan)
      s = socketHelper.connectSocket({ host: `http://${host.ip}`, port: host.socketPort })
    } else {
      s = socketHelper.connectSocket({ host: 'http://localhost', port: 5000 })
    }
  }

  s.on('connect', () => {
    s.emit('register', { mobile })
  })

  const messageHandler = (msg) => {
    setMessages((prev) => [...prev, { text: msg, fromMe: false }])
  }

  const incomingHandler = (data) => {
    setIncoming(data)
  }

  // Listener for when requester gets accepted (useful if this client ever sends requests)
  const acceptedHandler = (data) => {
    // If this client was the requester, server will send requested_accepted_<thisMobile>
    localStorage.setItem('paired_with', data.from)
    // if already in chat room, just update UI, else navigate
    if (!location.pathname.includes('/chatroom')) {
      navigate('/chatroom')
    }
  }

  const rejectedHandler = (data) => {
    alert('Request Declined!!')
  }

  s.on(`message_${mobile}`, messageHandler)
  s.on(`incoming_request_${mobile}`, incomingHandler)
  s.on(`requested_accepted_${mobile}`, acceptedHandler)
  s.on(`requested_rejected_${mobile}`, rejectedHandler)

  return () => {
    s.off(`message_${mobile}`, messageHandler)
    s.off(`incoming_request_${mobile}`, incomingHandler)
    s.off(`requested_accepted_${mobile}`, acceptedHandler)
    s.off(`requested_rejected_${mobile}`, rejectedHandler)
  }
}, [mobile])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const backButton = () => {
    localStorage.removeItem('paired_with')
    navigate('/pairing')
  }

  const sendMessage = (e) => {
    e?.preventDefault?.()
    if (text.trim()) {
      const active = socketHelper.getSocket()
      active.emit('message', { to: isPaired, text, from: mobile })
      setMessages((prev) => [...prev, { text, fromMe: true }])
      setText('')
    }
  }

  const acceptRequest = () => {
  const s = socketHelper.getSocket()
  if (!s || !incoming) return
  // Host accepts: from = host mobile, to = requester mobile
  s.emit('accept_request', { from: mobile, to: incoming.from })
  localStorage.setItem('paired_with', incoming.from)
  setIncoming(null)
  // host already on ChatRoom so no navigate needed (requester will navigate on receiving accept)
}

const rejectRequest = () => {
  const s = socketHelper.getSocket()
  if (!s || !incoming) return
  // Use the same 'reject_request' event as server expects
  s.emit('reject_request', { from: mobile, to: incoming.from })
  setIncoming(null)
}

  return (
    <div className="flex flex-col h-screen bg-[#111]">
      {/* Header */}
      <div className="bg-blue-500 text-white px-4 py-3 flex justify-between items-center shadow">
        <div className="font-semibold">{isPaired ? `Paired with: ${isPaired}` : 'Not paired'}</div>
        <button
          onClick={backButton}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
        >
          Exit
        </button>
      </div>

      {/* Incoming request popup */}
      {incoming && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg text-black">
            <p className="mb-4">Incoming request from {incoming.from}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={acceptRequest}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              >
                Accept
              </button>
              <button
                onClick={rejectRequest}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex mb-2 ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xs px-4 py-2 rounded-lg shadow ${
                msg.fromMe
                  ? 'bg-blue-500 text-white rounded-br-none'
                  : 'bg-white text-gray-800 rounded-bl-none'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="bg-[#222] p-3 flex items-center text-white">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 border-2 border-blue-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button className="ml-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow">
          Send
        </button>
      </form>
    </div>
  )
}

export default ChatRoom

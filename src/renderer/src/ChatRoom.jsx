import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import socket from './socket'

const ChatRoom = () => {
  const navigate = useNavigate()
  const isPaired = localStorage.getItem('paired_with')
  const mobile = localStorage.getItem('mobile_number')
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (!isPaired) {
      navigate('/pairing')
    }

    socket.on(`message_${mobile}`, (msg) => {
      setMessages((prev) => [...prev, { text: msg, fromMe: false }])
    })

    return () => socket.off(`message_${mobile}`)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const backButton = () => {
    localStorage.clear()
    navigate('/pairing')
  }

  const sendMessage = (e) => {
    e.preventDefault()
    if (text.trim()) {
      socket.emit('message', { to: isPaired, text })
      setMessages((prev) => [...prev, { text, fromMe: true }])
      setText('')
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#111]">
      {/* Header */}
      <div className="bg-blue-500 text-white px-4 py-3 flex justify-between items-center shadow">
        <div className="font-semibold">Paired with: {isPaired}</div>
        <button
          onClick={backButton}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
        >
          Exit
        </button>
      </div>

      {/* Chat messages */}
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

      {/* Input area */}

      <form onSubmit={sendMessage} className="bg-[#222]  p-3 flex items-center text-white">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={handleKeyPress}
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

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function MobileNumber() {
  const [mobile, setMobile] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()

    // Simple validation
    if (!/^\d{10}$/.test(mobile)) {
      setError('Please enter a valid 10-digit mobile number')
      return
    }

    localStorage.setItem('mobile_number', mobile)
    navigate('/pairing') // go to pairing page
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-sm mx-auto mt-10 p-6 bg-white rounded-xl shadow-md"
    >
      <h2 className="text-2xl font-semibold mb-4 text-center">Enter Your Mobile Number</h2>

      <input
        type="tel"
        value={mobile}
        onChange={(e) => setMobile(e.target.value)}
        placeholder="e.g., 9876543210"
        className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      <button
        type="submit"
        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition"
      >
        Continue
      </button>
    </form>
  )
}

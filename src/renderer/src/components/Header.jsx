import React, { useEffect, useState } from 'react'

const Header = () => {
  const mobileNumber = localStorage.getItem('mobile_number')

  useEffect(() => {
    const mobileNumber = localStorage.getItem('mobile_number')
    if (!mobileNumber) {
      window.location.href = '/mobile' // redirect if not set
    }
  }, [])
  return (
    <div className="w-full p-2 px-4 bg-[#222] shadow-2xl text-white text-sm flex justify-between">
      <p>
        Id- <span className="font-bold text-lg">{mobileNumber}</span>
      </p>
    </div>
  )
}

export default Header

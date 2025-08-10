import React from 'react'
import { createHashRouter, RouterProvider, useNavigate } from 'react-router-dom'
import Pairing from './Pairing'
import ChatRoom from './ChatRoom'
import socket from './socket'
import MobileNumber from './MobileNumber'

const App = () => {
  const router = createHashRouter([
    {
      path: '/mobile',
      element: <MobileNumber />
    },
    {
      path: '/pairing',
      element: <Pairing />
    },
    {
      path: '/',
      element: <ChatRoom />
    }
  ])
  return <RouterProvider router={router} />
}

export default App

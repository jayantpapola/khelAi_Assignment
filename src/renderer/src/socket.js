import { io } from 'socket.io-client'

// Replace with your deployed server URL
const socket = io('http://localhost:5000')

export default socket

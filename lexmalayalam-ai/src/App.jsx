import { Routes, Route } from 'react-router-dom'
import Splash from './pages/Splash'

function Login() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontSize: '30px',
      fontWeight: 'bold'
    }}>
      Login Page Coming Soon...
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route path="/login" element={<Login />} />
    </Routes>
  )
}

export default App
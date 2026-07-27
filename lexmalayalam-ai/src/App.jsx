import { Routes, Route } from 'react-router-dom'
import Splash from './pages/Splash'
import Login from './pages/Login'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route path="/login" element={<Login />} />
    </Routes>
  )
}

export default App
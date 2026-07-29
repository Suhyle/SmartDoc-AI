import { useNavigate } from 'react-router-dom'
import { FiArrowLeft } from 'react-icons/fi'
import BottomNav from '../components/BottomNav'
import './Placeholder.css'

export default function Chat() {
  const navigate = useNavigate()

  return (
    <div className="placeholder-page">
      <div className="placeholder-content">
        <button className="back-btn" onClick={() => navigate('/home')}>
          <FiArrowLeft size={18} /> Back
        </button>
        <h1>AI Chat</h1>
        <p>Chat with your PDF documents will be available here.</p>
      </div>
      <BottomNav />
    </div>
  )
}
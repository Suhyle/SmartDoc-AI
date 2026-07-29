import { useNavigate } from 'react-router-dom'
import { FiArrowLeft } from 'react-icons/fi'
import BottomNav from '../components/BottomNav'
import './Placeholder.css'

export default function UrlUpload() {
  const navigate = useNavigate()

  return (
    <div className="placeholder-page">
      <div className="placeholder-content">
        <button className="back-btn" onClick={() => navigate('/home')}>
          <FiArrowLeft size={18} /> Back
        </button>
        <h1>Paste Website URL</h1>
        <p>Website URL import functionality will be implemented here.</p>
      </div>
      <BottomNav />
    </div>
  )
}
import { useNavigate, useLocation } from 'react-router-dom'
import { FiHome, FiFileText, FiUpload, FiMessageCircle, FiUser } from 'react-icons/fi'
import './BottomNav.css'

const navItems = [
  { path: '/home', label: 'Home', icon: FiHome },
  { path: '/documents', label: 'Documents', icon: FiFileText },
  { path: '/chat', label: 'Chat', icon: FiMessageCircle },
  { path: '/profile', label: 'Profile', icon: FiUser },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav className="bottom-nav">
      {/* First two tabs */}
      {navItems.slice(0, 2).map(({ path, label, icon: Icon }) => {
        const isActive = location.pathname === path
        return (
          <button
            key={path}
            className={`nav-item ${isActive ? 'nav-item--active' : ''}`}
            onClick={() => navigate(path)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        )
      })}

      {/* Center floating Upload button */}
      <button
        className="nav-upload-btn"
        onClick={() => navigate('/upload')}
        aria-label="Upload PDF"
      >
        <FiUpload size={24} />
      </button>

      {/* Last two tabs */}
      {navItems.slice(2).map(({ path, label, icon: Icon }) => {
        const isActive = location.pathname === path
        return (
          <button
            key={path}
            className={`nav-item ${isActive ? 'nav-item--active' : ''}`}
            onClick={() => navigate(path)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
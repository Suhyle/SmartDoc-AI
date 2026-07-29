import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiLogOut, FiUser } from 'react-icons/fi'
import { supabase } from '../supabase'
import BottomNav from '../components/BottomNav'
import './Placeholder.css'

export default function Profile() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) setEmail(user.email)
    }
    fetchUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="placeholder-page">
      <div className="placeholder-content">
        <button className="back-btn" onClick={() => navigate('/home')}>
          <FiArrowLeft size={18} /> Back
        </button>

        <div className="profile-avatar">
          <FiUser size={28} />
        </div>

        <h1>Profile</h1>
        <p>{email || 'Loading...'}</p>

        <button className="logout-btn" onClick={handleLogout}>
          <FiLogOut size={18} />
          Logout
        </button>
      </div>
      <BottomNav />
    </div>
  )
}
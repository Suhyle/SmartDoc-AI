import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Splash.css'

export default function Splash() {
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/login')
    }, 4000)

    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="splash">
      <div className="splash-shape splash-shape--one"></div>
      <div className="splash-shape splash-shape--two"></div>
      <div className="splash-shape splash-shape--three"></div>

      <span className="splash-star splash-star--a">✦</span>
      <span className="splash-star splash-star--b">✧</span>
      <span className="splash-star splash-star--c">✦</span>
      <span className="splash-star splash-star--d">✧</span>
      <span className="splash-star splash-star--e">✦</span>

      <div className="splash-content">
        <div className="splash-logo">
          <svg
            width="72"
            height="72"
            viewBox="0 0 72 72"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="14" y="8" width="40" height="56" rx="8" fill="#6C4CF1" />
            <path
              d="M40 8v12a4 4 0 0 0 4 4h10"
              stroke="#fff"
              strokeWidth="2"
              fill="none"
            />
            <rect x="22" y="30" width="20" height="3" rx="1.5" fill="#fff" />
            <rect x="22" y="38" width="24" height="3" rx="1.5" fill="#fff" />
            <rect x="22" y="46" width="16" height="3" rx="1.5" fill="#fff" />
          </svg>
        </div>

        <h1 className="splash-title">
          Smart<span>Doc</span> AI
        </h1>

        <p className="splash-tagline">
           അപ്‌ലോഡ് ചെയ്യൂ • ലളിതമാക്കൂ
        </p>

        <div className="splash-loader">
          <span className="splash-loader-ring"></span>
        </div>
      </div>
    </div>
  )
}
import { useEffect, useState } from "react";
import Splash from "../pages/Splash";

function SplashLoader({ children }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <Splash />;
  }

  return children;
}

export default SplashLoader;
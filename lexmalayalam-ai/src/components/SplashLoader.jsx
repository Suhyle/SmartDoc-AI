import { useEffect, useState } from "react";
import Splash from "../pages/Splash";

function SplashLoader({ children }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <Splash duration={4000} hideNavigation={true} />;
  }

  return children;
}

export default SplashLoader;
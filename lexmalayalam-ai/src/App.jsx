import { Routes, Route } from "react-router-dom";
import Splash from "./pages/Splash";
import SplashLoader from "./components/SplashLoader";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Splash />} />

      <Route
        path="/login"
        element={
          <SplashLoader>
            <Login />
          </SplashLoader>
        }
      />

      <Route
        path="/signup"
        element={
          <SplashLoader>
            <Signup />
          </SplashLoader>
        }
      />
    </Routes>
  );
}

export default App;
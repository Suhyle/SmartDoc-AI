import { Routes, Route } from "react-router-dom";


// =========================================================
// Existing Pages
// =========================================================

import Splash from "./pages/Splash";
import Login from "./pages/Login";
import Signup from "./pages/Signup";


// =========================================================
// Select Exam Page
// =========================================================

import SelectExam from "./pages/SelectExam";


// =========================================================
// Existing Components
// =========================================================

import SplashLoader from "./components/SplashLoader";


// =========================================================
// Application Pages
// =========================================================

import Home from "./pages/Home";
import Upload from "./pages/Upload";
import UrlUpload from "./pages/UrlUpload";
import Documents from "./pages/Documents";
import Downloads from "./pages/Downloads";
import Transcript from "./pages/Transcript";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import EmailVerified from "./pages/EmailVerified";


// =========================================================
// APP ROUTES
// =========================================================

function App() {
  return (
    <Routes>

      {/* ===================================================
          Splash Screen
      =================================================== */}

      <Route
        path="/"
        element={<Splash />}
      />


      {/* ===================================================
          Login
      =================================================== */}

      <Route
        path="/login"
        element={
          <SplashLoader>
            <Login />
          </SplashLoader>
        }
      />


      {/* ===================================================
          Signup / Registration
      =================================================== */}

      <Route
        path="/signup"
        element={
          <SplashLoader>
            <Signup />
          </SplashLoader>
        }
      />


      {/* ===================================================
          Select Exam

          Current flow:
          Signup → Select Exam → Login
      =================================================== */}

      <Route
        path="/select-exam"
        element={
          <SplashLoader>
            <SelectExam />
          </SplashLoader>
        }
      />


      {/* ===================================================
          Home / Dashboard
      =================================================== */}

      <Route
        path="/home"
        element={<Home />}
      />


      {/* ===================================================
          Upload PDF
      =================================================== */}

      <Route
        path="/upload"
        element={<Upload />}
      />


      {/* ===================================================
          Website URL Upload
      =================================================== */}

      <Route
        path="/url-upload"
        element={<UrlUpload />}
      />


      {/* ===================================================
          Documents
      =================================================== */}

      <Route
        path="/documents"
        element={<Documents />}
      />


      {/* ===================================================
          Downloads / PDF Library
      =================================================== */}

      <Route
        path="/downloads"
        element={<Downloads />}
      />


      {/* ===================================================
          Transcript & Summary

          YouTube Video
          Multiple Videos
          Video Upload
          Transcript Settings
          Summary Options
      =================================================== */}

      <Route
        path="/transcript-summary"
        element={<Transcript />}
      />


      {/* ===================================================
          AI Chat
      =================================================== */}

      <Route
        path="/chat"
        element={<Chat />}
      />


      {/* ===================================================
          Profile
      =================================================== */}

      <Route
        path="/profile"
        element={<Profile />}
      />


      {/* ===================================================
          Email Verified
      =================================================== */}

      <Route
        path="/email-verified"
        element={<EmailVerified />}
      />

    </Routes>
  );
}


export default App;
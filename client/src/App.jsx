import { Routes, Route } from 'react-router-dom'
import Booth from './pages/Booth'
import Gallery from './pages/Gallery'
import Logs from './pages/Logs'
import Login from './components/Login'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Booth />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/gallery"
        element={
          <ProtectedRoute>
            <Gallery />
          </ProtectedRoute>
        }
      />
      <Route
        path="/logs"
        element={
          <ProtectedRoute>
            <Logs />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
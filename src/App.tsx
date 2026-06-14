import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Workout from './pages/Workout'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/workout" element={<Workout />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
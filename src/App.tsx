import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Workout from './pages/Workout'
import History from './pages/HistorialPage'
import WorkoutDetail from './pages/WorkoutDetail'
import RoutineManager from './pages/RoutineManager'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/workout" element={<Workout />} />
        <Route path="/history" element={<History />} />
        <Route path="/history/:id" element={<WorkoutDetail />} />
        <Route path="/routine-manager" element={<RoutineManager />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
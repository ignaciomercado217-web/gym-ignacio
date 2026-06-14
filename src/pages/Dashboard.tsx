import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [exerciseCount, setExerciseCount] = useState(0)
  const [workoutCount, setWorkoutCount] = useState(0)

  useEffect(() => {
    async function loadDashboard() {
      const exercises = await supabase
        .from('exercises')
        .select('*', { count: 'exact', head: true })

      const workouts = await supabase
        .from('workouts')
        .select('*', { count: 'exact', head: true })

      setExerciseCount(exercises.count ?? 0)
      setWorkoutCount(workouts.count ?? 0)
    }

    loadDashboard()
  }, [])

  return (
    <div style={{ padding: 20 }}>
      <h1>🏋️ Gym Ignacio</h1>

      <p>Ejercicios cargados: {exerciseCount}</p>
      <p>Entrenamientos registrados: {workoutCount}</p>

      <button>Iniciar entrenamiento</button>
    </div>
  )
}
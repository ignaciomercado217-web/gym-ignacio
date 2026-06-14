import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Workout = {
  id: number
  routine_id: number
  workout_date: string
  ire: number
  total_volume: number
}

type Routine = {
  id: number
  name: string
}

export default function History() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [routines, setRoutines] = useState<Record<number, string>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadHistory() {
      const { data: routineData } = await supabase
        .from('routines')
        .select('id, name')

      const routineMap: Record<number, string> = {}

      routineData?.forEach((routine: Routine) => {
        routineMap[routine.id] = routine.name
      })

      setRoutines(routineMap)

      const { data, error } = await supabase
        .from('workouts')
        .select('id, routine_id, workout_date, ire, total_volume')
        .order('workout_date', { ascending: false })
        .order('id', { ascending: false })

      if (error) {
        setError(error.message)
        return
      }

      setWorkouts(data ?? [])
    }

    loadHistory()
  }, [])

  function getPerformanceLabel(value: number) {
    if (value > 0) return `🟢 +${value}%`
    if (value === 0) return `🟡 ${value}%`
    return `🔴 ${value}%`
  }

  return (
    <main className="page">
      <Link to="/">
        <button className="secondary-button" style={{ marginBottom: 18 }}>
          ← Volver al inicio
        </button>
      </Link>

      <h1 className="title">Historial</h1>
      <p className="subtitle">Revisá tus entrenamientos anteriores.</p>

      {error && (
        <div className="card">
          <p style={{ color: '#ff6b6b' }}>{error}</p>
        </div>
      )}

      {workouts.length === 0 && (
        <div className="card">
          <p>No hay entrenamientos registrados.</p>
        </div>
      )}

      {workouts.map((workout) => (
        <div key={workout.id} className="card">
          <div className="stat-label">{workout.workout_date}</div>

          <div className="stat-value">
            {routines[workout.routine_id] ?? 'Rutina'}
          </div>

          <div style={{ marginTop: 14 }}>
            <p>Rendimiento: {getPerformanceLabel(Number(workout.ire ?? 0))}</p>
            <p>Volumen: {workout.total_volume} kg</p>
          </div>

          <button className="secondary-button" disabled>
            Ver detalle
          </button>
        </div>
      ))}
    </main>
  )
}
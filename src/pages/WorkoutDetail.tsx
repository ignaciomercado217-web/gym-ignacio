import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type ExerciseLog = {
  id: number
  exercise_id: number
  volume: number
  improvement_percent: number
  status: string
}

type SetRow = {
  id: number
  exercise_log_id: number
  set_number: number
  weight: number
  reps: number
}

export default function WorkoutDetail() {
  const { id } = useParams()
  const [logs, setLogs] = useState<ExerciseLog[]>([])
  const [exercises, setExercises] = useState<Record<number, string>>({})
  const [sets, setSets] = useState<Record<number, SetRow[]>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadDetail() {
      if (!id) return

      const { data: logData, error: logError } = await supabase
        .from('exercise_logs')
        .select('id, exercise_id, volume, improvement_percent, status')
        .eq('workout_id', Number(id))
        .order('id')

      if (logError) {
        setError(logError.message)
        return
      }

      const logsList = (logData ?? []) as ExerciseLog[]
      setLogs(logsList)

      const { data: exerciseData, error: exerciseError } = await supabase
        .from('exercises')
        .select('id, name')

      if (exerciseError) {
        setError(exerciseError.message)
        return
      }

      const exerciseMap: Record<number, string> = {}

      ;(exerciseData ?? []).forEach((exercise: any) => {
        exerciseMap[Number(exercise.id)] = exercise.name
      })

      setExercises(exerciseMap)

      const logIds = logsList.map((log) => log.id)

      if (logIds.length === 0) return

      const { data: setData, error: setsError } = await supabase
        .from('sets')
        .select('id, exercise_log_id, set_number, weight, reps')
        .in('exercise_log_id', logIds)
        .order('set_number')

      if (setsError) {
        setError(setsError.message)
        return
      }

      const setMap: Record<number, SetRow[]> = {}

      ;(setData ?? []).forEach((set: any) => {
        const logId = Number(set.exercise_log_id)

        if (!setMap[logId]) {
          setMap[logId] = []
        }

        setMap[logId].push(set as SetRow)
      })

      setSets(setMap)
    }

    loadDetail()
  }, [id])

  function getStatusLabel(status: string) {
    if (status === 'better') return '🟢 Mejor'
    if (status === 'same') return '🟡 Igual'
    return '🔴 Peor'
  }

  return (
    <main className="page">
      <Link to="/history">
        <button className="secondary-button" style={{ marginBottom: 18 }}>
          ← Volver al historial
        </button>
      </Link>

      <h1 className="title">Detalle</h1>
      <p className="subtitle">Revisión completa del entrenamiento.</p>

      {error && (
        <div className="card">
          <p style={{ color: '#ff6b6b' }}>{error}</p>
        </div>
      )}

      {logs.length === 0 && !error && (
        <div className="card">
          <p>No hay detalles para este entrenamiento.</p>
        </div>
      )}

      {logs.map((log) => (
        <div key={log.id} className="card">
          <h2 style={{ marginTop: 0 }}>
            {exercises[log.exercise_id] ?? 'Ejercicio'}
          </h2>

          <div className="grid">
            <div className="stat">
              <div className="stat-label">Volumen</div>
              <div className="stat-value">{log.volume} kg</div>
            </div>

            <div className="stat">
              <div className="stat-label">Mejora</div>
              <div className="stat-value">{log.improvement_percent}%</div>
            </div>
          </div>

          <div className="stat" style={{ marginTop: 14 }}>
            <div className="stat-label">Estado</div>
            <div className="stat-value">{getStatusLabel(log.status)}</div>
          </div>

          <h3>Series</h3>

          {(sets[log.id] ?? []).map((set) => (
            <div key={set.id} className="stat" style={{ marginBottom: 10 }}>
              <div className="stat-label">Serie {set.set_number}</div>
              <div className="stat-value">
                {set.reps} reps · {set.weight} kg
              </div>
            </div>
          ))}
        </div>
      ))}
    </main>
  )
}
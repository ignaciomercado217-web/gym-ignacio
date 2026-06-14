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
    <div style={{ padding: 20 }}>
      <Link to="/history">
        <button style={{ marginBottom: 16 }}>← Volver al historial</button>
      </Link>

      <h1>Detalle del entrenamiento</h1>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {logs.length === 0 && !error && (
        <p>No hay detalles para este entrenamiento.</p>
      )}

      {logs.map((log) => (
        <div
          key={log.id}
          style={{
            padding: 12,
            marginBottom: 12,
            border: '1px solid #ddd',
            borderRadius: 8,
          }}
        >
          <h3>{exercises[log.exercise_id] ?? 'Ejercicio'}</h3>

          <p>Volumen: {log.volume} kg</p>
          <p>Mejora: {log.improvement_percent}%</p>
          <p>{getStatusLabel(log.status)}</p>

          <h4>Series</h4>

          {(sets[log.id] ?? []).map((set) => (
            <p key={set.id}>
              Serie {set.set_number}: {set.reps} reps x {set.weight} kg
            </p>
          ))}
        </div>
      ))}
    </div>
  )
}
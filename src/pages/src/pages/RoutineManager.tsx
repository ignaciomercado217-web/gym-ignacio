import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Exercise = {
  id: number
  name: string
  routine_id: number
  target_sets: number
  min_reps: number
  max_reps: number
  default_weight: number | null
  next_weight: number | null
  active: boolean
}

export default function RoutineManager() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadExercises()
  }, [])

  async function loadExercises() {
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .order('routine_id')
      .order('id')

    setExercises(data ?? [])
    setLoading(false)
  }

  async function toggleExercise(id: number, active: boolean) {
    await supabase
      .from('exercises')
      .update({ active: !active })
      .eq('id', id)

    loadExercises()
  }

  return (
    <main className="page">
      <Link to="/">
        <button className="secondary-button" style={{ marginBottom: 16 }}>
          ← Volver al inicio
        </button>
      </Link>

      <h1 className="title">⚙️ Administrar rutina</h1>

      <p className="subtitle">
        Activá o desactivá ejercicios sin perder historial.
      </p>

      {loading && <p>Cargando...</p>}

      {exercises.map((exercise) => (
        <div key={exercise.id} className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <strong>{exercise.name}</strong>

            <span>
              {exercise.active ? '🟢 Activo' : '🔴 Inactivo'}
            </span>
          </div>

          <p>
            {exercise.target_sets} series · {exercise.min_reps}-{exercise.max_reps} reps
          </p>

          <p>
            Peso actual:{' '}
            {exercise.next_weight ?? exercise.default_weight ?? 0} kg
          </p>

          <button
            className="secondary-button"
            onClick={() =>
              toggleExercise(exercise.id, exercise.active)
            }
          >
            {exercise.active
              ? 'Desactivar ejercicio'
              : 'Activar ejercicio'}
          </button>
        </div>
      ))}
    </main>
  )
}
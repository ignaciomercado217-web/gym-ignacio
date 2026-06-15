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
  active: boolean | null
}

type EditingExercise = {
  id: number
  name: string
  target_sets: number
  min_reps: number
  max_reps: number
  default_weight: number
  next_weight: number
}

export default function RoutineManager() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingExercise, setEditingExercise] =
    useState<EditingExercise | null>(null)

  useEffect(() => {
    loadExercises()
  }, [])

  async function loadExercises() {
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .order('routine_id')
      .order('id')

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setExercises(data ?? [])
    setLoading(false)
  }

  function startEditing(exercise: Exercise) {
    setMessage('')
    setError('')

    setEditingExercise({
      id: exercise.id,
      name: exercise.name,
      target_sets: Number(exercise.target_sets ?? 0),
      min_reps: Number(exercise.min_reps ?? 0),
      max_reps: Number(exercise.max_reps ?? 0),
      default_weight: Number(exercise.default_weight ?? 0),
      next_weight: Number(exercise.next_weight ?? exercise.default_weight ?? 0),
    })
  }

  function cancelEditing() {
    setEditingExercise(null)
  }

  function updateEditingField(
    field: keyof EditingExercise,
    value: string | number
  ) {
    if (!editingExercise) return

    setEditingExercise({
      ...editingExercise,
      [field]: value,
    })
  }

  async function saveExercise() {
    if (!editingExercise) return

    setSaving(true)
    setError('')
    setMessage('')

    const { error } = await supabase
      .from('exercises')
      .update({
        name: editingExercise.name,
        target_sets: Number(editingExercise.target_sets),
        min_reps: Number(editingExercise.min_reps),
        max_reps: Number(editingExercise.max_reps),
        default_weight: Number(editingExercise.default_weight),
        next_weight: Number(editingExercise.next_weight),
      })
      .eq('id', editingExercise.id)

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    setMessage('Ejercicio actualizado correctamente.')
    setEditingExercise(null)
    setSaving(false)
    loadExercises()
  }

  async function toggleExercise(exercise: Exercise) {
    const isActive = exercise.active === true

    const { error } = await supabase
      .from('exercises')
      .update({ active: !isActive })
      .eq('id', exercise.id)

    if (error) {
      setError(error.message)
      return
    }

    loadExercises()
  }

  return (
    <main className="page">
      <Link to="/">
        <button className="secondary-button" style={{ marginBottom: 16 }}>
          ← Volver al inicio
        </button>
      </Link>

      <h1 className="title">Administrar rutina</h1>

      <p className="subtitle">
        Editá ejercicios, pesos, series y rangos de repeticiones.
      </p>

      {loading && (
        <div className="card">
          <p>Cargando ejercicios...</p>
        </div>
      )}

      {error && (
        <div className="card">
          <p style={{ color: '#ff6b6b' }}>{error}</p>
        </div>
      )}

      {message && (
        <div className="card">
          <p>{message}</p>
        </div>
      )}

      {editingExercise && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Editar ejercicio</h2>

          <label className="stat-label">Nombre</label>
          <input
            className="input"
            value={editingExercise.name}
            onChange={(e) => updateEditingField('name', e.target.value)}
          />

          <div style={{ marginTop: 14 }}>
            <label className="stat-label">Series</label>
            <input
              className="input"
              type="number"
              value={editingExercise.target_sets}
              onChange={(e) =>
                updateEditingField('target_sets', Number(e.target.value))
              }
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <label className="stat-label">Reps mínimas</label>
            <input
              className="input"
              type="number"
              value={editingExercise.min_reps}
              onChange={(e) =>
                updateEditingField('min_reps', Number(e.target.value))
              }
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <label className="stat-label">Reps máximas</label>
            <input
              className="input"
              type="number"
              value={editingExercise.max_reps}
              onChange={(e) =>
                updateEditingField('max_reps', Number(e.target.value))
              }
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <label className="stat-label">Peso base</label>
            <input
              className="input"
              type="number"
              value={editingExercise.default_weight}
              onChange={(e) =>
                updateEditingField('default_weight', Number(e.target.value))
              }
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <label className="stat-label">Próximo peso</label>
            <input
              className="input"
              type="number"
              value={editingExercise.next_weight}
              onChange={(e) =>
                updateEditingField('next_weight', Number(e.target.value))
              }
            />
          </div>

          <button
            className="primary-button"
            style={{ marginTop: 18 }}
            onClick={saveExercise}
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>

          <button className="secondary-button" onClick={cancelEditing}>
            Cancelar
          </button>
        </div>
      )}

      {!loading && exercises.length === 0 && (
        <div className="card">
          <p>No se encontraron ejercicios.</p>
        </div>
      )}

      {exercises.map((exercise) => (
        <div key={exercise.id} className="card">
          <div className="stat-label">Rutina #{exercise.routine_id}</div>
          <div className="stat-value">{exercise.name}</div>

          <p>
            {exercise.target_sets} series · {exercise.min_reps}-
            {exercise.max_reps} reps
          </p>

          <p>
            Peso base: {exercise.default_weight ?? 0} kg
            <br />
            Próximo peso: {exercise.next_weight ?? exercise.default_weight ?? 0}{' '}
            kg
          </p>

          <p>{exercise.active === true ? '🟢 Activo' : '🔴 Inactivo'}</p>

          <button
            className="secondary-button"
            style={{ marginBottom: 10 }}
            onClick={() => startEditing(exercise)}
          >
            Editar ejercicio
          </button>

          <button
            className="secondary-button"
            onClick={() => toggleExercise(exercise)}
          >
            {exercise.active === true
              ? 'Desactivar ejercicio'
              : 'Activar ejercicio'}
          </button>
        </div>
      ))}
    </main>
  )
}
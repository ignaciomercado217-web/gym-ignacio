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

type Routine = {
  id: number
  name: string
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

type NewExercise = {
  routine_id: number
  name: string
  target_sets: number
  min_reps: number
  max_reps: number
  default_weight: number
  next_weight: number
}

export default function RoutineManager() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingExercise, setEditingExercise] =
    useState<EditingExercise | null>(null)

  const [newExercise, setNewExercise] = useState<NewExercise>({
    routine_id: 1,
    name: '',
    target_sets: 3,
    min_reps: 8,
    max_reps: 10,
    default_weight: 0,
    next_weight: 0,
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')

    const { data: routineData, error: routineError } = await supabase
      .from('routines')
      .select('id, name')
      .order('id')

    if (routineError) {
      setError(routineError.message)
      setLoading(false)
      return
    }

    setRoutines(routineData ?? [])

    const firstRoutineId = routineData?.[0]?.id ?? 1
    setNewExercise((current) => ({
      ...current,
      routine_id: current.routine_id || firstRoutineId,
    }))

    const { data: exerciseData, error: exerciseError } = await supabase
      .from('exercises')
      .select('*')
      .order('routine_id')
      .order('id')

    if (exerciseError) {
      setError(exerciseError.message)
      setLoading(false)
      return
    }

    setExercises(exerciseData ?? [])
    setLoading(false)
  }

  function updateNewExerciseField(
    field: keyof NewExercise,
    value: string | number
  ) {
    setNewExercise({
      ...newExercise,
      [field]: value,
    })
  }

  async function createExercise() {
    setSaving(true)
    setError('')
    setMessage('')

    if (!newExercise.name.trim()) {
      setError('El nombre del ejercicio no puede estar vacío.')
      setSaving(false)
      return
    }

    const { error } = await supabase.from('exercises').insert({
      routine_id: Number(newExercise.routine_id),
      name: newExercise.name.trim(),
      target_sets: Number(newExercise.target_sets),
      min_reps: Number(newExercise.min_reps),
      max_reps: Number(newExercise.max_reps),
      default_weight: Number(newExercise.default_weight),
      next_weight: Number(newExercise.next_weight || newExercise.default_weight),
      active: true,
    })

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    setMessage('Ejercicio agregado correctamente.')
    setNewExercise({
      routine_id: newExercise.routine_id,
      name: '',
      target_sets: 3,
      min_reps: 8,
      max_reps: 10,
      default_weight: 0,
      next_weight: 0,
    })

    setSaving(false)
    loadData()
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
    loadData()
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

    loadData()
  }

  function getRoutineName(routineId: number) {
    return routines.find((routine) => routine.id === routineId)?.name ?? `Rutina ${routineId}`
  }

  return (
    <main className="page">
      <Link to="/">
        <button className="secondary-button" style={{ marginBottom: 16 }}>
          ← Volver al inicio
        </button>
      </Link>

      <h1 className="title">Administrar rutina</h1>
      <p className="subtitle">Agregá, editá, activá o desactivá ejercicios.</p>

      {loading && <div className="card">Cargando ejercicios...</div>}

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

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Agregar ejercicio</h2>

        <label className="stat-label">Rutina</label>
        <select
          className="input"
          value={newExercise.routine_id}
          onChange={(e) =>
            updateNewExerciseField('routine_id', Number(e.target.value))
          }
        >
          {routines.map((routine) => (
            <option key={routine.id} value={routine.id}>
              {routine.name}
            </option>
          ))}
        </select>

        <div style={{ marginTop: 14 }}>
          <label className="stat-label">Nombre</label>
          <input
            className="input"
            value={newExercise.name}
            onChange={(e) => updateNewExerciseField('name', e.target.value)}
            placeholder="Ej: Press inclinado"
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <label className="stat-label">Series</label>
          <input
            className="input"
            type="number"
            value={newExercise.target_sets}
            onChange={(e) =>
              updateNewExerciseField('target_sets', Number(e.target.value))
            }
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <label className="stat-label">Reps mínimas</label>
          <input
            className="input"
            type="number"
            value={newExercise.min_reps}
            onChange={(e) =>
              updateNewExerciseField('min_reps', Number(e.target.value))
            }
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <label className="stat-label">Reps máximas</label>
          <input
            className="input"
            type="number"
            value={newExercise.max_reps}
            onChange={(e) =>
              updateNewExerciseField('max_reps', Number(e.target.value))
            }
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <label className="stat-label">Peso base</label>
          <input
            className="input"
            type="number"
            value={newExercise.default_weight}
            onChange={(e) =>
              updateNewExerciseField('default_weight', Number(e.target.value))
            }
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <label className="stat-label">Próximo peso</label>
          <input
            className="input"
            type="number"
            value={newExercise.next_weight}
            onChange={(e) =>
              updateNewExerciseField('next_weight', Number(e.target.value))
            }
          />
        </div>

        <button
          className="primary-button"
          style={{ marginTop: 18 }}
          onClick={createExercise}
          disabled={saving}
        >
          {saving ? 'Guardando...' : 'Agregar ejercicio'}
        </button>
      </div>

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

          <button
            className="secondary-button"
            onClick={() => setEditingExercise(null)}
          >
            Cancelar
          </button>
        </div>
      )}

      {!loading && exercises.length === 0 && (
        <div className="card">No se encontraron ejercicios.</div>
      )}

      {exercises.map((exercise) => (
        <div key={exercise.id} className="card">
          <div className="stat-label">{getRoutineName(exercise.routine_id)}</div>
          <div className="stat-value">{exercise.name}</div>

          <p>
            {exercise.target_sets} series · {exercise.min_reps}-
            {exercise.max_reps} reps
          </p>

          <p>
            Peso base: {exercise.default_weight ?? 0} kg
            <br />
            Próximo peso: {exercise.next_weight ?? exercise.default_weight ?? 0} kg
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
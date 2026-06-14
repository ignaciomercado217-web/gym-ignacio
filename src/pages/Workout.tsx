import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Routine = {
  id: number
  name: string
}

type Exercise = {
  id: number
  name: string
  target_sets: number
  min_reps: number
  max_reps: number
  default_weight: number
}

type ExerciseInput = {
  exerciseId: number
  weight: number
  reps: number[]
}

export default function Workout() {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [inputs, setInputs] = useState<Record<number, ExerciseInput>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function loadRoutines() {
      const { data } = await supabase.from('routines').select('*').order('id')
      setRoutines(data ?? [])
    }

    loadRoutines()
  }, [])

  async function selectRoutine(routine: Routine) {
    setSelectedRoutine(routine)
    setMessage('')

    const { data } = await supabase
      .from('exercises')
      .select('*')
      .eq('routine_id', routine.id)
      .order('id')

    const loadedExercises = data ?? []
    setExercises(loadedExercises)

    const initialInputs: Record<number, ExerciseInput> = {}

    loadedExercises.forEach((exercise) => {
      initialInputs[exercise.id] = {
        exerciseId: exercise.id,
        weight: Number(exercise.default_weight ?? 0),
        reps: Array(exercise.target_sets).fill(0),
      }
    })

    setInputs(initialInputs)
  }

  function updateWeight(exerciseId: number, weight: number) {
    setInputs((current) => ({
      ...current,
      [exerciseId]: {
        ...current[exerciseId],
        weight,
      },
    }))
  }

  function updateReps(exerciseId: number, setIndex: number, reps: number) {
    setInputs((current) => {
      const currentInput = current[exerciseId]
      const newReps = [...currentInput.reps]
      newReps[setIndex] = reps

      return {
        ...current,
        [exerciseId]: {
          ...currentInput,
          reps: newReps,
        },
      }
    })
  }

  async function finishWorkout() {
    if (!selectedRoutine) return

    setSaving(true)
    setMessage('')

    const today = new Date().toISOString().slice(0, 10)

    const { data: workout, error: workoutError } = await supabase
      .from('workouts')
      .insert({
        routine_id: selectedRoutine.id,
        workout_date: today,
      })
      .select()
      .single()

    if (workoutError) {
      setMessage(`Error creando entrenamiento: ${workoutError.message}`)
      setSaving(false)
      return
    }

    let totalVolume = 0

    for (const exercise of exercises) {
      const input = inputs[exercise.id]
      const validReps = input.reps.filter((rep) => rep > 0)
      const volume = validReps.reduce((sum, reps) => sum + reps * input.weight, 0)

      totalVolume += volume

      const { data: exerciseLog, error: logError } = await supabase
        .from('exercise_logs')
        .insert({
          workout_id: workout.id,
          exercise_id: exercise.id,
          volume,
          improvement_percent: 0,
          status: 'same',
        })
        .select()
        .single()

      if (logError) {
        setMessage(`Error guardando ${exercise.name}: ${logError.message}`)
        setSaving(false)
        return
      }

      const setsToInsert = validReps.map((reps, index) => ({
        exercise_log_id: exerciseLog.id,
        set_number: index + 1,
        weight: input.weight,
        reps,
      }))

      if (setsToInsert.length > 0) {
        const { error: setsError } = await supabase
          .from('sets')
          .insert(setsToInsert)

        if (setsError) {
          setMessage(`Error guardando series: ${setsError.message}`)
          setSaving(false)
          return
        }
      }
    }

    await supabase
      .from('workouts')
      .update({
        total_volume: totalVolume,
      })
      .eq('id', workout.id)

    setSaving(false)
    setMessage(`Entrenamiento guardado. Volumen total: ${totalVolume} kg`)
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Iniciar entrenamiento</h1>

      {!selectedRoutine &&
        routines.map((routine) => (
          <button
            key={routine.id}
            onClick={() => selectRoutine(routine)}
            style={{ display: 'block', marginBottom: 12 }}
          >
            {routine.name}
          </button>
        ))}

      {selectedRoutine && (
        <>
          <h2>{selectedRoutine.name}</h2>

          {exercises.map((exercise) => {
            const input = inputs[exercise.id]

            if (!input) return null

            return (
              <div
                key={exercise.id}
                style={{
                  marginBottom: 24,
                  padding: 16,
                  border: '1px solid #ddd',
                  borderRadius: 8,
                }}
              >
                <h3>{exercise.name}</h3>

                <p>
                  Objetivo: {exercise.target_sets} series · {exercise.min_reps}-
                  {exercise.max_reps} reps
                </p>

                <label>
                  Peso kg:{' '}
                  <input
                    type="number"
                    value={input.weight}
                    onChange={(e) =>
                      updateWeight(exercise.id, Number(e.target.value))
                    }
                  />
                </label>

                <div style={{ marginTop: 12 }}>
                  {input.reps.map((reps, index) => (
                    <div key={index} style={{ marginBottom: 8 }}>
                      <label>
                        Serie {index + 1} reps:{' '}
                        <input
                          type="number"
                          value={reps || ''}
                          onChange={(e) =>
                            updateReps(
                              exercise.id,
                              index,
                              Number(e.target.value)
                            )
                          }
                        />
                      </label>
                    </div>
                  ))}
                </div>

                <p>
                  Volumen:{' '}
                  {input.reps.reduce(
                    (sum, reps) => sum + reps * input.weight,
                    0
                  )}{' '}
                  kg
                </p>
              </div>
            )
          })}

          <button onClick={finishWorkout} disabled={saving}>
            {saving ? 'Guardando...' : 'Finalizar entrenamiento'}
          </button>

          {message && <p>{message}</p>}
        </>
      )}
    </div>
  )
}
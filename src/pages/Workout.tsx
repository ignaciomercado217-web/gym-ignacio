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

type ExerciseResult = {
  exerciseName: string
  currentVolume: number
  previousVolume: number
  improvementPercent: number
  status: 'better' | 'same' | 'worse'
}

export default function Workout() {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [inputs, setInputs] = useState<Record<number, ExerciseInput>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [results, setResults] = useState<ExerciseResult[]>([])
  const [ire, setIre] = useState<number | null>(null)

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
    setResults([])
    setIre(null)

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

  function getStatus(percent: number): 'better' | 'same' | 'worse' {
    if (percent > 0) return 'better'
    if (percent === 0) return 'same'
    return 'worse'
  }

  function getStatusLabel(status: 'better' | 'same' | 'worse') {
    if (status === 'better') return '🟢 Mejor'
    if (status === 'same') return '🟡 Igual'
    return '🔴 Peor'
  }

  async function getPreviousWorkout(routineId: number) {
    const { data } = await supabase
      .from('workouts')
      .select('id, workout_date')
      .eq('routine_id', routineId)
      .order('workout_date', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)

    return data?.[0] ?? null
  }

  async function getPreviousExerciseVolumes(workoutId: number) {
    const { data } = await supabase
      .from('exercise_logs')
      .select('exercise_id, volume')
      .eq('workout_id', workoutId)

    const volumes: Record<number, number> = {}

    data?.forEach((log) => {
      volumes[Number(log.exercise_id)] = Number(log.volume ?? 0)
    })

    return volumes
  }

  async function finishWorkout() {
    if (!selectedRoutine) return

    setSaving(true)
    setMessage('')
    setResults([])
    setIre(null)

    const today = new Date().toISOString().slice(0, 10)

    const previousWorkout = await getPreviousWorkout(selectedRoutine.id)
    const previousVolumes = previousWorkout
      ? await getPreviousExerciseVolumes(previousWorkout.id)
      : {}

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
    let improvedExercises = 0
    let sameExercises = 0
    let worseExercises = 0
    const exerciseResults: ExerciseResult[] = []

    for (const exercise of exercises) {
      const input = inputs[exercise.id]
      const validReps = input.reps.filter((rep) => rep > 0)
      const currentVolume = validReps.reduce(
        (sum, reps) => sum + reps * input.weight,
        0
      )

      totalVolume += currentVolume

      const previousVolume = previousVolumes[exercise.id] ?? 0

      let improvementPercent = 0

      if (previousVolume > 0) {
        improvementPercent =
          ((currentVolume - previousVolume) / previousVolume) * 100
      }

      improvementPercent = Number(improvementPercent.toFixed(2))

      const status = previousVolume === 0 ? 'same' : getStatus(improvementPercent)

      if (status === 'better') improvedExercises++
      if (status === 'same') sameExercises++
      if (status === 'worse') worseExercises++

      exerciseResults.push({
        exerciseName: exercise.name,
        currentVolume,
        previousVolume,
        improvementPercent,
        status,
      })

      const { data: exerciseLog, error: logError } = await supabase
        .from('exercise_logs')
        .insert({
          workout_id: workout.id,
          exercise_id: exercise.id,
          volume: currentVolume,
          improvement_percent: improvementPercent,
          status,
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

    const validComparisons = exerciseResults.filter(
      (result) => result.previousVolume > 0
    )

    const finalIre =
      validComparisons.length > 0
        ? Number(
            (
              validComparisons.reduce(
                (sum, result) => sum + result.improvementPercent,
                0
              ) / validComparisons.length
            ).toFixed(2)
          )
        : 0

    await supabase
      .from('workouts')
      .update({
        total_volume: totalVolume,
        ire: finalIre,
        improved_exercises: improvedExercises,
        same_exercises: sameExercises,
        worse_exercises: worseExercises,
      })
      .eq('id', workout.id)

    setResults(exerciseResults)
    setIre(finalIre)
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

            const exerciseVolume = input.reps.reduce(
              (sum, reps) => sum + reps * input.weight,
              0
            )

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

                <p>Volumen: {exerciseVolume} kg</p>
              </div>
            )
          })}

          <button onClick={finishWorkout} disabled={saving}>
            {saving ? 'Guardando...' : 'Finalizar entrenamiento'}
          </button>

          {message && <p>{message}</p>}

          {ire !== null && (
            <div style={{ marginTop: 24 }}>
              <h2>Resumen del entrenamiento</h2>

              <h3>IRE: {ire}%</h3>

              {results.map((result) => (
                <div
                  key={result.exerciseName}
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    border: '1px solid #ddd',
                    borderRadius: 8,
                  }}
                >
                  <strong>{result.exerciseName}</strong>

                  <p>Volumen anterior: {result.previousVolume} kg</p>
                  <p>Volumen actual: {result.currentVolume} kg</p>
                  <p>Mejora: {result.improvementPercent}%</p>
                  <p>{getStatusLabel(result.status)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
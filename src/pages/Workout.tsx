import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Routine = { id: number; name: string }

type Exercise = {
  id: number
  name: string
  target_sets: number
  min_reps: number
  max_reps: number
  default_weight: number
  next_weight: number | null
}

type ExerciseInput = {
  exerciseId: number
  weight: number
  reps: number[]
  nextWeight: number
  goalCompleted: boolean
}

type ExerciseResult = {
  exerciseName: string
  currentVolume: number
  previousVolume: number
  improvementPercent: number
  status: 'better' | 'same' | 'worse'
  goalCompleted: boolean
  nextWeight: number
}

export default function Workout() {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [inputs, setInputs] = useState<Record<number, ExerciseInput>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [results, setResults] = useState<ExerciseResult[]>([])
  const [performance, setPerformance] = useState<number | null>(null)

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
    setPerformance(null)

    const { data } = await supabase
      .from('exercises')
      .select('*')
      .eq('routine_id', routine.id)
      .order('id')

    const loadedExercises = data ?? []
    setExercises(loadedExercises)

    const initialInputs: Record<number, ExerciseInput> = {}

    loadedExercises.forEach((exercise) => {
      const startingWeight = Number(exercise.next_weight ?? exercise.default_weight ?? 0)

      initialInputs[exercise.id] = {
        exerciseId: exercise.id,
        weight: startingWeight,
        reps: Array(exercise.target_sets).fill(0),
        nextWeight: startingWeight + 2.5,
        goalCompleted: false,
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
        nextWeight: weight + 2.5,
      },
    }))
  }

  function updateNextWeight(exerciseId: number, nextWeight: number) {
    setInputs((current) => ({
      ...current,
      [exerciseId]: {
        ...current[exerciseId],
        nextWeight,
      },
    }))
  }

  function updateReps(exerciseId: number, setIndex: number, reps: number) {
    const exercise = exercises.find((item) => item.id === exerciseId)
    if (!exercise) return

    setInputs((current) => {
      const currentInput = current[exerciseId]
      const newReps = [...currentInput.reps]
      newReps[setIndex] = reps

      const completed =
        newReps.length === exercise.target_sets &&
        newReps.every((rep) => rep >= exercise.max_reps)

      return {
        ...current,
        [exerciseId]: {
          ...currentInput,
          reps: newReps,
          goalCompleted: completed,
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
    setPerformance(null)

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

      if (input.goalCompleted) {
        await supabase
          .from('exercises')
          .update({
            next_weight: input.nextWeight,
          })
          .eq('id', exercise.id)
      }

      exerciseResults.push({
        exerciseName: exercise.name,
        currentVolume,
        previousVolume,
        improvementPercent,
        status,
        goalCompleted: input.goalCompleted,
        nextWeight: input.nextWeight,
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
        const { error: setsError } = await supabase.from('sets').insert(setsToInsert)

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

    const finalPerformance =
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
        ire: finalPerformance,
        improved_exercises: improvedExercises,
        same_exercises: sameExercises,
        worse_exercises: worseExercises,
      })
      .eq('id', workout.id)

    setResults(exerciseResults)
    setPerformance(finalPerformance)
    setSaving(false)
    setMessage(`Entrenamiento guardado. Volumen total: ${totalVolume} kg`)
  }

  return (
    <div style={{ padding: 20 }}>
      <Link to="/">
  <button style={{ marginBottom: 16 }}>
    ← Volver al inicio
  </button>
</Link>
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

                {input.goalCompleted && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 12,
                      border: '1px solid green',
                      borderRadius: 8,
                    }}
                  >
                    <strong>✅ Objetivo cumplido</strong>
                    <p>Programar peso para la próxima semana:</p>

                    <input
                      type="number"
                      value={input.nextWeight}
                      onChange={(e) =>
                        updateNextWeight(exercise.id, Number(e.target.value))
                      }
                    />{' '}
                    kg
                  </div>
                )}
              </div>
            )
          })}

          <button onClick={finishWorkout} disabled={saving}>
            {saving ? 'Guardando...' : 'Finalizar entrenamiento'}
          </button>

          {message && <p>{message}</p>}

          {performance !== null && (
            <div style={{ marginTop: 24 }}>
              <h2>Resumen del entrenamiento</h2>

              <h3>Rendimiento del entrenamiento: {performance}%</h3>

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

                  {result.goalCompleted && (
                    <p>✅ Próxima semana: {result.nextWeight} kg</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
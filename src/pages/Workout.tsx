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
      const startingWeight = Number(
        exercise.next_weight ?? exercise.default_weight ?? 0
      )

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
    <main className="page">
      <Link to="/">
        <button className="secondary-button" style={{ marginBottom: 18 }}>
          ← Volver al inicio
        </button>
      </Link>

      <h1 className="title">Entrenamiento</h1>
      <p className="subtitle">Registrá tu sesión y seguí tu progreso.</p>

      {!selectedRoutine &&
        routines.map((routine) => (
          <div
            key={routine.id}
            className="card"
            style={{ cursor: 'pointer' }}
            onClick={() => selectRoutine(routine)}
          >
            <div className="stat-label">Rutina</div>
            <div className="stat-value">{routine.name}</div>
          </div>
        ))}

      {selectedRoutine && (
        <>
          <div className="card">
            <div className="stat-label">Rutina seleccionada</div>
            <div className="stat-value">{selectedRoutine.name}</div>
          </div>

          {exercises.map((exercise) => {
            const input = inputs[exercise.id]
            if (!input) return null

            const exerciseVolume = input.reps.reduce(
              (sum, reps) => sum + reps * input.weight,
              0
            )

            return (
              <div key={exercise.id} className="card">
                <h2 style={{ marginTop: 0 }}>{exercise.name}</h2>

                <p className="subtitle" style={{ marginBottom: 18 }}>
                  Objetivo: {exercise.target_sets} series · {exercise.min_reps}-
                  {exercise.max_reps} reps
                </p>

                <label className="stat-label">Peso kg</label>
                <input
                  className="input"
                  type="number"
                  value={input.weight}
                  onChange={(e) =>
                    updateWeight(exercise.id, Number(e.target.value))
                  }
                />

                <div style={{ marginTop: 18 }}>
                  {input.reps.map((reps, index) => (
                    <div key={index} style={{ marginBottom: 12 }}>
                      <label className="stat-label">Serie {index + 1} reps</label>
                      <input
                        className="input"
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
                    </div>
                  ))}
                </div>

                <div className="stat" style={{ marginTop: 16 }}>
                  <div className="stat-label">Volumen</div>
                  <div className="stat-value">{exerciseVolume} kg</div>
                </div>

                {input.goalCompleted && (
                  <div className="success-box">
                    <strong>✅ Objetivo cumplido</strong>
                    <p>Programar peso para la próxima semana:</p>

                    <input
                      className="input"
                      type="number"
                      value={input.nextWeight}
                      onChange={(e) =>
                        updateNextWeight(exercise.id, Number(e.target.value))
                      }
                    />
                  </div>
                )}
              </div>
            )
          })}

          <button
            className="primary-button"
            onClick={finishWorkout}
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Finalizar entrenamiento'}
          </button>

          {message && <div className="card">{message}</div>}

          {performance !== null && (
            <div style={{ marginTop: 24 }}>
              <h2>Resumen del entrenamiento</h2>

              <div className="card">
                <div className="stat-label">Rendimiento del entrenamiento</div>
                <div className="stat-value">{performance}%</div>
              </div>

              {results.map((result) => (
                <div key={result.exerciseName} className="card">
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
    </main>
  )
}
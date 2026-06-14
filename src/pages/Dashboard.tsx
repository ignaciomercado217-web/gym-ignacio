import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Workout = {
  id: number
  workout_date: string
  ire: number
  total_volume: number
}

type Exercise = {
  id: number
  name: string
  next_weight: number | null
  default_weight: number
}

type SetRow = {
  id: number
  exercise_log_id: number
  weight: number
  reps: number
}

type ExerciseLog = {
  id: number
  exercise_id: number
}

type PersonalRecord = {
  exerciseName: string
  weight: number
  reps: number
}

export default function Dashboard() {
  const [workoutCount, setWorkoutCount] = useState(0)
  const [totalReps, setTotalReps] = useState(0)
  const [lastWorkout, setLastWorkout] = useState<Workout | null>(null)
  const [averageProgress, setAverageProgress] = useState(0)
  const [bestWorkout, setBestWorkout] = useState<Workout | null>(null)
  const [bestExercise, setBestExercise] = useState('')
  const [bestExerciseProgress, setBestExerciseProgress] = useState(0)
  const [programmedWeights, setProgrammedWeights] = useState<Exercise[]>([])
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([])

  useEffect(() => {
    loadDashboard()
  }, [])

  function getPerformanceLabel(value: number) {
    if (value > 0) return `🟢 +${value}%`
    if (value === 0) return `🟡 ${value}%`
    return `🔴 ${value}%`
  }

  async function loadDashboard() {
    const { data: workouts } = await supabase
      .from('workouts')
      .select('id, workout_date, ire, total_volume')
      .order('workout_date', { ascending: false })
      .order('id', { ascending: false })

    const workoutList = workouts ?? []

    setWorkoutCount(workoutList.length)
    setLastWorkout(workoutList[0] ?? null)

    if (workoutList.length > 0) {
      const average =
        workoutList.reduce(
          (sum, workout) => sum + Number(workout.ire ?? 0),
          0
        ) / workoutList.length

      setAverageProgress(Number(average.toFixed(2)))

      const best = [...workoutList].sort(
        (a, b) => Number(b.ire ?? 0) - Number(a.ire ?? 0)
      )[0]

      setBestWorkout(best)
    }

    const { data: logs } = await supabase.from('exercise_logs').select(`
      volume,
      exercise_id,
      exercises(name)
    `)

    const exerciseStats: Record<
      number,
      {
        name: string
        firstVolume: number
        bestVolume: number
      }
    > = {}

    logs?.forEach((log: any) => {
      const exerciseId = Number(log.exercise_id)
      const volume = Number(log.volume ?? 0)

      if (!exerciseStats[exerciseId]) {
        exerciseStats[exerciseId] = {
          name: log.exercises?.name ?? 'Ejercicio',
          firstVolume: volume,
          bestVolume: volume,
        }
      }

      if (volume > exerciseStats[exerciseId].bestVolume) {
        exerciseStats[exerciseId].bestVolume = volume
      }
    })

    let winnerName = ''
    let winnerProgress = 0

    Object.values(exerciseStats).forEach((exercise) => {
      if (exercise.firstVolume <= 0) return

      const progress =
        ((exercise.bestVolume - exercise.firstVolume) /
          exercise.firstVolume) *
        100

      if (progress > winnerProgress) {
        winnerProgress = progress
        winnerName = exercise.name
      }
    })

    setBestExercise(winnerName)
    setBestExerciseProgress(Number(winnerProgress.toFixed(2)))

    const { data: sets } = await supabase
      .from('sets')
      .select('id, exercise_log_id, weight, reps')

    const reps = (sets ?? []).reduce(
      (sum, item) => sum + Number(item.reps ?? 0),
      0
    )

    setTotalReps(reps)

    const { data: exercises } = await supabase
      .from('exercises')
      .select('id, name, next_weight, default_weight')
      .order('id')

    const programmed = (exercises ?? []).filter(
      (exercise) =>
        exercise.next_weight !== null &&
        Number(exercise.next_weight) !== Number(exercise.default_weight)
    )

    setProgrammedWeights(programmed)

    const { data: exerciseLogs } = await supabase
      .from('exercise_logs')
      .select('id, exercise_id')

    const exerciseNameMap: Record<number, string> = {}

    ;(exercises ?? []).forEach((exercise: Exercise) => {
      exerciseNameMap[exercise.id] = exercise.name
    })

    const logToExerciseMap: Record<number, number> = {}

    ;(exerciseLogs ?? []).forEach((log: ExerciseLog) => {
      logToExerciseMap[log.id] = log.exercise_id
    })

    const recordsMap: Record<number, PersonalRecord> = {}

    ;(sets ?? []).forEach((set: SetRow) => {
      const exerciseId = logToExerciseMap[set.exercise_log_id]

      if (!exerciseId) return

      const currentScore = Number(set.weight) * Number(set.reps)
      const existingRecord = recordsMap[exerciseId]
      const existingScore = existingRecord
        ? existingRecord.weight * existingRecord.reps
        : 0

      if (!existingRecord || currentScore > existingScore) {
        recordsMap[exerciseId] = {
          exerciseName: exerciseNameMap[exerciseId] ?? 'Ejercicio',
          weight: Number(set.weight),
          reps: Number(set.reps),
        }
      }
    })

    const records = Object.values(recordsMap)
      .sort((a, b) => b.weight * b.reps - a.weight * a.reps)
      .slice(0, 5)

    setPersonalRecords(records)
  }

  return (
    <main className="page">
      <h1 className="title">Gym Ignacio</h1>
      <p className="subtitle">Tu progreso de entrenamiento en un solo lugar.</p>

      <div className="grid">
        <div className="stat">
          <div className="stat-label">Entrenamientos</div>
          <div className="stat-value">{workoutCount}</div>
        </div>

        <div className="stat">
          <div className="stat-label">Repeticiones</div>
          <div className="stat-value">{totalReps}</div>
        </div>

        <div className="stat">
          <div className="stat-label">Último entrenamiento</div>
          <div className="stat-value">
            {lastWorkout
              ? getPerformanceLabel(Number(lastWorkout.ire ?? 0))
              : '—'}
          </div>
        </div>

        <div className="stat">
          <div className="stat-label">Progreso promedio</div>
          <div className="stat-value">{getPerformanceLabel(averageProgress)}</div>
        </div>
      </div>

      <div className="card">
        <div className="stat-label">Récord de progreso</div>
        <div className="stat-value">
          {bestWorkout
            ? getPerformanceLabel(Number(bestWorkout.ire ?? 0))
            : '—'}
        </div>
      </div>

      <div className="card">
        <div className="stat-label">Ejercicio con mayor progreso</div>
        <div className="stat-value">
          {bestExercise
            ? `${bestExercise} (+${bestExerciseProgress}%)`
            : '—'}
        </div>
      </div>

      <Link to="/workout">
        <button className="primary-button">Iniciar entrenamiento</button>
      </Link>

      <Link to="/history">
        <button className="secondary-button">Ver historial</button>
      </Link>

      <h2>🏆 Récords personales</h2>

      {personalRecords.length === 0 && (
        <div className="card">
          <p>No hay récords registrados todavía.</p>
        </div>
      )}

      {personalRecords.map((record, index) => (
        <div key={`${record.exerciseName}-${index}`} className="card">
          <div className="stat-label">PR #{index + 1}</div>
          <div className="stat-value">{record.exerciseName}</div>
          <p>
            {record.weight} kg x {record.reps} reps
          </p>
        </div>
      ))}

      <h2>Próximos pesos</h2>

      {programmedWeights.length === 0 && (
        <div className="card">
          <p>No hay pesos programados todavía.</p>
        </div>
      )}

      {programmedWeights.map((exercise) => (
        <div key={exercise.id} className="card">
          <strong>{exercise.name}</strong>
          <p>Próxima sesión: {exercise.next_weight} kg</p>
        </div>
      ))}
    </main>
  )
}
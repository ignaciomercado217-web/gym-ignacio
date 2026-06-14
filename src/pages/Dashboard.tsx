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

export default function Dashboard() {
  const [workoutCount, setWorkoutCount] = useState(0)
  const [totalReps, setTotalReps] = useState(0)
  const [lastWorkout, setLastWorkout] = useState<Workout | null>(null)
  const [averageProgress, setAverageProgress] = useState(0)
  const [bestWorkout, setBestWorkout] = useState<Workout | null>(null)
  const [bestExercise, setBestExercise] = useState('')
  const [bestExerciseProgress, setBestExerciseProgress] = useState(0)
  const [programmedWeights, setProgrammedWeights] = useState<Exercise[]>([])

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

    const { data: sets } = await supabase.from('sets').select('reps')

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
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>🏋️ Gym Ignacio</h1>

      <div style={{ marginBottom: 20 }}>
        <p>Entrenamientos realizados: {workoutCount}</p>
        <p>Repeticiones totales: {totalReps}</p>

        <p>
          Último entrenamiento:{' '}
          {lastWorkout
            ? getPerformanceLabel(Number(lastWorkout.ire ?? 0))
            : 'Sin datos'}
        </p>

        <p>Progreso promedio: {getPerformanceLabel(averageProgress)}</p>

        <p>
          Récord de progreso:{' '}
          {bestWorkout
            ? getPerformanceLabel(Number(bestWorkout.ire ?? 0))
            : 'Sin datos'}
        </p>

        <p>
          🏆 Ejercicio con mayor progreso:{' '}
          {bestExercise
            ? `${bestExercise} (+${bestExerciseProgress}%)`
            : 'Sin datos'}
        </p>
      </div>

      <Link to="/workout">
        <button style={{ marginBottom: 24 }}>Iniciar entrenamiento</button>
        <br />

<Link to="/history">
  <button>Ver historial</button>
</Link>
      </Link>

      <h2>Próximos pesos programados</h2>

      {programmedWeights.length === 0 && <p>No hay pesos programados todavía.</p>}

      {programmedWeights.map((exercise) => (
        <div
          key={exercise.id}
          style={{
            padding: 12,
            marginBottom: 10,
            border: '1px solid #ddd',
            borderRadius: 8,
          }}
        >
          <strong>{exercise.name}</strong>
          <p>Próxima sesión: {exercise.next_weight} kg</p>
        </div>
      ))}
    </div>
  )
}
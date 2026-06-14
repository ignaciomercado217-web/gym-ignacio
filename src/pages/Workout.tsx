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

export default function Workout() {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])

  useEffect(() => {
    async function loadRoutines() {
      const { data } = await supabase.from('routines').select('*').order('id')
      setRoutines(data ?? [])
    }

    loadRoutines()
  }, [])

  async function selectRoutine(routine: Routine) {
    setSelectedRoutine(routine)

    const { data } = await supabase
      .from('exercises')
      .select('*')
      .eq('routine_id', routine.id)
      .order('id')

    setExercises(data ?? [])
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Iniciar entrenamiento</h1>

      {!selectedRoutine && routines.map((routine) => (
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

          {exercises.map((exercise) => (
            <div key={exercise.id} style={{ marginBottom: 16 }}>
              <h3>{exercise.name}</h3>
              <p>
                {exercise.target_sets} series · {exercise.min_reps}-{exercise.max_reps} reps · {exercise.default_weight} kg
              </p>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
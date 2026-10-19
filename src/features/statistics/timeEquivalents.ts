/** What the saved time could have been spent on: ~60% reading, ~30% as 45-minute workouts, the rest sleep. */
export function timeEquivalents(totalMinutes: number) {
  const readingMinutes = Math.floor(totalMinutes * 0.6);
  return { readingHours: Math.floor(readingMinutes / 60), readingMinutes, workouts: Math.round((totalMinutes * 0.3) / 45) };
}

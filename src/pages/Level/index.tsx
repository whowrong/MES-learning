import { LevelPage } from "./LevelPage"
import { useLevel } from "./useLevel"

export default function LevelRoute() {
  const vm = useLevel()
  return <LevelPage {...vm} />
}

import { DbTrainingPage } from "./DbTrainingPage"
import { useDbTraining } from "./useDbTraining"

export default function DbTrainingRoute() {
  const vm = useDbTraining()
  return <DbTrainingPage {...vm} />
}

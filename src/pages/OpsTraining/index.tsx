import { OpsTrainingPage } from "./OpsTrainingPage"
import { useOpsTraining } from "./useOpsTraining"

export default function OpsTrainingRoute() {
  const vm = useOpsTraining()
  return <OpsTrainingPage {...vm} />
}

import { CareerPrepPage } from "./CareerPrepPage"
import { useCareerPrep } from "./useCareerPrep"

export default function CareerPrepRoute() {
  const vm = useCareerPrep()
  return <CareerPrepPage {...vm} />
}

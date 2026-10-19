import { FactoryTypesPage } from "./FactoryTypesPage"
import { useFactoryTypes } from "./useFactoryTypes"

export default function FactoryTypesRoute() {
  const vm = useFactoryTypes()
  return <FactoryTypesPage {...vm} />
}

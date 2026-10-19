import { GlossaryPage } from "./GlossaryPage"
import { useGlossary } from "./useGlossary"

export default function GlossaryRoute() {
  const vm = useGlossary()
  return <GlossaryPage {...vm} />
}

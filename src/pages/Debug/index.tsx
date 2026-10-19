import { DebugPage } from "./DebugPage"
import { useDebug } from "./useDebug"

export default function DebugRoute() {
  const vm = useDebug()
  return <DebugPage {...vm} />
}

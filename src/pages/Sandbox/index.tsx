import { SandboxPage } from "./SandboxPage"
import { useSandbox } from "./useSandbox"

export default function SandboxRoute() {
  const p = useSandbox()
  return <SandboxPage {...p} />
}

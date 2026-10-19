import { InterviewPage } from "./InterviewPage"
import { useInterview } from "./useInterview"

export default function InterviewRoute() {
  const vm = useInterview()
  return <InterviewPage {...vm} />
}

import { Route, Routes } from "react-router-dom"
import { ErrorBoundary } from "./components/ErrorBoundary"
import HomeRoute from "./pages/Home/index.tsx"
import LevelRoute from "./pages/Level/index.tsx"
import GlossaryRoute from "./pages/Glossary/index.tsx"
import DebugRoute from "./pages/Debug/index.tsx"
import InterviewRoute from "./pages/Interview/index.tsx"

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/level" element={<LevelRoute />} />
        <Route path="/glossary" element={<GlossaryRoute />} />
        <Route path="/debug" element={<DebugRoute />} />
        <Route path="/interview" element={<InterviewRoute />} />
        <Route path="*" element={<HomeRoute />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default App

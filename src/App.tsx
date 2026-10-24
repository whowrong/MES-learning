import { lazy, Suspense } from "react"
import { Route, Routes } from "react-router-dom"
import { ErrorBoundary } from "./components/ErrorBoundary"

const HomeRoute = lazy(() => import("./pages/Home/index.tsx"))
const LevelRoute = lazy(() => import("./pages/Level/index.tsx"))
const GlossaryRoute = lazy(() => import("./pages/Glossary/index.tsx"))
const DebugRoute = lazy(() => import("./pages/Debug/index.tsx"))
const InterviewRoute = lazy(() => import("./pages/Interview/index.tsx"))
const FactoryTypesRoute = lazy(() => import("./pages/FactoryTypes/index.tsx"))
const OpsTrainingRoute = lazy(() => import("./pages/OpsTraining/index.tsx"))
const DbTrainingRoute = lazy(() => import("./pages/DbTraining/index.tsx"))

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div role="status">正在加载页面…</div>}>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/level" element={<LevelRoute />} />
          <Route path="/glossary" element={<GlossaryRoute />} />
          <Route path="/debug" element={<DebugRoute />} />
          <Route path="/interview" element={<InterviewRoute />} />
          <Route path="/factory-types" element={<FactoryTypesRoute />} />
          <Route path="/ops-training" element={<OpsTrainingRoute />} />
          <Route path="/db-training" element={<DbTrainingRoute />} />
          <Route path="*" element={<HomeRoute />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App

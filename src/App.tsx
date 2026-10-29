import { lazy, Suspense } from "react"
import { Route, Routes } from "react-router-dom"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { MesAuthGate } from "./components/MesAuthGate"

const HomeRoute = lazy(() => import("./pages/Home/index.tsx"))
const LevelRoute = lazy(() => import("./pages/Level/index.tsx"))
const GlossaryRoute = lazy(() => import("./pages/Glossary/index.tsx"))
const DebugRoute = lazy(() => import("./pages/Debug/index.tsx"))
const InterviewRoute = lazy(() => import("./pages/Interview/index.tsx"))
const FactoryTypesRoute = lazy(() => import("./pages/FactoryTypes/index.tsx"))
const OpsTrainingRoute = lazy(() => import("./pages/OpsTraining/index.tsx"))
const DbTrainingRoute = lazy(() => import("./pages/DbTraining/index.tsx"))
const CareerPrepRoute = lazy(() => import("./pages/CareerPrep/index.tsx"))

function RouteLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid min-h-[50vh] place-items-center bg-gradient-to-br from-background via-secondary/40 to-card px-4"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/85 px-5 py-4 shadow-sm">
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary"
        />
        <span className="text-sm font-medium text-muted-foreground">正在加载页面…</span>
      </div>
    </div>
  )
}

function App() {
  const routes = (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/level" element={<LevelRoute />} />
        <Route path="/glossary" element={<GlossaryRoute />} />
        <Route path="/debug" element={<DebugRoute />} />
        <Route path="/interview" element={<InterviewRoute />} />
        <Route path="/factory-types" element={<FactoryTypesRoute />} />
        <Route path="/ops-training" element={<OpsTrainingRoute />} />
        <Route path="/db-training" element={<DbTrainingRoute />} />
        <Route path="/career-prep" element={<CareerPrepRoute />} />
        <Route path="*" element={<HomeRoute />} />
      </Routes>
    </Suspense>
  )
  const selfHostedAuth = import.meta.env.VITE_MES_SELF_HOSTED_AUTH === "true"
  return (
    <ErrorBoundary>
      {selfHostedAuth ? <MesAuthGate>{routes}</MesAuthGate> : routes}
    </ErrorBoundary>
  )
}

export default App

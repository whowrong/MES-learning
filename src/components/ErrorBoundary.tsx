import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertCircle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BUILD_VERSION } from "@/version"
import { initDebugLog, pushDebugEntry } from "@/lib/debugLog"

// 模块加载即挂全局错误监听（幂等）
initDebugLog()

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * 页面级错误捕获：任何渲染崩溃都兜住，显示可恢复的错误卡而不是黑屏。
 * 错误详情打控制台（componentStack 便于定位），界面只给产品话术 + 刷新按钮。
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const next: ErrorBoundaryState = { error }
    return next
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("页面渲染崩溃:", error, info.componentStack)
    pushDebugEntry({
      type: "react",
      message: error.message,
      stack: `${error.stack ?? ""}\n--- 组件栈 ---\n${info.componentStack ?? ""}`.slice(0, 4000),
    })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary/40 to-card px-6">
          <div className="max-w-md rounded-2xl bg-card p-8 text-center shadow-lg">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </span>
            <h1 className="mt-4 text-xl font-bold text-foreground">车间停电了</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              页面出了点意外，进度都存着，刷新一下就恢复。
              如果刷新后还这样，把下面这行字发给顾问：
            </p>
            <p className="mt-3 rounded-xl bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
              v{BUILD_VERSION} · {this.state.error.message.slice(0, 120)}
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="mt-5 rounded-full bg-primary px-8 text-primary-foreground hover:scale-105 focus-visible:shadow-[var(--focus-ring)]"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              刷新页面
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

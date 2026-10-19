import { useEffect, useState } from "react"

/**
 * 移动端检测（<1024px，对应 Tailwind lg 断点）。
 * jsdom / SSR 无 matchMedia 时安全返回 false（测试与首屏按桌面渲染）。
 */
export function useIsMobile(breakpoint = 1024): boolean {
  const read = (): boolean => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
    return window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches
  }
  const [isMobile, setIsMobile] = useState<boolean>(read)

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const onChange = () => setIsMobile(mq.matches)
    setIsMobile(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [breakpoint])

  return isMobile
}

type PreviewTheme = "dark" | "light"

const previewPalette = {
  dark: {
    background: "#08090a",
    foreground: "#f5f7f2",
    watermark: "rgba(245,247,242,0.34)",
  },
  light: {
    background: "#ffffff",
    foreground: "#17191d",
    watermark: "rgba(20,25,32,0.34)",
  },
} as const

function preferredPreviewTheme(): PreviewTheme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

// 新建 Web 项目的默认占位页(仅占位时跟随系统明暗主题 + 居中 vibex 落款)。
// 生成后的应用完全由自己的样式控制，不接收工作台颜色或主题。
// 只用内联样式: 此时 tailwind content 还没扫到任何页面, 类名不可靠。
function App() {
  const mono = "ui-monospace, SFMono-Regular, Menlo, monospace"
  const theme = preferredPreviewTheme()
  const palette = previewPalette[theme]

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        width: "100%",
        overflow: "hidden",
        background: palette.background,
        color: palette.foreground,
      }}
    >
      {/* 居中落款 vibex */}
      <footer
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 10,
          fontSize: 14,
          textTransform: "uppercase",
          opacity: 0,
          fontFamily: mono,
          letterSpacing: "0.6em",
          paddingLeft: "0.6em",
          color: palette.watermark,
          animation: "fade 1.6s ease-out 0.4s forwards",
        }}
      >
        vibex
      </footer>

      <style>{`
        @keyframes fade {
          to { opacity: 1; }
        }
      `}</style>
    </main>
  )
}

export default App

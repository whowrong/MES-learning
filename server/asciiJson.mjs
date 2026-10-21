// asciiJson.mjs — 服务端执行器输出序列化（dblab / sshlab 共用）
//
// 背景（v1.14.2 修复）：pb_hooks 里 $os.cmd(...).output() 返回字节数组，
// Goja 侧只能逐字节 String.fromCharCode 转字符串（等价 Latin-1 解码），
// UTF-8 多字节中文会变成 mojibake——导致 SQL 结果集里的中文与任务
// 期望值永远比对不上（如「Q235钢板」变乱码）。
// 解法：输出 JSON 前把所有非 ASCII 字符转义成 uXXXX 形式（前缀反斜杠），
// 字节流变纯 ASCII 后逐字节转换无损，前端/hook JSON.parse 自动还原。
const BS = String.fromCharCode(92) // 反斜杠（避免源码里出现转义序列）

function esc(code) {
  return BS + "u" + code.toString(16).padStart(4, "0")
}

export function asciiSafeJson(obj) {
  let r = ""
  for (const ch of JSON.stringify(obj)) {
    const c = ch.codePointAt(0)
    if (c < 128) {
      r += ch
    } else if (c <= 0xffff) {
      r += esc(c)
    } else {
      // 增补平面（emoji 等）：拆代理对分别转义，JSON.parse 会重组
      const hi = Math.floor((c - 0x10000) / 0x400) + 0xd800
      const lo = ((c - 0x10000) % 0x400) + 0xdc00
      r += esc(hi) + esc(lo)
    }
  }
  return r
}

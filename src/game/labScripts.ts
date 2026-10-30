// 实操营「AI 生成环境脚本」的纯逻辑：提示词拼装、模型输出解析、危险判定与步骤断言。
//
// 约束：
// - 只读题目文档与连接描述（主机/端口/库名/账号），绝不把口令或密钥写进提示词；
// - 模型必须返回结构化 JSON，解析失败要明确报错，不静默通过；
// - 步骤是否达标由 accept 正则判定，不采信模型自述的「已完成」；
// - 危险命令沿用站内既有拦截清单（GLOBAL_DANGER），不另起一套标准。
import { GLOBAL_DANGER } from "./opsTerminal"

/** 站内 AI 用的上游模型（与站内其它 AI 功能同一个通道） */
export const LAB_LLM_MODEL = "mimo-v2.6-pro"

/** 一次演练连接的描述：只含非敏感信息 */
export interface LabConnection {
  kind: "db" | "server"
  /** 数据库类型：mysql / postgres / sqlserver */
  type?: string
  host?: string
  port?: string | number
  database?: string
  username?: string
}

export interface LabStep {
  id: string
  title: string
  command: string
  /** 预期现象（人看） */
  expect: string
  /** 命中即通过的正则（沿用站内 accept 口径，机器判定） */
  assert: string[]
  danger?: boolean
  dangerNote?: string
}

export interface LabScript {
  env_check: string[]
  prep_steps: LabStep[]
  exec_steps: LabStep[]
  notes: string
}

export interface LabParseOk {
  ok: true
  script: LabScript
}

export interface LabParseFail {
  ok: false
  error: string
}

/** 拼装给模型的提示词：文档 + 连接描述 + 输出格式约束 */
export function buildLabScriptPrompt(opts: {
  title: string
  doc: string
  connection: LabConnection
}): string {
  const { title, doc, connection } = opts
  const connLines =
    connection.kind === "db"
      ? [
          `数据库类型：${connection.type || "未指定"}`,
          `主机：${connection.host || "未指定"}`,
          `端口：${connection.port || "默认"}`,
          `库名：${connection.database || "未指定"}`,
          `账号：${connection.username || "未指定"}`,
          "（口令不会、也不需要写进脚本：由用户在本地执行时自行提供）",
        ]
      : [
          `主机：${connection.host || "未指定"}`,
          `端口：${connection.port || "默认"}`,
          `账号：${connection.username || "未指定"}`,
          "（SSH 口令/私钥不会、也不需要写进脚本）",
        ]
  const kindWord = connection.kind === "db" ? "数据库" : "服务器"
  const kindRules =
    connection.kind === "db"
      ? [
          "6. 数据库题的 command 必须是**纯 SQL 语句**（一条一步，可直接交给数据库执行）：",
          "   不要写 mysql/psql 命令行，不要写 shell 管道，不要把 SQL 包在引号或 -e 参数里。",
          "7. 查询类题目只做只读查询：除非文档明确要求，不要 INSERT/UPDATE/DELETE/DROP/TRUNCATE 题目涉及的表。",
          "8. 需要多条 SQL 时按依赖顺序拆成多步，前一步的结果要在下一步里用得上。",
        ]
      : [
          "6. 服务器题的 command 必须是**单条 shell 命令**（可直接在 SSH 上执行），不要写交互式脚本块或多行 heredoc。",
          "7. 不要把口令、密钥、token 写进命令；需要凭据时用占位符并提示用户自行提供。",
          "8. 目标主机**已经通过 SSH 连好**，command 就是在那台主机上直接执行的 shell 命令：",
          "   不要再用 ssh / scp / rsync 之类远程执行包装，也不要重复写主机名与端口。",
          "9. 不要加 sudo 前缀（连接账号已具备演练所需权限）；题目没要求提权时一律用普通权限。",
        ]
  return [
    "你是 MES 实操营的演练环境助手。请依据下面这份题目文档，为用户在**演练专用**环境上生成可执行的环境准备脚本与执行脚本。",
    "",
    `## 题目`,
    title,
    "",
    `## 用户提供的${kindWord}连接`,
    ...connLines,
    "",
    "## 题目文档",
    doc,
    "",
    "## 输出要求",
    "只输出一个 JSON 对象，不要输出解释文字、不要用 Markdown 代码块包裹。结构如下：",
    JSON.stringify(
      {
        env_check: ["准备前要确认的只读检查（如确认版本/监听/连通性）"],
        prep_steps: [
          {
            id: "p1",
            title: "这一步做什么",
            command: "可直接执行的命令或 SQL",
            expect: "预期看到的现象",
            assert: ["命中即通过的正则，至少一条"],
            danger: false,
            dangerNote: "若该命令有破坏性，说明后果",
          },
        ],
        exec_steps: [
          {
            id: "e1",
            title: "正式执行的一步",
            command: "命令或 SQL",
            expect: "预期现象",
            assert: ["正则"],
            danger: false,
            dangerNote: "",
          },
        ],
        notes: "整体提醒（必读：这是演练环境，破坏性操作的后果是什么）",
      },
      null,
      1,
    ),
    "硬性约束：",
    "1. 每条命令都要能在上面的连接描述里落地；不要臆造不存在的路径、服务名或表名。",
    "2. 每一步都必须给出 assert 正则；没有正则的步骤视为不合格。",
    "3. 脚本里不得出现口令、密钥、token 等敏感信息；需要凭据时写成占位符并让用户自行提供。",
    "4. 删除、重建、清库、杀进程、改防火墙、重启服务等操作必须标 danger=true，并在 dangerNote 里写清后果。",
    "5. 顺序必须是：先只读检查（env_check），再准备（prep_steps），最后正式执行（exec_steps）。",
    ...kindRules,
  ].join("\n")
}

/** 从模型输出里抠出 JSON（容忍 ```json 包裹与前后废话） */
export function extractJsonBlock(text: string): string | null {
  const trimmed = (text ?? "").trim()
  if (!trimmed) return null
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fence ? fence[1] : trimmed
  const start = body.indexOf("{")
  const end = body.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return null
  return body.slice(start, end + 1)
}

function toSteps(raw: unknown): LabStep[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, idx) => {
      const o = (item ?? {}) as Record<string, unknown>
      const command = String(o.command ?? "").trim()
      const assertRaw = Array.isArray(o.assert) ? o.assert : []
      const assert = assertRaw.map((a) => String(a)).filter((a) => a.length > 0)
      return {
        id: String(o.id ?? `s${idx + 1}`),
        title: String(o.title ?? `步骤 ${idx + 1}`),
        command,
        expect: String(o.expect ?? ""),
        assert,
        danger: Boolean(o.danger),
        dangerNote: String(o.dangerNote ?? ""),
      } satisfies LabStep
    })
    .filter((s) => s.command.length > 0)
}

/** 解析模型输出：结构不合法就明确报错，不静默通过 */
export function parseLabScriptResponse(text: string): LabParseOk | LabParseFail {
  const json = extractJsonBlock(text)
  if (!json) {
    return { ok: false, error: "AI 返回的内容里找不到 JSON 脚本（可能被截断或夹带了解释文字），请重新生成或改用手工执行。" }
  }
  let obj: unknown
  try {
    obj = JSON.parse(json)
  } catch {
    return { ok: false, error: "AI 返回的 JSON 解析失败，脚本不可用，请重新生成或改用手工执行。" }
  }
  if (!obj || typeof obj !== "object") {
    return { ok: false, error: "AI 返回的结构不是对象，脚本不可用。" }
  }
  const o = obj as Record<string, unknown>
  const prep = toSteps(o.prep_steps)
  const exec = toSteps(o.exec_steps)
  if (prep.length === 0 && exec.length === 0) {
    return { ok: false, error: "AI 没有给出任何可执行步骤（prep_steps / exec_steps 都是空的）。" }
  }
  const noAssert = [...prep, ...exec].filter((s) => s.assert.length === 0)
  if (noAssert.length > 0) {
    return {
      ok: false,
      error: `AI 生成的 ${noAssert.length} 个步骤缺少验收正则（assert），无法机器判定，已丢弃本次结果。`,
    }
  }
  const envCheck = Array.isArray(o.env_check) ? o.env_check.map((x) => String(x)).filter((x) => x.length > 0) : []
  return {
    ok: true,
    script: {
      env_check: envCheck,
      prep_steps: prep,
      exec_steps: exec,
      notes: String(o.notes ?? ""),
    },
  }
}

/** 危险命令判定：沿用站内既有拦截清单 */
export function detectLabDanger(command: string): { danger: boolean; note: string } {
  const cmd = (command ?? "").trim()
  for (const rule of GLOBAL_DANGER) {
    try {
      if (new RegExp(rule.pattern).test(cmd)) {
        return { danger: true, note: rule.output }
      }
    } catch {
      // 正则本身坏了就跳过，不影响其它规则
    }
  }
  const destructive =
    /\b(rm\s+-rf|mkfs|dd\s+if=|:\(\)\{|shutdown|reboot|kill\s+-9|drop\s+(database|table)|truncate\s+table|delete\s+from|chmod\s+-R\s+777|iptables\b|firewall-cmd\b|systemctl\s+(stop|restart|disable))\b/i
  if (destructive.test(cmd)) {
    return {
      danger: true,
      note: "⚠️ 该命令可能造成不可逆破坏（删除/重建/清空/重启）。请确认目标确实是演练专用环境后再执行。",
    }
  }
  return { danger: false, note: "" }
}

/**
 * 去掉命令前面的包装（sudo / doas / env / timeout / nohup 等）。
 *
 * 题目里的 accept 正则大多从 ^ 锚定（例如 ^find\b.*-mtime），模型给出的命令
 * 常常带 sudo 前缀；不去掉包装就会把「命令是对的」判成不达标。
 */
export function stripCommandWrappers(command: string): string {
  let c = (command ?? "").trim()
  let prev = ""
  while (prev !== c) {
    prev = c
    c = c.replace(/^(?:sudo|doas|nohup|nice|ionice|command|time)(?:\s+-\S+)*\s+/, "")
    c = c.replace(/^env\s+(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/, "")
    c = c.replace(/^timeout\s+\d+(?:\s+[A-Za-z_][A-Za-z0-9_]*=\S*)*\s+/, "")
  }
  return c
}

/** 步骤断言：命中任一 accept 正即算通过 */
export function matchLabAssert(step: LabStep, output: string): boolean {
  const text = output ?? ""
  const candidates = text === stripCommandWrappers(text) ? [text] : [text, stripCommandWrappers(text)]
  return step.assert.some((pattern) => {
    try {
      const re = new RegExp(pattern, "m")
      return candidates.some((c) => re.test(c))
    } catch {
      return false
    }
  })
}

/** 生产环境迹象：主机名里带 prod / 生产 / 正式 / production */
export function looksLikeProduction(host: string): boolean {
  const h = (host ?? "").trim().toLowerCase()
  if (!h) return false
  return /(^|[^a-z])(prod|production)([^a-z]|$)/.test(h) || /生产|正式|线上/.test(h)
}

/**
 * 环境不符检测：题目文档点名要某个数据库引擎，而用户连的是另一种引擎时提前提示。
 * 只在文档明确点名引擎时判断，避免误报。
 */
export function environmentMismatch(doc: string, connection: LabConnection): string | null {
  if (connection.kind !== "db" || !connection.type) return null
  const text = (doc ?? "").toLowerCase()
  const wantsMysql = /mysql\s*8|mysql\s*\d/.test(text) && !/postgresql\s*\d|postgres\s*\d/.test(text.split("mysql")[0] ?? "")
  const wantsPostgres = /postgresql\s*\d|postgres\s*\d/.test(text)
  if (wantsMysql && connection.type === "postgres") {
    return "环境不符：题目文档按 MySQL 编写，而当前连接是 PostgreSQL。语法与函数并不通用，请确认这是同一个演练环境，或改用 MySQL 连接。"
  }
  if (wantsPostgres && connection.type === "mysql") {
    return "环境不符：题目文档按 PostgreSQL 编写，而当前连接是 MySQL。请确认这是同一个演练环境，或改用 PostgreSQL 连接。"
  }
  return null
}

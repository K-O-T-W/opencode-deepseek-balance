import { Plugin } from "@opencode/plugin/tui"
import { createSignal } from "solid-js"

type Balance = {
  available: boolean
  currency: string
  total: number
  granted: number
  toppedUp: number
  at: number
}

const REFRESH_MS = 60_000
const TIMEOUT_MS = 15_000

function money(currency: string, value: number): string {
  const symbol = currency === "CNY" ? "¥" : currency === "USD" ? "$" : `${currency} `
  return `${symbol}${value.toFixed(2)}`
}

export default Plugin.define({
  id: "deepseek.balance.tui",
  setup(context) {
    const [balance, setBalance] = createSignal<Balance | null>(null)
    const [error, setError] = createSignal<string | null>(null)
    const [loading, setLoading] = createSignal(true)
    let disposed = false
    let timer: ReturnType<typeof setInterval> | undefined
    let inFlight: Promise<void> | undefined

    const load = (): Promise<void> => {
      if (disposed) return Promise.resolve()
      if (inFlight) return inFlight
      inFlight = (async () => {
        try {
          const credentials = await context.client.credential.list()
          const deepseek =
            credentials.find((entry) => entry.integrationID === "deepseek" && entry.active) ??
            credentials.find((entry) => entry.integrationID === "deepseek")
          if (!deepseek || deepseek.value.type !== "key") {
            throw new Error("没有找到 DeepSeek API Key")
          }

          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
          let response: Response
          try {
            response = await fetch("https://api.deepseek.com/user/balance", {
              headers: {
                Authorization: `Bearer ${deepseek.value.key}`,
                Accept: "application/json",
              },
              signal: controller.signal,
            })
          } finally {
            clearTimeout(timeout)
          }
          if (!response.ok) throw new Error(`HTTP ${response.status}`)

          const json = (await response.json()) as {
            is_available?: boolean
            balance_infos?: Array<{
              currency: string
              total_balance: string
              granted_balance: string
              topped_up_balance: string
            }>
          }
          const info =
            json.balance_infos?.find((item) => item.currency === "CNY") ??
            json.balance_infos?.[0]
          if (!info) throw new Error("余额为空")

          setBalance({
            available: json.is_available !== false,
            currency: info.currency,
            total: Number(info.total_balance),
            granted: Number(info.granted_balance),
            toppedUp: Number(info.topped_up_balance),
            at: Date.now(),
          })
          setError(null)
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setLoading(false)
          inFlight = undefined
        }
      })()
      return inFlight
    }

    const label = () => {
      const current = balance()
      if (current) return `DeepSeek ${money(current.currency, current.total)}`
      if (error()) return "DeepSeek —"
      return "DeepSeek …"
    }

    const color = () => {
      const current = balance()
      if (!current) return context.theme.text.muted
      if (!current.available || current.total <= 0) return context.theme.text.feedback.error.base
      if (current.total < 20) return context.theme.text.feedback.warning.base
      return context.theme.text.feedback.success.base
    }

    const render = () => <text fg={color()}>{label()}</text>

    const offPrompt = context.ui.slot({ append: "prompt.footer.status", render })
    const offHome = context.ui.slot({ append: "home.footer.status", render })

    // 每轮对话结束后余额会变，立刻刷新一次；事件名不兼容时静默跳过。
    let offSucceeded = () => {}
    try {
      offSucceeded = context.data.on("session.execution.succeeded", () => {
        void load()
      })
    } catch {
      // 老版本 TUI 没有这个事件也不影响定时刷新
    }

    void load()
    timer = setInterval(() => void load(), REFRESH_MS)

    return () => {
      disposed = true
      if (timer) clearInterval(timer)
      offPrompt()
      offHome()
      offSucceeded()
    }
  },
})

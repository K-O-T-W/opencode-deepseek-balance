import { Plugin, Slot, Style } from "@opencode/plugin/gui"
import { Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"

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
  setup(ctx) {
    const [balance, setBalance] = createSignal<Balance | null>(null)
    const [error, setError] = createSignal<string | null>(null)
    let disposed = false
    let timer: ReturnType<typeof setInterval> | undefined
    let inFlight: Promise<void> | undefined

    const load = (): Promise<void> => {
      if (disposed) return Promise.resolve()
      if (inFlight) return inFlight
      inFlight = (async () => {
        try {
          const credentials = await ctx.client.credential.list()
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
          inFlight = undefined
        }
      })()
      return inFlight
    }

    // 当前会话选的模型是不是 DeepSeek 官方 provider（opencode 的免费模型不算）
    const isDeepSeek = () => ctx.screen.current()?.composer.model()?.providerID === "deepseek"

    // 余额文字做成 memo：slot 的 render 只跑一次，不能在里面直接 const 一个值
    const text = createMemo(() => {
      const current = balance()
      if (current) return money(current.currency, current.total)
      return error() ? "—" : "…"
    })

    // 只在 DeepSeek 官方模型下，把内置的 US$ 费用藏掉
    createEffect(() => {
      document.body.classList.toggle("oc-deepseek-usage", isDeepSeek())
    })
    onCleanup(() => document.body.classList.remove("oc-deepseek-usage"))

    ctx.add(
      Style,
      `
      body.oc-deepseek-usage button[aria-expanded]:has(> span > span[aria-hidden="true"]) span[aria-hidden="true"] + span {
        display: none !important;
      }
      `,
    )

    // 接在上下文圆环 + token 数量后面，顶掉原本的 · US$0.xx
    // 内置的「·」留着当分隔符（它左右本来就是 12/13px），这里只补余额；
    // 负左边距扣掉按钮右内边距 + 容器 8px 间距多出来的那 5px。
    ctx.add(Slot, {
      at: "session.header",
      order: 11,
      render: () => (
        <Show when={isDeepSeek()}>
          <span
            class="shrink-0 whitespace-nowrap"
            style={{ "margin-left": "-5px", color: "var(--v2-text-text-faint)" }}
          >
            {text()}
          </span>
        </Show>
      ),
    })

    void load()
    timer = setInterval(() => void load(), REFRESH_MS)

    return () => {
      disposed = true
      if (timer) clearInterval(timer)
    }
  },
})


import { Plugin } from "@opencode/plugin"

// The TUI part does the work. This side only makes OpenCode discover the
// package as a normal plugin (and loads ./tui beside it).
export default Plugin.define({
  id: "deepseek.balance.v2",
  setup() {},
})
// keep the package reloadable



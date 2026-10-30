# opencode-deepseek-balance

Show your **DeepSeek account balance** right where OpenCode shows the session cost — so you see
`¥339.50` instead of `US$0.36`.

```
Creator / some session                                    ◯ 7万 · ¥339.50
```

It replaces the built-in `· US$0.xx` in the session header, and only while the selected model is a
**DeepSeek official** model (`providerID === "deepseek"`). Pick any other provider and the normal
cost comes back untouched.

Works in **OpenCode Desktop 2.x** (GUI plugin API) and includes the **TUI** status item as well.

## Install

1. Clone it into your plugins folder:

   ```bash
   # Windows
   git clone https://github.com/K-O-T-W/opencode-deepseek-balance "%USERPROFILE%\.config\opencode\plugins\opencode-deepseek-balance"

   # macOS / Linux
   git clone https://github.com/K-O-T-W/opencode-deepseek-balance ~/.config/opencode/plugins/opencode-deepseek-balance
   ```

2. Add it to `~/.config/opencode/opencode.jsonc`:

   ```jsonc
   {
     "plugins": ["./plugins/opencode-deepseek-balance"]
   }
   ```

3. **Fully restart OpenCode** (quit the app, not just the window — the GUI bundle of a plugin is
   only read when it starts).

No configuration, no API key in a file: it reads the DeepSeek key you already signed in with
(Settings → Providers), calls `https://api.deepseek.com/user/balance`, and refreshes every 60 s.

## What it does

| | |
|---|---|
| Where | `session.header` slot, right after the context ring, order 11 |
| When visible | selected model's provider is `deepseek` |
| What it replaces | the built-in `· US$0.xx` span (hidden by a one-line CSS hook) |
| Refresh | every 60 s |
| On failure | shows `—` instead of a number |
| Network | only `api.deepseek.com` |

The TUI side (`./tui`) appends a status item to `prompt.footer.status` and `home.footer.status`,
colored green / yellow / red by remaining balance.

## Build from source

The compiled bundle is committed (`dist/gui-experimental.cjs`), so you only need this if you change
the code. Requires Node 18+.

```bash
npm install
npm run build     # -> dist/gui-experimental.cjs
```

`npm install` uses `legacy-peer-deps` (see `.npmrc`): `@opencode/plugin` declares `electron` and the
`@opentui/*` packages as peers, which are not needed just to produce the bundle.

## Notes

- Built against `@opencode/plugin` 2.2.2. The header cost is hidden with a CSS hook that targets
  `button[aria-expanded] span[aria-hidden="true"] + span`; if a future OpenCode version changes that
  markup, the balance still shows but the USD number may stay next to it. Fix the selector in
  `src/gui.tsx`.
- The plugin id is `deepseek.balance.v2`. Only one plugin may claim an id — if you have an older
  copy of this plugin installed, remove it.
- If your balance is in USD (DeepSeek returns whichever currencies your account has), the CNY entry
  is preferred and the first one is used otherwise.

## License

MIT.

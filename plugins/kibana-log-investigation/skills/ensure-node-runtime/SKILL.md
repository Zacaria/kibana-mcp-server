---
name: ensure-node-runtime
description: Ensure Node.js 22+ is available for this repo using a user-level install path on Windows, macOS, or Linux.
---

# Ensure Node Runtime

Use this skill when the repository has been cloned locally and Codex needs to make sure Node.js is available before building or running the Kibana MCP server.

This skill prefers user-level installation paths and avoids system-wide package installs.

## Goals

- detect whether `node` and `npm` are already usable
- install Node.js 22+ at user scope when missing
- choose commands based on the current operating system and shell
- verify the runtime before continuing with repo setup

## Detection

1. Check whether `node` and `npm` are already present:
   - `node --version`
   - `npm --version`
2. If `node` is present and major version is `22` or newer, stop here.
3. Otherwise install a user-level Node version manager, then install Node.js `22`.

## Preferred cross-platform strategy

Use `fnm` as the default version manager because it works on Windows, macOS, and Linux and supports shell auto-configuration.

The repo pins the desired major in `.node-version`, so after `fnm` is installed you can use either:

- `fnm install 22 && fnm default 22`
- or `fnm use --install-if-missing`

## Windows

Prefer a PowerShell-first install path.

Use `winget` when it is available. If it is blocked or unavailable, fall back to the official `fnm` release binary extracted into the user's home directory.

Reference basis:

- `fnm` officially documents Windows installation via `winget`
- `fnm` also supports installation from a release binary on Windows
- PowerShell profile setup is the standard way to enable `fnm` in Windows shells

### Recommended flow

1. If `fnm` already exists, skip to Node installation.
2. If `winget` is available:
   - `winget install Schniz.fnm`
3. If `winget` is not available or is blocked:
   - download the latest Windows `fnm` release binary from the official GitHub releases page
   - extract it into a user-level directory such as `%USERPROFILE%\\.local\\bin\\fnm` or `%USERPROFILE%\\.fnm\\bin`
   - add that directory to the user PATH in PowerShell
4. Configure the current PowerShell session:
   - `fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression`
5. Persist shell integration for future PowerShell sessions:
   - create `$PROFILE` if needed
   - append `fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression` to `$PROFILE` if it is not already present
6. Install and select Node.js 22:
   - `fnm install 22`
   - `fnm default 22`

## macOS

Prefer a user-level `fnm` install using the official install script.

### Recommended flow

1. If `fnm` is missing:
   - `curl -fsSL https://fnm.vercel.app/install | bash`
2. Configure the current shell:
   - bash/zsh: `eval "$(fnm env --use-on-cd)"`
   - fish: `fnm env --use-on-cd | source`
3. Persist shell integration:
   - bash: add `eval "$(fnm env --use-on-cd)"` to `~/.bashrc`
   - zsh: add `eval "$(fnm env --use-on-cd)"` to `~/.zshrc`
   - fish: add `fnm env --use-on-cd | source` to `~/.config/fish/config.fish`
4. Install and select Node.js 22:
   - `fnm install 22`
   - `fnm default 22`

## Linux

Use the same user-level `fnm` flow as macOS.

### Recommended flow

1. If `fnm` is missing:
   - `curl -fsSL https://fnm.vercel.app/install | bash`
2. Configure and persist shell integration for the active shell:
   - bash: `eval "$(fnm env --use-on-cd)"` plus `~/.bashrc`
   - zsh: `eval "$(fnm env --use-on-cd)"` plus `~/.zshrc`
   - fish: `fnm env --use-on-cd | source` plus `~/.config/fish/config.fish`
3. Install and select Node.js 22:
   - `fnm install 22`
   - `fnm default 22`

## Verification

After installation, verify all of:

- `fnm --version`
- `node --version`
- `npm --version`

The resulting `node --version` must report major `22` or higher.

## Notes

- Prefer user-level installs over admin installs.
- On Windows, prefer PowerShell-native flows and avoid assuming Scoop is available.
- If the current shell cannot pick up the new PATH cleanly, restart the terminal or restart Codex after installation.
- Once Node is available, continue with:
  - `npm install`
  - `npm run build`

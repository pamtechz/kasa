# KASA — Windows local development recovery

Updated: 16 October 2026. Applies to Next.js 15.5.x and Node.js 22.

## Why your build passed but `npm run dev` returned a 500
The successful `npm run build` output compiled the application, typechecked, and generated 51 static pages. The later local `ENOENT .next/routes-manifest.json` error is consistent with competing `next dev` processes or `next build` rewriting the *same* `.next` build directory. Your log specifically shows port 3000 held by PID 25828, followed by an additional server on port 3001.

KASA now uses the following separated directories:

| Command | Generated Next.js files |
|---|---|
| `npm run dev` (default port 3000) | `.next-dev-3000/` |
| `npm run dev -- --port 3001` | `.next-dev-3001/` |
| `npm run build` / `npm start` | `.next/` |

The development launcher **refuses an occupied port** instead of silently picking a new one. This prevents two unaware servers from sharing a manifest directory. The ports are development settings, not business logic or intake controls.

## Step 1 — Preserve local Git changes and switch to main

Open a new PowerShell console:

```powershell
cd C:\Users\user\Pictures\kasa
git status
git branch --show-current
git fetch origin
```

If `git status` lists edits you want to keep, commit them to your own branch first, or run `git stash push -u -m "KASA local work before updating main"`. That stash is recoverable using `git stash list` and `git stash pop`.

**Do not use `git switch --track origin/fix/bootstrap-setup-visibility-admin-content`.** This branch already exists locally. The previous `--track` command failed and therefore did not switch you away from the branch you were on.

```powershell
git switch main
git pull --ff-only origin main
git branch --show-current
git log -1 --oneline
```

If you see **diverging branches** after actually switching to `main`, stop and inspect:

```powershell
git status
git log --oneline --graph --decorate --max-count 16 main origin/main
git log --oneline --left-right main...origin/main
```

Do not `reset --hard`, `clean -fd`, `push --force`, or blindly rebase locally committed work. Decide whether to keep your local `main` commits on a new branch or merge them deliberately. Only `git pull --ff-only` once the ancestry is safe.

## Step 2 — Stop the old Next.js processes

If you still have a terminal running `npm run dev`, stop it with **Ctrl+C**. Check the reported PID before stopping anything:

```powershell
Get-CimInstance Win32_Process -Filter "ProcessId = 25828" |
  Select-Object ProcessId,Name,CommandLine

Get-NetTCPConnection -State Listen -LocalPort 3000,3001 -ErrorAction SilentlyContinue |
  Select-Object LocalPort,OwningProcess
```

Only if you verify that the PID belongs to your stale KASA Next.js server:

```powershell
Stop-Process -Id 25828
```

Avoid killing every Node process on the PC: unrelated projects, tools and runners may use Node.

## Step 3 — Clear only generated caches (while all KASA dev servers are stopped)

```powershell
if (Test-Path -LiteralPath ".next") {
  Remove-Item -LiteralPath ".next" -Recurse -Force
}
Get-ChildItem -Directory -Filter ".next-dev-*" | ForEach-Object {
  Remove-Item -LiteralPath $_.FullName -Recurse -Force
}
```

These directories are disposable Next.js output, not Firebase records or project source code. Do not remove `src`, `public`, `.env.local` or other application content.

## Step 4 — Run locally and verify

```powershell
node --version
npm install
npm run test:source
npm run typecheck
npm run build
npm run dev
```

Open **http://localhost:3000**. If a legitimate separate service owns port 3000, either stop it or explicitly choose another development port:

```powershell
npm run dev -- --port 3001
```

You may run `npm run build` independently from the newly launched `npm run dev`; they no longer share the same `.next` output directory. If a *legacy* Next.js process started before updating KASA is still running, stop it first because it may continue using the old shared directory.

## Dependencies and npm security warnings

Your log shows **19 reported vulnerabilities (9 moderate and 10 high)**, but it does not identify the affected packages or whether they are runtime or development-only. Do not assume npm's generic warning means the KASA code itself has 19 directly exploitable vulnerabilities.

Inspect first:

```powershell
npm audit --omit=dev
npm audit
npm outdated
```

Then resolve affected packages according to their advisory information, using compatible tested releases. **Do not blindly use `npm audit fix --force`.** Re-run typecheck, source tests, and production build after any dependency change.

EDURMS uses lockfile-validated, reproducible CI installs. KASA should also commit a reviewed `package-lock.json` and switch the self-hosted CI install step from `npm install` to `npm ci` when that canonical lockfile is added. Do not fabricate or hand-edit a lockfile without registry resolution.

## Vercel deployment

**Do not deploy to Vercel unless the owner explicitly requests it.** The KASA project's `vercel.json` disables automatic Git deployments. Local build success does not imply a production Firebase configuration or successful Firestore seeding.

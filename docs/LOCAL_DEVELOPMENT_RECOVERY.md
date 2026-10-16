# KASA — Windows local development recovery

Updated: 16 October 2026. Applies to Next.js 15.5.x and Node.js 22.

## Why your build passed but `npm run dev` returned a 500
The successful `npm run build` output compiled the application, typechecked, and generated 51 static pages. The later local `ENOENT .next/routes-manifest.json` error is consistent with competing `next dev` processes or `next build` rewriting the *same* `.next` build directory. Your log specifically shows port 3000 held by PID 25828, followed by an additional server on port 3001.

KASA now uses the following separated directories:

| Command | Generated Next.js files |
|---|---|
| `npm run dev` (default port 3000) | `.next-dev-3000/` |
| `npm run dev:3001` | `.next-dev-3001/` |
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
npm run doctor
npm install
npm run test:source
npm run typecheck
npm run build
npm run dev
```

Open **http://localhost:3000**. If a legitimate separate service owns port 3000, either stop it or explicitly choose another development port:

```powershell
npm run dev:3001
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

## Follow-up: October 16 — missing `./3897.js`, blocked Git pull and localhost port collisions

The new report confirms a successful Next.js 15.5.28 production build (51/51 pages), followed by a runtime stack from `.next/server/webpack-runtime.js` that could not load the generated `./3897.js` chunk. The output folder `.next` is disposable, and this is consistent with an incomplete or stale local compilation; it does not prove that `/api/setup/health` has broken Firebase code. Always stop existing KASA Node/Next processes before clearing output, then build/run again.

### Preserve tracked local changes and obtain the updated script

The failed `git pull --ff-only` specifically reported modified `.env.example` and `next-env.d.ts`. Since the pull aborted, the workstation still had the older `package.json`, explaining the missing `doctor:firebase` script.

Run the following in **PowerShell**, after confirming that `git status` lists the files you intend to preserve:

```powershell
cd C:\Users\user\Pictures\kasa
git status --short
git branch --show-current
git stash push -m "KASA tracked local changes before update" -- .env.example next-env.d.ts
git switch main
git fetch origin
git pull --ff-only origin main
npm run doctor
npm run doctor:firebase
```

**Do not immediately pop the stash.** Check `git stash list` later and reconcile any intentional `.env.example` edits separately. Firebase credentials belong in the ignored `.env.local` file, *not* in the tracked `.env.example` template. The Next.js-generated `next-env.d.ts` is not a place for custom modifications. Do not upload or paste environment secrets.

If Git still reports conflicts involving *other* files, do not force-reset; inspect `git status`. The stash does not destroy or overwrite your modifications.

### Stop stale port owners and clean only Next.js caches

Stop any KASA dev/build processes with Ctrl+C. Check the actual Windows port owners **before killing a process**:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3000,3001 -ErrorAction SilentlyContinue |
  Select-Object LocalPort,OwningProcess
# For the process ID seen above (example only):
Get-CimInstance Win32_Process -Filter "ProcessId = 25828" |
  Select-Object ProcessId,Name,CommandLine
```

Do **not** kill every Node process or the self-hosted GitHub runner. If PID 25828 is confirmed to be the stale KASA Next.js process, stop it via its console or `Stop-Process -Id 25828`; process IDs can change between sessions.

After **all KASA Next.js processes are stopped**:

```powershell
npm run clean:next
npm run clean:next:confirm
npm run test:source
npm run typecheck
npm run build
npm run dev
```

The first cleanup invocation displays which generated folders will be removed; the second requires `--yes` and removes only `.next/` and `.next-dev-<port>/` directories from a verified KASA folder. It leaves `.env.local`, `node_modules`, Firebase records and source files unchanged.

If port 3000 belongs to a needed service, run `npm run dev:3001`, where development assets use `.next-dev-3001`. The dev script now **preflights the same network interface it passes to Next.js**. Older launcher revisions preflighted IPv4 while Next.js could bind IPv6 (`::`), causing a false available-port result and `EADDRINUSE`.

### If module-not-found persists

1. Confirm the active Next.js process command line and ensure it was launched using the updated `npm run dev`; a **development** stack should reference `.next-dev-3000/` (or the selected development port), not `.next/server/`.
2. Confirm that no second `next build` / `next start` process shares production `.next/`.
3. Check file locking/antivirus if missing files recur **after a clean single-process build**, and provide the new error stack and `npm run doctor` output (not private environment values).
4. `npm run doctor:firebase` requires a local `.env.local`; it is present in `main` after the Git update. Run `git log -1 --oneline` to confirm a current commit.

**Deployment policy:** No KASA Vercel build/deployment may be triggered without the owner's explicit authorization. All commands here operate on the local Windows repository.

## 16 October 2026 — Windows npm forwarded a bare port and swallowed --yes

The user’s log shows `npm run dev -- --port 3001` invoking `node scripts/dev.mjs 3001`: npm forwarded only the numeric value, so older KASA parsed the default port 3000 again. It also shows `npm run clean:next -- --yes` invoking the cleaner **without** `--yes`, so the generated files were only listed and never removed.

KASA now accepts both forms:

```powershell
npm run dev:3001
# or: npm run dev -- 3001
# also handled: npm run dev -- --port 3001
```

For a cleanup that works even when npm drops user-supplied flags, **stop all KASA Next processes first**, then run:

```powershell
npm run clean:next
npm run clean:next:confirm
```

The first command previews the exact generated directories; the second uses a confirmation argument embedded in the npm script itself. It never removes `.env.local`, `node_modules`, Git data or Firebase records. Avoid force-killing unrelated Node processes or the self-hosted runner. A new behaviour test executes the cleanup in a temporary directory and checks that unrelated content is preserved.

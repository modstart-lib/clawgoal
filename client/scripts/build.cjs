#!/usr/bin/env node
/**
 * Electron client build script.
 *
 * Usage:
 *   node client/scripts/build.cjs [options] [binary-path]
 *
 * Options:
 *   --dir          Build unpacked app only (default)
 *   --full         Build and package in one step (installer/portable/dmg)
 *   --arch <arch>  Target architecture: x64 or arm64 (default: host arch)
 *   <binary-path>  Path to backend server binary
 *
 * Examples:
 *   node client/scripts/build.cjs                              # auto-detect + --dir
 *   node client/scripts/build.cjs --full                       # auto-detect + full build
 *   node client/scripts/build.cjs --full --arch arm64 ...      # cross-compile for arm64
 *   node client/scripts/build.cjs /path/to/clawgoal-linux-amd64  # specific binary
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const DIST_DIR = path.resolve(ROOT, '..', 'packages', 'backend', 'dist')

const BINARY_NAME = process.platform === 'win32' ? 'clawgoal.exe' : 'clawgoal'
const BACKEND_DIR = path.join(ROOT, 'backend')
const BACKEND_BIN = path.join(BACKEND_DIR, BINARY_NAME)

// ── Parse flags ────────────────────────────────────────────────────────────
const ARGS = process.argv.slice(2)
const BUILD_FULL = ARGS.includes('--full')
const ARCH_IDX = ARGS.indexOf('--arch')
const ARCH_ARG = ARCH_IDX !== -1 && ARCH_IDX + 1 < ARGS.length ? ARGS[ARCH_IDX + 1] : ''
const BINARY_ARG = ARGS.find(a => !a.startsWith('--'))

// ── Determine binary source ────────────────────────────────────────────────
function findBinarySource() {
  // 1) CLI argument takes precedence
  if (BINARY_ARG) {
    if (fs.existsSync(BINARY_ARG)) return BINARY_ARG
    console.error(`[build] Specified binary not found: ${BINARY_ARG}`)
    process.exit(1)
  }

  // 2) Try the default local build path
  const localBin = path.join(DIST_DIR, BINARY_NAME)
  if (fs.existsSync(localBin)) return localBin

  // 3) Find ANY executable binary in dist dir (works with any product name)
  const candidates = []
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64'
  const platform = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'win' : 'linux'

  if (fs.existsSync(DIST_DIR)) {
    const files = fs.readdirSync(DIST_DIR)
    for (const f of files) {
      const full = path.join(DIST_DIR, f)
      if (fs.statSync(full).isFile()) {
        // Check if executable (Unix: mode & 0o111, Windows: .exe extension)
        const isExe = process.platform === 'win32' ? f.endsWith('.exe') : (fs.statSync(full).mode & 0o111) !== 0
        if (isExe && !f.includes('.')) {
          candidates.push(full)
        }
      }
    }
  }

  // Pick the best match: prefer current platform+arch, then any match
  const best = candidates.find(f =>
    f.includes(`${platform}-${arch}`) || f.includes(`darwin-${arch}`) || f.includes(`linux-${arch}`)
  ) || candidates[0]

  if (best) return best

  console.error(`[build] No backend binary found in ${DIST_DIR}`)
  console.error(`[build] Run "pnpm --filter @clawgoal/backend build" first`)
  process.exit(1)
}

// ── Build steps ─────────────────────────────────────────────────────────────
function step(msg) {
  console.log('')
  console.log(`[build] ${msg}`)
}

try {
  // Step 1: Copy backend binary
  step('Copying backend binary...')
  const src = findBinarySource()
  fs.mkdirSync(BACKEND_DIR, { recursive: true })
  fs.copyFileSync(src, BACKEND_BIN)
  fs.chmodSync(BACKEND_BIN, 0o755)
  console.log(`  ${src} → ${BACKEND_BIN}`)

  // Step 2: npm install
  step('Installing dependencies...')
  execSync('npm install', { cwd: ROOT, stdio: 'inherit' })

  // Step 3: Build Electron app
  //   --dir  → unpacked only (for macOS codesign workflow)
  //   --full → one-step build to installer/portable/dmg (Linux/Windows)
  step(`Building Electron app (${BUILD_FULL ? 'full' : 'unpacked'})...`)
  const buildEnv = { ...process.env }
  if (process.env.NO_SIGN === '1') {
    buildEnv.CSC_IDENTITY_AUTO_DISCOVERY = 'false'
    console.log('[build] NO_SIGN=1 — skipping macOS code signing')
  }
  const version = process.env.VERSION || (() => {
    try { return JSON.parse(fs.readFileSync(path.resolve(ROOT, '..', 'package.json'), 'utf-8')).version }
    catch { return '' }
  })()
  const versionArgs = version ? ` --config.extraMetadata.version=${version}` : ''
  const configFile = 'electron-builder.json5'
  const modeFlag = BUILD_FULL ? '' : '--dir'
  const archFlag = ARCH_ARG ? ` --${ARCH_ARG}` : ''
  console.log(`[build] Target arch: ${ARCH_ARG || 'host (' + process.arch + ')'}`)
  execSync(`npx electron-builder --config ${configFile}${archFlag} ${modeFlag}${versionArgs}`, { cwd: ROOT, stdio: 'inherit', env: buildEnv })

  console.log('')
  console.log(`[build] ✅ Electron app built successfully`)
  console.log(`[build] Output: ${path.join(ROOT, 'build')}`)
} catch (err) {
  console.error(`[build] ❌ Build failed: ${err.message}`)
  process.exit(1)
}

/**
 * src/utils/process-utils.js
 *
 * Utility untuk spawn proses child dan resolve path binary.
 * Mendeteksi platform dan mengembalikan path binary yang tepat
 * (bundled di resources/bin/ atau didownload di ~/.testpilot/bin/).
 */
const { spawn, execFile } = require('child_process')
const path = require('path')
const fs   = require('fs')
const os   = require('os')
const logger = require('./logger')

// ── Binary paths ──────────────────────────────────────────────

const TESTPILOT_DIR = path.join(os.homedir(), '.testpilot')

/**
 * Dapatkan path ADB binary yang tepat.
 * Priority: bundled di resources/bin/ → ~/.testpilot/adb/
 */
function getAdbPath() {
  // Priority 0: sudah di-discover oleh device-manager.init()
  if (process.env._TESTPILOT_ADB_PATH) {
    return process.env._TESTPILOT_ADB_PATH
  }

  const platform = process.platform
  const adbName  = platform === 'win32' ? 'adb.exe' : 'adb'

  // 1. Bundled di app resources (production build)
  const resourcesPath = process.resourcesPath
    ? path.join(process.resourcesPath, 'bin', adbName)
    : null
  if (resourcesPath && fs.existsSync(resourcesPath)) return resourcesPath

  // 2. Downloaded by setup → ~/.testpilot/adb/adb
  const setupPath = path.join(TESTPILOT_DIR, 'adb', adbName)
  if (fs.existsSync(setupPath)) return setupPath

  // 3. Common macOS paths
  const home = os.homedir()
  const commonPaths = [
    `${home}/Library/Android/sdk/platform-tools/${adbName}`,
    `${home}/Android/Sdk/platform-tools/${adbName}`,
    '/usr/local/bin/adb',
    '/opt/homebrew/bin/adb',
  ]
  if (process.env.ANDROID_HOME) {
    commonPaths.unshift(path.join(process.env.ANDROID_HOME, 'platform-tools', adbName))
  }
  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p
  }

  // 4. Fallback: system PATH
  return adbName
}

/**
 * Dapatkan path Maestro CLI.
 * Maestro zip mengekstrak ke subfolder: ~/.testpilot/bin/maestro/bin/maestro
 * Kita cek beberapa kemungkinan path.
 */
function getMaestroPath() {
  const binName = process.platform === 'win32' ? 'maestro.bat' : 'maestro'
  // Kemungkinan path setelah extract:
  // 1. ~/.testpilot/bin/maestro           (ideal, setelah rename)
  // 2. ~/.testpilot/bin/maestro/bin/maestro (zip subfolder default)
  const candidates = [
    path.join(TESTPILOT_DIR, 'bin', binName),
    path.join(TESTPILOT_DIR, 'bin', 'maestro', 'bin', binName),
    path.join(TESTPILOT_DIR, 'maestro', 'bin', binName),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  // Return path default meskipun belum ada (untuk display di UI)
  return path.join(TESTPILOT_DIR, 'bin', binName)
}

/**
 * Cek apakah sebuah binary tersedia dan bisa dieksekusi.
 * Handles:
 * - Absolute path: cek fs.existsSync dulu
 * - Command name only (misal "adb"): langsung exec, skip existsSync
 */
function isBinaryAvailable(binaryPath) {
  return new Promise(resolve => {
    const isAbsolute = path.isAbsolute(binaryPath)

    // Kalau absolute path, cek dulu ada tidaknya file
    if (isAbsolute && !fs.existsSync(binaryPath)) {
      resolve(false)
      return
    }

    // Exec dengan 'version' untuk Maestro, '-version' untuk java, 'version' untuk adb
    // Pakai shell:true agar PATH diteruskan dengan benar di semua OS
    const { exec } = require('child_process')
    // `which` di Unix / `where` di Windows — paling reliable untuk cek existence
    const checkCmd = process.platform === 'win32'
      ? `where "${binaryPath}" > nul 2>&1`
      : `command -v "${binaryPath}" > /dev/null 2>&1 || type "${binaryPath}" > /dev/null 2>&1`

    if (!isAbsolute) {
      // Untuk non-absolute: cek via shell PATH
      exec(checkCmd, { timeout: 3000 }, (err) => {
        if (!err) { resolve(true); return }
        // Fallback: coba exec langsung
        execFile(binaryPath, ['version'], { timeout: 4000 }, (err2) => {
          const notFound = !err2 || err2.code !== 'ENOENT'
          resolve(notFound && err2?.code !== 'ENOENT')
        })
      })
      return
    }

    // Absolute path yang ada: coba jalankan
    execFile(binaryPath, [], { timeout: 5000 }, (err) => {
      if (!err) { resolve(true); return }
      // Binary ada tapi exit non-zero = binary ada (Maestro exit 1 tanpa args)
      const notFound = err.code === 'ENOENT' || err.code === 'EACCES'
      resolve(!notFound)
    })
  })
}

// ── Spawn helpers ─────────────────────────────────────────────

/**
 * Spawn process dan return Promise {stdout, stderr, exitCode}
 * Untuk one-shot command (bukan streaming)
 */
function spawnAsync(cmd, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    logger.debug(`spawn: ${cmd} ${args.join(' ')}`)
    const proc = spawn(cmd, args, {
      ...options,
      env: { ...process.env, ...options.env }
    })

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', d => { stdout += d.toString() })
    proc.stderr?.on('data', d => { stderr += d.toString() })

    proc.on('close', exitCode => {
      logger.debug(`spawn exit ${exitCode}: ${cmd}`)
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode })
    })

    proc.on('error', err => {
      logger.error(`spawn error: ${cmd}`, { error: err.message })
      reject(err)
    })

    // Timeout
    if (options.timeout) {
      setTimeout(() => {
        proc.kill()
        reject(new Error(`Process timeout after ${options.timeout}ms: ${cmd}`))
      }, options.timeout)
    }
  })
}

/**
 * ADB wrapper — jalankan satu command ADB
 */
async function adb(args = [], options = {}) {
  const adbPath = getAdbPath()
  return spawnAsync(adbPath, args, { timeout: 10000, ...options })
}

/**
 * ADB dengan target serial tertentu
 */
async function adbDevice(serial, args = [], options = {}) {
  return adb(['-s', serial, ...args], options)
}

module.exports = {
  getAdbPath,
  getMaestroPath,
  isBinaryAvailable,
  spawnAsync,
  adb,
  adbDevice,
  TESTPILOT_DIR,
}
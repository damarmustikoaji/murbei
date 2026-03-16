/**
 * main.js — Electron Entry Point
 * Enhanced dengan powerMonitor untuk handle sleep/wake gracefully
 * supaya tidak trigger remoted WATCHDOG crash di macOS.
 */
const { app, powerMonitor } = require('electron')

// ── Logger: harus paling pertama ──────────────────────────────
const logger = require('./src/utils/logger')

// ── Global error guards ───────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error('[UNCAUGHT EXCEPTION]', { message: err.message, stack: err.stack })
})
process.on('unhandledRejection', (reason) => {
  logger.error('[UNHANDLED REJECTION]', { reason: String(reason) })
})

// ── Sleep/Wake state ──────────────────────────────────────────
let isSuspended = false

/**
 * Suspend handler — dipanggil SEBELUM sistem sleep.
 * Cleanup semua resource yang bisa "menggantung" saat sleep:
 * - ADB polling (buka koneksi terus-menerus)
 * - Maestro runner jika sedang aktif
 */
async function onSuspend() {
  if (isSuspended) return
  isSuspended = true
  logger.info('[PowerMonitor] System suspending — stopping resources...')

  try {
    // 1. Stop ADB polling (cegah open socket saat sleep)
    const deviceManager = require('./src/core/device-manager')
    deviceManager.stopPolling()
    logger.info('[PowerMonitor] ADB polling stopped')
  } catch (err) {
    logger.warn('[PowerMonitor] Failed to stop device polling:', { error: err.message })
  }

  try {
    // 2. Abort runner jika sedang jalan (jangan biarkan proses Maestro zombie)
    const runner = require('./src/core/test-runner')
    if (runner.isRunning()) {
      logger.warn('[PowerMonitor] Test runner masih aktif saat suspend — force stop')
      await runner.stop()
    }
  } catch (err) {
    logger.warn('[PowerMonitor] Failed to stop runner:', { error: err.message })
  }

  logger.info('[PowerMonitor] Suspend cleanup done')
}

/**
 * Resume handler — dipanggil SETELAH sistem wake dari sleep.
 * Re-init resource dengan delay untuk beri waktu macOS
 * menyelesaikan network stack recovery (mencegah remoted timeout).
 */
async function onResume() {
  if (!isSuspended) return
  isSuspended = false
  logger.info('[PowerMonitor] System resumed — reinitializing...')

  // Delay sebelum reinit: beri waktu network stack macOS fully ready.
  // Ini yang mencegah remoted WATCHDOG crash (butuh ~2-3 detik).
  const RESUME_DELAY_MS = 3000
  await new Promise(resolve => setTimeout(resolve, RESUME_DELAY_MS))

  try {
    // Re-init ADB: restart server dulu (bisa stale setelah sleep)
    const { adb } = require('./src/utils/process-utils')
    await adb(['kill-server']).catch(() => {}) // ignore error jika sudah mati
    await adb(['start-server']).catch(e =>
      logger.warn('[PowerMonitor] adb start-server after resume:', { error: e.message })
    )
    logger.info('[PowerMonitor] ADB server restarted')
  } catch (err) {
    logger.warn('[PowerMonitor] ADB restart failed:', { error: err.message })
  }

  try {
    // Restart device polling
    const deviceManager = require('./src/core/device-manager')
    await deviceManager.init()
    logger.info('[PowerMonitor] Device polling restarted')
  } catch (err) {
    logger.warn('[PowerMonitor] Failed to restart device polling:', { error: err.message })
  }

  // Notify renderer bahwa app resumed (opsional: UI bisa refresh state)
  try {
    const { getMainWindow } = require('./src/main/app')
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('app:resumed')
      logger.info('[PowerMonitor] Sent app:resumed to renderer')
    }
  } catch (err) {
    logger.warn('[PowerMonitor] Failed to notify renderer:', { error: err.message })
  }

  logger.info('[PowerMonitor] Resume reinitialization complete')
}

// ── Bootstrap ─────────────────────────────────────────────────
app.whenReady()
  .then(async () => {
    // Register powerMonitor SETELAH app ready (requirement Electron)
    powerMonitor.on('suspend', () => {
      onSuspend().catch(err =>
        logger.error('[PowerMonitor] onSuspend error:', { error: err.message })
      )
    })

    powerMonitor.on('resume', () => {
      onResume().catch(err =>
        logger.error('[PowerMonitor] onResume error:', { error: err.message })
      )
    })

    // Lock screen = treat seperti suspend (display off bisa trigger hal sama)
    powerMonitor.on('lock-screen', () => {
      logger.info('[PowerMonitor] Screen locked')
      onSuspend().catch(() => {})
    })

    powerMonitor.on('unlock-screen', () => {
      logger.info('[PowerMonitor] Screen unlocked')
      onResume().catch(() => {})
    })

    logger.info('[PowerMonitor] Listeners registered')

    return require('./src/main/app').createApp()
  })
  .catch(err => {
    logger.error('Failed to start app:', err)
    app.quit()
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
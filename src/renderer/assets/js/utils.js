/* utils.js — shared renderer utilities */
;(function() {
  'use strict'

  // ── Toast ──────────────────────────────────────────────────
  window.toast = function(msg, type = 'default', duration = 2800) {
    const wrap = document.getElementById('toasts')
    if (!wrap) return
    const t = document.createElement('div')
    t.className = 'toast'
    if (type === 'error') t.style.background = '#b91c1c'
    if (type === 'success') t.style.background = '#166534'
    t.textContent = msg
    wrap.appendChild(t)
    setTimeout(() => {
      t.style.opacity = '0'
      t.style.transition = 'opacity .2s'
    }, duration - 200)
    setTimeout(() => t.remove(), duration)
  }

  // ── Modal ──────────────────────────────────────────────────
  window.openModal  = (id) => document.getElementById(id)?.classList.add('open')
  window.closeModal = (id) => document.getElementById(id)?.classList.remove('open')

  // ── HTML escape ────────────────────────────────────────────
  window.esc = function(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  // ── Generate ID ────────────────────────────────────────────
  window.genId = function(prefix = '') {
    return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  }

  // ── DSL Generator ──────────────────────────────────────────
  /**
   * Generate Maestro YAML yang valid
   * Format resmi: https://docs.maestro.dev
   *
   * appId: com.example.app
   * ---
   * - tapOn:
   *     id: "resource_id"
   * - inputText: "hello"
   */
  window.generateDSL = function(meta, steps) {
    const appId = meta.package || meta.appId || 'com.example.app'
    const lines = []

    // Header — appId wajib ada
    lines.push(`appId: ${appId}`)
    if (meta.name) lines.push(`# ${meta.name}`)
    lines.push('---')

    // Convert setiap step ke Maestro command
    steps.forEach((step) => {
      const p     = step.params || {}
      const sel   = p.selector || ''
      const value = p.value    || ''

      // Parse selector: "id/com.pkg:id/view_id" atau "text/Hello" atau "acc/description"
      const selectorObj = _parseSelectorToMaestro(sel)

      switch (step.action) {
        case 'launch':
          lines.push(`- launchApp:`)
          lines.push(`    appId: "${p.package || appId}"`)
          break

        case 'tap':
          if (selectorObj.type === 'id') {
            lines.push(`- tapOn:`)
            lines.push(`    id: "${selectorObj.value}"`)
          } else if (selectorObj.type === 'text') {
            lines.push(`- tapOn: "${selectorObj.value}"`)
          } else if (selectorObj.type === 'acc') {
            lines.push(`- tapOn:`)
            lines.push(`    accessibilityLabel: "${selectorObj.value}"`)
          } else {
            lines.push(`- tapOn: "${sel}"`)
          }
          break

        case 'longPress':
          if (selectorObj.type === 'id') {
            lines.push(`- longPressOn:`)
            lines.push(`    id: "${selectorObj.value}"`)
          } else {
            lines.push(`- longPressOn: "${sel}"`)
          }
          break

        case 'input':
          // inputText harus didahului tapOn untuk fokus field dulu
          if (sel) {
            if (selectorObj.type === 'id') {
              lines.push(`- tapOn:`)
              lines.push(`    id: "${selectorObj.value}"`)
            } else {
              lines.push(`- tapOn: "${sel}"`)
            }
          }
          lines.push(`- inputText: "${value}"`)
          break

        case 'clearText':
          if (selectorObj.type === 'id') {
            lines.push(`- tapOn:`)
            lines.push(`    id: "${selectorObj.value}"`)
          } else if (sel) {
            lines.push(`- tapOn: "${sel}"`)
          }
          lines.push(`- clearText`)
          break

        case 'swipe':
          lines.push(`- swipe:`)
          lines.push(`    direction: ${p.direction || 'UP'}`)
          break

        case 'scroll':
          lines.push(`- scroll`)
          break

        case 'assertText':
          lines.push(`- assertVisible: "${p.expected || value}"`)
          break

        case 'assertVisible':
          if (selectorObj.type === 'id') {
            lines.push(`- assertVisible:`)
            lines.push(`    id: "${selectorObj.value}"`)
          } else {
            lines.push(`- assertVisible: "${sel}"`)
          }
          break

        case 'assertNotVisible':
          if (selectorObj.type === 'id') {
            lines.push(`- assertNotVisible:`)
            lines.push(`    id: "${selectorObj.value}"`)
          } else {
            lines.push(`- assertNotVisible: "${sel}"`)
          }
          break

        case 'wait':
          lines.push(`- waitForAnimationToEnd:`)
          lines.push(`    timeout: ${p.ms || 1000}`)
          break

        case 'back':
          lines.push(`- pressKey: Back`)
          break

        case 'screenshot':
          lines.push(`- takeScreenshot: "${p.name || 'screenshot'}"`)
          break

        default:
          lines.push(`# unknown action: ${step.action}`)
      }
    })

    return lines.join('\n')
  }

  /**
   * Parse selector string ke object Maestro
   * Input: "id/com.pkg:id/view_name" atau "text/Hello" atau "acc/description"
   */
  function _parseSelectorToMaestro(selector) {
    if (!selector) return { type: 'raw', value: selector }

    if (selector.startsWith('id/')) {
      // "id/com.socialnmobile.dictapps.notepad.color.note:id/page_more"
      // Maestro butuh hanya bagian setelah ":id/" atau full string
      const raw = selector.replace('id/', '')
      // Ambil bagian terakhir setelah ':id/'
      const parts = raw.split(':id/')
      const shortId = parts.length > 1 ? parts[parts.length - 1] : raw
      return { type: 'id', value: shortId, full: raw }
    }
    if (selector.startsWith('text/')) {
      return { type: 'text', value: selector.replace('text/', '') }
    }
    if (selector.startsWith('acc/')) {
      return { type: 'acc', value: selector.replace('acc/', '') }
    }
    if (selector.startsWith('xpath/')) {
      return { type: 'xpath', value: selector.replace('xpath/', '') }
    }
    return { type: 'raw', value: selector }
  }

  // ── Colorize DSL for display ───────────────────────────────
  window.colorizeDSL = function(dsl) {
    return dsl.split('\n').map(line => {
      if (line.trim().startsWith('#'))
        return `<span class="dc">${esc(line)}</span>`
      const m = line.match(/^(\s*)([\w_]+)(:\s*)(.*)$/)
      if (m)
        return `${esc(m[1])}<span class="dk">${esc(m[2])}</span>${esc(m[3])}<span class="dv">${esc(m[4])}</span>`
      return esc(line)
    }).join('\n')
  }

  // ── Format timestamp ───────────────────────────────────────
  window.fmtTime = function() {
    return new Date().toTimeString().slice(0, 8)
  }

  // ── Debounce ───────────────────────────────────────────────
  window.debounce = function(fn, ms) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms) }
  }

  // ── Handle IPC error response ──────────────────────────────
  window.isIpcError = function(result) {
    return result && result.__error === true
  }

  // ── Copy to clipboard ──────────────────────────────────────
  window.copyText = function(text) {
    navigator.clipboard?.writeText(text).then(() => toast('📋 Berhasil dicopy!'))
  }

  console.log('[utils] loaded')
})()
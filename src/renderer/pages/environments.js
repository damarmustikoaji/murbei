/* pages/environments.js */
window.PageEnvironments = (() => {
  'use strict'
  let _activeEnvId = null

  async function render() {
    const content = document.getElementById('content-area')
    const ta      = document.getElementById('topbar-actions')
    ta.innerHTML  = `
      <button class="btn btn-p btn-sm" onclick="PageEnvironments.showNewEnvModal()">
        <i class="bi bi-plus-lg"></i> Environment Baru
      </button>`

    const envs   = await window.api.db.getEnvs().catch(() => [])
    const active = _activeEnvId
      ? envs.find(e => e.id === _activeEnvId)
      : envs.find(e => e.is_active) || envs[0] || null
    if (active && !_activeEnvId) _activeEnvId = active.id

    content.innerHTML = `
    <div style="display:flex;height:100%;overflow:hidden">

      <!-- Kiri: daftar environment -->
      <div style="width:240px;flex-shrink:0;border-right:1px solid var(--border);
        display:flex;flex-direction:column;background:var(--surface)">
        <div style="padding:10px 12px;border-bottom:1px solid var(--border);background:var(--surface2)">
          <div style="font-size:10px;font-weight:700;color:var(--text3);
            text-transform:uppercase;letter-spacing:.4px">Daftar Environment</div>
        </div>
        <div style="flex:1;overflow-y:auto">
          ${envs.length ? envs.map(env => `
            <div onclick="PageEnvironments.selectEnv('${esc(env.id)}')"
              style="padding:11px 13px;border-bottom:1px solid var(--border);cursor:pointer;
                background:${env.id===_activeEnvId?'var(--blue-bg)':'transparent'};
                border-left:3px solid ${env.id===_activeEnvId?'var(--blue)':'transparent'};
                transition:background .1s">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
                <div style="font-size:12px;font-weight:600;
                  color:${env.id===_activeEnvId?'var(--blue)':'var(--text)'}">
                  ${esc(env.name)}
                </div>
                ${env.is_active
                  ? '<span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;background:#dcfce7;color:#16a34a">● Aktif</span>'
                  : ''}
              </div>
              ${env.base_url ? `<div style="font-size:10px;color:var(--text3);font-family:var(--font-mono);
                overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(env.base_url)}</div>` : ''}
              <div style="font-size:10px;color:var(--text3);margin-top:2px">
                ${Object.keys(env.vars||{}).length} variabel
              </div>
            </div>`).join('') : `
            <div style="text-align:center;padding:32px 16px;color:var(--text3)">
              <i class="bi bi-braces" style="font-size:1.5rem;display:block;margin-bottom:8px;opacity:.4"></i>
              <div style="font-size:11px">Belum ada environment</div>
            </div>`}
        </div>
      </div>

      <!-- Kanan: detail + variabel -->
      <div style="flex:1;overflow-y:auto">
        ${active ? `
        <div style="max-width:680px;padding:20px">

          <!-- Header env -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
            <div>
              <div style="font-size:16px;font-weight:700;margin-bottom:2px">${esc(active.name)}</div>
              ${active.base_url ? `<div style="font-size:11px;color:var(--text3);font-family:var(--font-mono)">${esc(active.base_url)}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px">
              ${!active.is_active ? `
              <button class="btn btn-d btn-sm" onclick="PageEnvironments.activate('${esc(active.id)}')">
                <i class="bi bi-check2-circle"></i> Jadikan Aktif
              </button>` : `
              <span style="font-size:11px;color:#16a34a;font-weight:600;
                padding:4px 10px;border-radius:6px;background:#dcfce7">
                <i class="bi bi-check-circle-fill"></i> Aktif
              </span>`}
              <button class="btn btn-d btn-sm" onclick="PageEnvironments.showEditEnvModal('${esc(active.id)}')">
                <i class="bi bi-pencil"></i> Edit
              </button>
              <button class="btn btn-d btn-sm" style="color:var(--red)"
                onclick="PageEnvironments.deleteEnv('${esc(active.id)}')">
                <i class="bi bi-trash3"></i>
              </button>
            </div>
          </div>

          <!-- Variabel table -->
          <div style="margin-bottom:16px">
            <div style="font-size:11px;font-weight:700;color:var(--text2);margin-bottom:8px;
              display:flex;align-items:center;justify-content:space-between">
              <span>Variabel (${Object.keys(active.vars||{}).length})</span>
              <span style="font-size:10px;color:var(--text3);font-weight:400">
                Gunakan <code style="font-family:var(--font-mono);font-size:10px;
                  background:var(--surface2);padding:1px 5px;border-radius:3px">{{KEY}}</code>
                di test steps
              </span>
            </div>

            <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
              <!-- Header -->
              <div style="display:grid;grid-template-columns:160px 1fr 80px;padding:6px 12px;
                background:var(--surface2);border-bottom:1px solid var(--border)">
                <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.4px">Key</div>
                <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.4px">Value</div>
                <div></div>
              </div>

              <!-- Rows -->
              ${Object.entries(active.vars||{}).map(([k, v]) => `
              <div style="display:grid;grid-template-columns:160px 1fr 80px;gap:8px;
                padding:7px 12px;border-bottom:1px solid var(--border);align-items:center">
                <div style="font-family:var(--font-mono);font-size:11px;font-weight:600;
                  color:var(--blue);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                  {{${esc(k)}}}
                </div>
                <input type="text" value="${esc(v)}"
                  data-key="${esc(k)}" data-envid="${esc(active.id)}"
                  style="font-size:11px;font-family:var(--font-mono);width:100%;
                    background:var(--surface2);border:1px solid transparent;border-radius:4px;
                    padding:3px 7px;outline:none;transition:border .15s"
                  onfocus="this.style.borderColor='var(--blue)'"
                  onblur="this.style.borderColor='transparent';PageEnvironments.updateVar('${esc(active.id)}','${esc(k)}',this.value)"
                  onkeydown="if(event.key==='Enter'){this.blur()}">
                <div style="display:flex;gap:4px;justify-content:flex-end">
                  <button class="btn btn-xs btn-d"
                    onclick="PageEnvironments.renameKey('${esc(active.id)}','${esc(k)}')"
                    title="Rename key"><i class="bi bi-tag"></i></button>
                  <button class="btn btn-xs btn-d" style="color:var(--red)"
                    onclick="PageEnvironments.deleteVar('${esc(active.id)}','${esc(k)}')"
                    title="Hapus variabel"><i class="bi bi-trash3"></i></button>
                </div>
              </div>`).join('') || `
              <div style="padding:16px;text-align:center;color:var(--text3);font-size:11px">
                Belum ada variabel. Tambahkan di bawah.
              </div>`}

              <!-- Add row -->
              <div style="padding:8px 12px;background:var(--surface2)">
                <button class="btn btn-d btn-sm w100"
                  onclick="PageEnvironments.showAddVarModal('${esc(active.id)}')"
                  style="border:1px dashed var(--border2)">
                  <i class="bi bi-plus-lg"></i> Tambah Variabel
                </button>
              </div>
            </div>
          </div>

          <!-- Info penggunaan -->
          <div style="background:var(--blue-bg);border:1px solid rgba(59,126,237,.2);
            border-radius:8px;padding:12px 14px">
            <div style="font-size:11px;font-weight:600;color:var(--blue);margin-bottom:6px">
              <i class="bi bi-info-circle"></i> Cara Penggunaan
            </div>
            <div style="font-size:11px;color:var(--text2);line-height:1.6">
              Variabel bisa dipakai di <b>Test Steps</b> dengan format
              <code style="font-family:var(--font-mono);font-size:10px;background:rgba(59,126,237,.1);
                padding:1px 5px;border-radius:3px">{{KEY}}</code>.<br>
              Contoh: kalau ada variabel <code style="font-family:var(--font-mono);font-size:10px;
                background:rgba(59,126,237,.1);padding:1px 5px;border-radius:3px">EMAIL</code>
              → gunakan
              <code style="font-family:var(--font-mono);font-size:10px;background:rgba(59,126,237,.1);
                padding:1px 5px;border-radius:3px">{{EMAIL}}</code>
              di selector atau input value.
            </div>
            <div style="margin-top:8px;font-size:10px;color:var(--text3)">
              Environment aktif saat ini: <b>${esc(active.name)}</b>
              — otomatis dipakai saat Test Run.
            </div>
          </div>

        </div>` : `
        <div style="text-align:center;padding:60px 20px;color:var(--text3)">
          <i class="bi bi-braces" style="font-size:2.5rem;display:block;margin-bottom:12px;opacity:.3"></i>
          <div style="font-size:14px;font-weight:600;margin-bottom:6px">Pilih environment</div>
          <div style="font-size:12px;margin-bottom:20px">atau buat environment baru</div>
          <button class="btn btn-p" onclick="PageEnvironments.showNewEnvModal()">
            <i class="bi bi-plus-lg"></i> Environment Baru
          </button>
        </div>`}
      </div>
    </div>`
  }

  // ── Modals ─────────────────────────────────────────────────
  function _modal(id, title, bodyHtml, onConfirm) {
    document.getElementById(id)?.remove()
    const m = document.createElement('div')
    m.id = id
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2000;display:flex;align-items:center;justify-content:center'
    m.innerHTML = `
      <div style="background:var(--surface);border-radius:12px;padding:22px;width:420px;
        max-width:92vw;box-shadow:var(--sh3);border:1px solid var(--border)">
        <div style="font-size:14px;font-weight:700;margin-bottom:16px">${title}</div>
        ${bodyHtml}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px">
          <button class="btn btn-d btn-sm" onclick="document.getElementById('${id}').remove()">Batal</button>
          <button class="btn btn-p btn-sm" id="${id}-confirm">${onConfirm}</button>
        </div>
      </div>`
    document.body.appendChild(m)
    m.addEventListener('keydown', e => { if(e.key==='Escape') m.remove() })
  }

  function showNewEnvModal() {
    _modal('env-modal', '+ Environment Baru', `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px">Nama *</label>
          <input type="text" id="env-modal-name" placeholder="Contoh: Staging, Production, UAT"
            style="width:100%;font-size:12px" autofocus>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px">Base URL</label>
          <input type="text" id="env-modal-url" placeholder="https://staging.example.com"
            style="width:100%;font-size:12px;font-family:var(--font-mono)">
        </div>
      </div>`, 'Buat Environment')
    document.getElementById('env-modal-confirm').onclick = createEnv
    setTimeout(() => document.getElementById('env-modal-name')?.focus(), 50)
    document.getElementById('env-modal').addEventListener('keydown', e => {
      if (e.key === 'Enter') createEnv()
    })
  }

  function showEditEnvModal(envId) {
    window.api.db.getEnvs().then(envs => {
      const env = envs.find(e => e.id === envId)
      if (!env) return
      _modal('env-modal', '✏ Edit Environment', `
        <div style="display:flex;flex-direction:column;gap:10px">
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px">Nama *</label>
            <input type="text" id="env-modal-name" value="${esc(env.name)}"
              style="width:100%;font-size:12px">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px">Base URL</label>
            <input type="text" id="env-modal-url" value="${esc(env.base_url||'')}"
              placeholder="https://example.com"
              style="width:100%;font-size:12px;font-family:var(--font-mono)">
          </div>
        </div>`, 'Simpan')
      document.getElementById('env-modal-confirm').onclick = () => saveEditEnv(envId)
      setTimeout(() => document.getElementById('env-modal-name')?.focus(), 50)
    })
  }

  function showAddVarModal(envId) {
    _modal('var-modal', '+ Tambah Variabel', `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px">
            Key * <span style="color:var(--text3);font-weight:400">(huruf besar, contoh: BASE_URL)</span>
          </label>
          <input type="text" id="var-modal-key" placeholder="BASE_URL"
            style="width:100%;font-size:12px;font-family:var(--font-mono);text-transform:uppercase"
            oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9_]/g,'')">
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px">Value</label>
          <input type="text" id="var-modal-val" placeholder="nilai variabel"
            style="width:100%;font-size:12px;font-family:var(--font-mono)">
        </div>
      </div>`, 'Tambah')
    document.getElementById('var-modal-confirm').onclick = () => addVar(envId)
    setTimeout(() => document.getElementById('var-modal-key')?.focus(), 50)
    document.getElementById('var-modal').addEventListener('keydown', e => {
      if (e.key === 'Enter') addVar(envId)
    })
  }

  function renameKey(envId, oldKey) {
    _modal('key-modal', '✏ Rename Key', `
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px">
          Key baru (huruf besar)
        </label>
        <input type="text" id="key-modal-val" value="${esc(oldKey)}"
          style="width:100%;font-size:12px;font-family:var(--font-mono);text-transform:uppercase"
          oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9_]/g,'')">
      </div>`, 'Simpan')
    document.getElementById('key-modal-confirm').onclick = async () => {
      const newKey = document.getElementById('key-modal-val')?.value.trim()
      if (!newKey || newKey === oldKey) { document.getElementById('key-modal')?.remove(); return }
      const envs = await window.api.db.getEnvs()
      const env  = envs.find(e => e.id === envId)
      if (!env) return
      const val = env.vars[oldKey]
      delete env.vars[oldKey]
      env.vars[newKey] = val
      // Preserve key order
      await window.api.db.saveEnv(env)
      document.getElementById('key-modal')?.remove()
      render()
    }
    setTimeout(() => { const el = document.getElementById('key-modal-val'); el?.focus(); el?.select() }, 50)
  }

  // ── Actions ────────────────────────────────────────────────
  async function createEnv() {
    const name = document.getElementById('env-modal-name')?.value.trim()
    const url  = document.getElementById('env-modal-url')?.value.trim() || ''
    if (!name) { toast('⚠️ Nama wajib diisi', 'error'); return }
    await window.api.db.saveEnv({ name, base_url: url, vars: {}, is_active: 0 })
    document.getElementById('env-modal')?.remove()
    const envs = await window.api.db.getEnvs()
    const newEnv = envs.find(e => e.name === name)
    if (newEnv) _activeEnvId = newEnv.id
    toast(`✅ Environment "${name}" dibuat`)
    render()
  }

  async function saveEditEnv(envId) {
    const name = document.getElementById('env-modal-name')?.value.trim()
    const url  = document.getElementById('env-modal-url')?.value.trim() || ''
    if (!name) { toast('⚠️ Nama wajib diisi', 'error'); return }
    const envs = await window.api.db.getEnvs()
    const env  = envs.find(e => e.id === envId)
    if (!env) return
    env.name     = name
    env.base_url = url
    await window.api.db.saveEnv(env)
    document.getElementById('env-modal')?.remove()
    toast(`✅ Environment diupdate`)
    render()
  }

  async function activate(id) {
    const envs = await window.api.db.getEnvs()
    for (const env of envs) {
      await window.api.db.saveEnv({ ...env, is_active: env.id === id ? 1 : 0 })
    }
    const active = envs.find(e => e.id === id)
    if (active) AppState.setActiveEnv({ ...active, is_active: 1 })
    _activeEnvId = id
    // Update sidebar label
    const sidebarLabel = document.getElementById('env-sidebar-label')
    if (sidebarLabel) sidebarLabel.textContent = active?.name || ''
    toast(`✅ "${active?.name}" dijadikan environment aktif`)
    render()
  }

  function selectEnv(id) {
    _activeEnvId = id
    render()
  }

  async function updateVar(envId, key, val) {
    const envs = await window.api.db.getEnvs()
    const env  = envs.find(e => e.id === envId)
    if (!env) return
    if (env.vars[key] === val) return  // tidak berubah, skip
    env.vars[key] = val
    await window.api.db.saveEnv(env)
    // No re-render — inline edit, cukup save
  }

  async function addVar(envId) {
    const key = document.getElementById('var-modal-key')?.value.trim().toUpperCase()
    const val = document.getElementById('var-modal-val')?.value || ''
    if (!key) { toast('⚠️ Key wajib diisi', 'error'); return }
    const envs = await window.api.db.getEnvs()
    const env  = envs.find(e => e.id === envId)
    if (!env) return
    if (env.vars[key] !== undefined) { toast(`⚠️ Key "${key}" sudah ada`, 'error'); return }
    env.vars[key] = val
    await window.api.db.saveEnv(env)
    document.getElementById('var-modal')?.remove()
    toast(`✅ Variabel ${key} ditambahkan`)
    render()
  }

  async function deleteVar(envId, key) {
    if (!confirm(`Hapus variabel "${key}"?`)) return
    const envs = await window.api.db.getEnvs()
    const env  = envs.find(e => e.id === envId)
    if (!env) return
    delete env.vars[key]
    await window.api.db.saveEnv(env)
    toast(`Variabel ${key} dihapus`)
    render()
  }

  async function deleteEnv(id) {
    const envs   = await window.api.db.getEnvs()
    const target = envs.find(e => e.id === id)
    if (!confirm(`Hapus environment "${target?.name}"? Tidak bisa dibatalkan.`)) return
    await window.api.db.deleteEnv(id)
    _activeEnvId = null
    toast(`Environment "${target?.name}" dihapus`)
    render()
  }

  return { render, activate, selectEnv, updateVar, addVar, deleteVar,
           deleteEnv, renameKey, showNewEnvModal, showEditEnvModal, showAddVarModal }
})()

/* pages/settings.js */
/* pages/dashboard.js */
window.PageDashboard = (() => {
  'use strict'

  let _selProjId = null

  async function render() {
    const content = document.getElementById('content-area')
    const ta      = document.getElementById('topbar-actions')

    content.innerHTML = `<div style="padding:24px;color:var(--text3);font-size:12px">
      <i class="bi bi-arrow-clockwise" style="animation:spin .7s linear infinite"></i> Memuat...</div>`

    try {
      const projects = await window.api.db.getProjects().catch(() => [])
      AppState.cache.projects = projects
      if (!_selProjId && projects.length) _selProjId = projects[0].id
      if (!AppState.cache.activeProj && projects.length) AppState.cache.activeProj = projects[0]
      const proj = _selProjId ? projects.find(p => p.id === _selProjId) : projects[0]

      ta.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px">
          ${projects.length > 1 ? `
          <select style="font-size:11px" onchange="PageDashboard.switchProject(this.value)">
            ${projects.map(p => `<option value="${p.id}" ${p.id===_selProjId?'selected':''}>${esc(p.name)}</option>`).join('')}
          </select>` : `<span style="font-size:12px;font-weight:600">${esc(proj&&proj.name||'')}</span>`}
          <button class="btn btn-p btn-sm" onclick="navigate('testrun')">
            <i class="bi bi-play-fill"></i> Run Test
          </button>
        </div>`

      const [allRuns, suites] = await Promise.all([
        window.api.db.getAllRuns().catch(() => []),
        proj ? window.api.db.getSuites(proj.id).catch(() => []) : Promise.resolve([]),
      ])
      const projRuns = proj ? allRuns.filter(r => r.project_id === proj.id) : []

      // Count TCs
      let tcDefs = []
      for (const suite of suites) {
        try { tcDefs.push(...await window.api.db.getTestCasesBySuite(suite.id).catch(()=>[])) } catch {}
        const secs = await window.api.db.getSections(suite.id).catch(()=>[])
        for (const sec of secs) {
          tcDefs.push(...await window.api.db.getTestCases(sec.id).catch(()=>[]))
        }
      }
      const seen = new Set()
      tcDefs = tcDefs.filter(tc => seen.has(tc.id) ? false : (seen.add(tc.id), true))
      const tcTotal = tcDefs.length

      const passRuns = projRuns.filter(r => r.status === 'pass').length
      const failRuns = projRuns.filter(r => r.status === 'fail').length
      const pendRuns = projRuns.filter(r => r.status === 'pending').length

      const totalTCRan  = projRuns.reduce((s, r) => s + (r.pass||0) + (r.fail||0), 0)
      const totalTCPass = projRuns.reduce((s, r) => s + (r.pass||0), 0)
      const passRate    = totalTCRan > 0 ? Math.round(totalTCPass/totalTCRan*100) : 0

      const suiteStats = await Promise.all(suites.map(async s => {
        let tc = 0
        try { tc += (await window.api.db.getTestCasesBySuite(s.id).catch(()=>[])).length } catch {}
        const secs = await window.api.db.getSections(s.id).catch(()=>[])
        for (const sec of secs) { tc += (await window.api.db.getTestCases(sec.id).catch(()=>[])).length }
        return { ...s, tcCount: tc }
      }))

      content.innerHTML = `
      <div style="padding:20px;display:flex;flex-direction:column;gap:14px">

        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px">
          ${[
            { n: tcTotal,         l: 'Total TC',    c: 'var(--text)',  i: 'bi-file-earmark-check' },
            { n: passRuns,        l: 'Run Lulus',   c: '#16a34a',      i: 'bi-check-circle-fill' },
            { n: failRuns,        l: 'Run Gagal',   c: '#dc2626',      i: 'bi-x-circle-fill' },
            { n: pendRuns,        l: 'Belum Dirun', c: '#7c3aed',      i: 'bi-hourglass' },
            { n: projRuns.length, l: 'Total Runs',  c: 'var(--blue)',  i: 'bi-play-circle-fill' },
          ].map(s => `
            <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                <i class="bi ${s.i}" style="font-size:12px;color:${s.c}"></i>
                <span style="font-size:10px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.3px">${s.l}</span>
              </div>
              <div style="font-size:26px;font-weight:800;color:${s.c};line-height:1">${s.n}</div>
            </div>`).join('')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">

          <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
            <div style="font-size:13px;font-weight:700;margin-bottom:2px">
              <i class="bi bi-clock-history" style="color:var(--blue)"></i> Run Terakhir
            </div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:12px">
              ${projRuns.length} run &nbsp;·&nbsp; Pass rate: <b style="color:${passRate>=70?'var(--green)':'#ea580c'}">${passRate}%</b>
            </div>
            ${projRuns.slice(0,6).map(r => {
              const total = (r.pass||0)+(r.fail||0)
              const pct   = total>0 ? Math.round((r.pass||0)/total*100) : 0
              const dur   = r.duration_ms ? (r.duration_ms>=60000
                ? Math.floor(r.duration_ms/60000)+'m '+Math.round((r.duration_ms%60000)/1000)+'s'
                : (r.duration_ms/1000).toFixed(1)+'s') : ''
              const date = r.created_at
                ? new Date(r.created_at).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
                : ''
              const sc = r.status==='pass'?'#16a34a':r.status==='fail'?'#dc2626':r.status==='running'?'#2563eb':'#7c3aed'
              const sb = r.status==='pass'?'#dcfce7':r.status==='fail'?'#fee2e2':r.status==='running'?'#dbeafe':'#ede9fe'
              return `
              <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);cursor:pointer"
                onclick="navigate('testrun')">
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.plan_name)}</div>
                  <div style="font-size:10px;color:var(--text3)">
                    ${date}${total?' · '+r.pass+'✓ '+r.fail+'✗':''}${dur?' · '+dur:''}
                  </div>
                </div>
                ${total ? `<div style="width:50px;height:4px;background:var(--surface3);border-radius:2px;overflow:hidden;flex-shrink:0">
                  <div style="height:100%;width:${pct}%;background:#16a34a;border-radius:2px"></div>
                </div>` : ''}
                <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:4px;background:${sb};color:${sc};flex-shrink:0;text-transform:uppercase">${r.status||'pending'}</span>
              </div>`
            }).join('') || `
            <div style="text-align:center;padding:24px;color:var(--text3)">
              <i class="bi bi-play-circle" style="font-size:1.5rem;display:block;margin-bottom:8px;opacity:.4"></i>
              <div style="font-size:12px;margin-bottom:8px">Belum ada run</div>
              <button class="btn btn-p btn-sm" onclick="navigate('testrun')">Jalankan Test</button>
            </div>`}
            ${projRuns.length > 0 ? `
            <button class="btn btn-d btn-sm w100" style="margin-top:8px" onclick="navigate('reports')">
              Lihat semua ${projRuns.length} run <i class="bi bi-arrow-right"></i>
            </button>` : ''}
          </div>

          <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
            <div style="font-size:13px;font-weight:700;margin-bottom:2px">
              <i class="bi bi-folder2-open" style="color:var(--blue)"></i> ${esc(proj&&proj.name||'Project')}
            </div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:12px">
              ${suites.length} suite · ${tcTotal} test case
            </div>
            ${suiteStats.length ? suiteStats.map(s => `
              <div style="padding:7px 0;border-bottom:1px solid var(--border)">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                  <div style="font-size:12px;font-weight:600">${esc(s.name)}</div>
                  <span style="font-size:10px;color:var(--text3)">${s.tcCount} TC</span>
                </div>
                <div style="height:4px;background:var(--surface3);border-radius:2px;overflow:hidden">
                  <div style="height:100%;width:${tcTotal>0?Math.round(s.tcCount/tcTotal*100):0}%;background:var(--blue);border-radius:2px"></div>
                </div>
              </div>`).join('') : `
              <div style="text-align:center;padding:24px;color:var(--text3)">
                <i class="bi bi-folder-plus" style="font-size:1.5rem;display:block;margin-bottom:8px;opacity:.4"></i>
                <div style="font-size:12px;margin-bottom:8px">Belum ada suite</div>
                <button class="btn btn-d btn-sm" onclick="navigate('projects')">Buat Project</button>
              </div>`}
            ${tcTotal > 0 ? `
            <button class="btn btn-d btn-sm w100" style="margin-top:8px" onclick="navigate('projects')">
              Kelola Test Cases <i class="bi bi-arrow-right"></i>
            </button>` : ''}
          </div>
        </div>

        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
          <div style="font-size:13px;font-weight:700;margin-bottom:10px">
            <i class="bi bi-lightning-fill" style="color:var(--yellow)"></i> Aksi Cepat
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${[
              ['bi-search','Inspector & Editor','inspector'],
              ['bi-folder-plus','Project Baru','projects'],
              ['bi-play-circle-fill','Jalankan Test','testrun'],
              ['bi-bar-chart-line','Reports','reports'],
              ['bi-braces','Environments','environments'],
              ['bi-gear','Settings','settings'],
            ].map(([icon,label,page]) => `
              <button class="btn btn-d btn-sm" onclick="navigate('${page}')">
                <i class="bi ${icon}" style="font-size:12px"></i> ${label}
              </button>`).join('')}
          </div>
        </div>
      </div>`

    } catch (err) {
      console.error('[dashboard]', err)
      content.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text3)">
        <i class="bi bi-exclamation-triangle" style="font-size:2rem;display:block;margin-bottom:10px"></i>
        <div>Gagal memuat: ${esc(err.message)}</div>
      </div>`
    }
  }

  async function switchProject(id) {
    _selProjId = id
    const projects = AppState.cache.projects || []
    AppState.cache.activeProj = projects.find(p => p.id === id)
    render()
  }

  return { render, switchProject }
})()
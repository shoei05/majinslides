const $ = (sel) => document.querySelector(sel);
const editor = $('#editor');
const preview = $('#preview');
const dlg = $('#dlg-settings');

const DEFAULT_MD = `---\nmarp: true\ntheme: majin\npaginate: true\nsize: 16:9\n---\n\n# まじん式スライド\n\n- 左で編集 / 右でプレビュー\n- 「ダウンロード(.html)」で単一HTMLを書き出し\n- 「Googleスライド化」ボタンでGitHub Actionsを起動\n`;

// Load theme CSS
let themeCSS = '';
fetch('./themes/majin.css').then(r => r.text()).then(css => { themeCSS = css; tryRender(); });

// Marp is loaded dynamically so the rest of the UI still works
// even if the CDN is blocked or unavailable in production.
let marp = null;
const themeSet = [ { name: 'majin', css: () => themeCSS } ];

async function initMarp() {
  try {
    const { default: Marp } = await import('https://cdn.jsdelivr.net/npm/@marp-team/marp-core@4.0.2/lib/marp.esm.js');
    marp = new Marp({ html: true, markdown: { breaks: true } });
    tryRender();
  } catch (e) {
    console.error('Failed to load Marp ESM from CDN:', e);
    if (preview) preview.innerHTML = '<pre class="error">プレビュー用ライブラリの読み込みに失敗しました。ネットワークやCDNの到達性を確認してください。</pre>';
  }
}

function tryRender() {
  if (!editor) return;
  try {
    if (!marp) {
      // Not yet loaded, show placeholder
      preview.innerHTML = '<div class="error">プレビュー読み込み中…（CDNに未到達の可能性）</div>';
      return;
    }
    const { html, css } = marp.render(editor.value || '', { themeSet });
    preview.innerHTML = `<style>${css}</style>` + html;
  } catch (e) {
    preview.innerHTML = `<pre class="error">${e.message}</pre>`;
  }
}

// Persistence
const LS_KEY = 'majin-marp-md';
if (editor) {
  editor.value = localStorage.getItem(LS_KEY) || DEFAULT_MD;
  editor.addEventListener('input', () => { localStorage.setItem(LS_KEY, editor.value); tryRender(); });
}

function readCfg() {
  return {
    owner: localStorage.getItem('gh.owner') || 'shoei05',
    repo: localStorage.getItem('gh.repo') || 'majinslides',
    ref: localStorage.getItem('gh.ref') || 'main',
    workflow: localStorage.getItem('gh.workflow') || 'slides.yml',
    mdPath: localStorage.getItem('gh.mdPath') || 'slides/majin-${timestamp}.md',
    token: localStorage.getItem('gh.token') || '',
    folderId: localStorage.getItem('gdrive.folderId') || '',
    shareEmail: localStorage.getItem('gdrive.shareEmail') || '',
    googleClientId: localStorage.getItem('gcp.clientId') || '',
  };
}
function writeCfg(cfg) {
  localStorage.setItem('gh.owner', cfg.owner);
  localStorage.setItem('gh.repo', cfg.repo);
  localStorage.setItem('gh.ref', cfg.ref);
  localStorage.setItem('gh.workflow', cfg.workflow);
  localStorage.setItem('gh.mdPath', cfg.mdPath);
  localStorage.setItem('gh.token', cfg.token);
  localStorage.setItem('gdrive.folderId', cfg.folderId);
  localStorage.setItem('gdrive.shareEmail', cfg.shareEmail);
  localStorage.setItem('gcp.clientId', cfg.googleClientId || '');
}

function openSettings() {
  const c = readCfg();
  $('#gh-owner').value = c.owner;
  $('#gh-repo').value = c.repo;
  $('#gh-ref').value = c.ref;
  $('#gh-workflow').value = c.workflow;
  $('#gh-md-path').value = c.mdPath;
  $('#gh-token').value = c.token;
  $('#gdrive-folder').value = c.folderId;
  $('#share-email').value = c.shareEmail;
  const gci = $('#gcp-client-id'); if (gci) gci.value = c.googleClientId;
  try { if (!('showModal' in dlg)) window.dialogPolyfill && window.dialogPolyfill.registerDialog(dlg); dlg.showModal(); }
  catch { dlg.setAttribute('open',''); }
}
function saveSettings() {
  writeCfg({
    owner: $('#gh-owner').value.trim(),
    repo: $('#gh-repo').value.trim(),
    ref: $('#gh-ref').value.trim() || 'main',
    workflow: $('#gh-workflow').value.trim() || 'slides.yml',
    mdPath: $('#gh-md-path').value.trim() || 'slides/majin-${timestamp}.md',
    token: $('#gh-token').value.trim(),
    folderId: $('#gdrive-folder').value.trim(),
    shareEmail: $('#share-email').value.trim(),
    googleClientId: (function(){ const el = $('#gcp-client-id'); return el ? (el.value || '').trim() : ''; })(),
  });
  try { dlg.close(); } catch { dlg.removeAttribute('open'); }
}

async function commitMarkdown(cfg) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const mdPath = (cfg.mdPath || 'slides/majin-${timestamp}.md').replace('${timestamp}', timestamp);
  const api = 'https://api.github.com';
  const headers = { 'Authorization': `Bearer ${cfg.token}`, 'Accept': 'application/vnd.github+json' };
  const contentB64 = btoa(unescape(encodeURIComponent(editor.value)));
  const putUrl = `${api}/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURIComponent(mdPath)}`;
  let sha = '';
  const head = await fetch(putUrl + `?ref=${encodeURIComponent(cfg.ref)}`, { headers });
  if (head.ok) { const info = await head.json(); sha = info.sha || ''; }
  const body = { message: (sha ? 'chore(slides): update ' : 'feat(slides): add ') + mdPath, content: contentB64, branch: cfg.ref };
  if (sha) body.sha = sha;
  const resPut = await fetch(putUrl, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (!resPut.ok) throw new Error('ファイル登録失敗: ' + (await resPut.text()));
  return mdPath;
}

async function triggerWorkflow(cfg) {
  const api = 'https://api.github.com';
  const headers = { 'Authorization': `Bearer ${cfg.token}`, 'Accept': 'application/vnd.github+json' };
  const wfUrl = `${api}/repos/${cfg.owner}/${cfg.repo}/actions/workflows/${encodeURIComponent(cfg.workflow)}/dispatches`;
  const resWf = await fetch(wfUrl, { method: 'POST', headers, body: JSON.stringify({ ref: cfg.ref }) });
  if (!resWf.ok) throw new Error('Workflow起動失敗: ' + (await resWf.text()));
}

async function fetchJson(url, headers) { const r = await fetch(url, { headers }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); }

async function waitAndFetchPptxArtifact(cfg, startedAtMs, timeoutMs=180000) {
  const api = 'https://api.github.com';
  const headers = { 'Authorization': `Bearer ${cfg.token}`, 'Accept': 'application/vnd.github+json' };
  const deadline = Date.now() + timeoutMs;
  const sinceIso = new Date(startedAtMs - 5000).toISOString();
  while (Date.now() < deadline) {
    const runs = await fetchJson(`${api}/repos/${cfg.owner}/${cfg.repo}/actions/runs?per_page=10`, headers);
    const ok = (runs.workflow_runs || []).find(r => r.path === `.github/workflows/${cfg.workflow}` && r.status === 'completed' && r.conclusion === 'success' && r.run_started_at >= sinceIso);
    if (ok) {
      const arts = await fetchJson(`${api}/repos/${cfg.owner}/${cfg.repo}/actions/runs/${ok.id}/artifacts?per_page=10`, headers);
      const a = (arts.artifacts || []).find(x => x.name === 'majin-slides');
      if (a) {
        const zipRes = await fetch(a.archive_download_url, { headers });
        const zipBlob = await zipRes.blob();
        const zip = await JSZip.loadAsync(zipBlob);
        const entry = Object.values(zip.files).find(f => f.name.endsWith('dist/slides.pptx'));
        if (!entry) throw new Error('PPTXがアーティファクトに見つかりません');
        const buf = await entry.async('arraybuffer');
        return { blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }), name: 'slides.pptx' };
      }
    }
    await new Promise(r => setTimeout(r, 4000));
  }
  throw new Error('Artifactsの取得にタイムアウトしました');
}

// Google OAuth (client-side)
let googleAccessToken = '';
async function ensureGoogleToken(interactive=false) {
  const cfg = readCfg();
  if (!cfg.googleClientId) { openSettings(); alert('Google OAuth Client ID を設定してください'); return null; }
  if (googleAccessToken && !interactive) return googleAccessToken;
  return new Promise((resolve, reject) => {
    try {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: cfg.googleClientId,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/presentations',
        callback: (resp) => { if (resp && resp.access_token) { googleAccessToken = resp.access_token; resolve(googleAccessToken); } else reject(new Error('No access_token')); },
      });
      tokenClient.requestAccessToken();
    } catch (e) { console.error(e); alert('Google認証に失敗しました'); reject(e); }
  });
}

async function uploadPptxAsSlides(accessToken, pptxBlob, folderId, title) {
  const boundary = '-------majinslides' + Math.random().toString(16).slice(2);
  const metadata = { name: title, mimeType: 'application/vnd.google-apps.presentation', parents: folderId ? [folderId] : undefined };
  const body = new Blob([
    `--${boundary}\r\n`, 'Content-Type: application/json; charset=UTF-8\r\n\r\n', JSON.stringify(metadata) + '\r\n',
    `--${boundary}\r\n`, 'Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation\r\n\r\n', pptxBlob, `\r\n--${boundary}--`
  ], { type: 'multipart/related; boundary=' + boundary });
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}` }, body });
  if (!res.ok) throw new Error('Driveアップロード失敗: ' + (await res.text()));
  const { id } = await res.json();
  return { id, webLink: `https://docs.google.com/presentation/d/${id}/edit` };
}

async function grantPermission(accessToken, fileId, email) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?sendNotificationEmail=false`, { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'writer', type: 'user', emailAddress: email }) });
  if (!res.ok) throw new Error('権限付与失敗: ' + (await res.text()));
}

async function dispatchWorkflow() {
  const cfg = readCfg();
  if (!cfg.owner || !cfg.repo || !cfg.token) { openSettings(); alert('GitHub設定が不足しています。Owner/Repo/Tokenを設定してください。'); return; }
  try {
    await commitMarkdown(cfg);
    await triggerWorkflow(cfg);
    alert('Workflowを起動しました。完了後、ActionsのArtifactsからPDF/PPTX/HTMLが取得できます。');
  } catch (e) { alert(e.message || String(e)); }
}

async function dispatchAndDirectConvert() {
  const cfg = readCfg();
  if (!cfg.owner || !cfg.repo || !cfg.token) { openSettings(); alert('GitHub設定が不足しています'); return; }
  const started = Date.now();
  try {
    await commitMarkdown(cfg);
    await triggerWorkflow(cfg);
    const { blob } = await waitAndFetchPptxArtifact(cfg, started);
    const token = await ensureGoogleToken(true);
    const link = await uploadPptxAsSlides(token, blob, cfg.folderId || '', `Majin Slides ${new Date().toLocaleString()}`);
    if (cfg.shareEmail) { try { await grantPermission(token, link.id, cfg.shareEmail); } catch (e) { console.warn('permission failed', e); } }
    window.open(link.webLink, '_blank');
  } catch (e) { alert(e.message || String(e)); }
}

function attachHandlers() {
  const bNew = $('#btn-new'); if (bNew) bNew.addEventListener('click', () => { if (!editor) return; editor.value = DEFAULT_MD; editor.dispatchEvent(new Event('input')); });
  const bOpen = $('#btn-open'); if (bOpen) bOpen.addEventListener('click', () => { const fo = $('#file-open'); if (fo) fo.click(); });
  const fOpen = $('#file-open'); if (fOpen) fOpen.addEventListener('change', async (e) => { const f = e.target && e.target.files ? e.target.files[0] : null; if (!f) return; const text = await f.text(); editor.value = text; editor.dispatchEvent(new Event('input')); });
  const bSave = $('#btn-save-md'); if (bSave) bSave.addEventListener('click', () => { const blob = new Blob([editor.value], { type: 'text/markdown;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'majin-slides.md'; a.click(); URL.revokeObjectURL(a.href); });
  const bHtml = $('#btn-download-html'); if (bHtml) bHtml.addEventListener('click', () => { if (!marp) { alert('プレビュー用ライブラリが未ロードです。ネットワークやCDNを確認してください。'); return; } const { html, css } = marp.render(editor.value, { themeSet }); const doc = `<!doctype html><html lang=\"ja\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Majin Slides</title><style>${css}</style>${html}`; const blob = new Blob([doc], { type: 'text/html;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'majin-slides.html'; a.click(); URL.revokeObjectURL(a.href); });
  const bSet = $('#btn-settings'); if (bSet) bSet.addEventListener('click', openSettings);
  const bSetCancel = $('#btn-settings-cancel'); if (bSetCancel) bSetCancel.addEventListener('click', () => { try { dlg.close(); } catch (e) { dlg.removeAttribute('open'); } });
  const bSetSave = $('#btn-settings-save'); if (bSetSave) bSetSave.addEventListener('click', saveSettings);
  const bDispatch = $('#btn-dispatch'); if (bDispatch) bDispatch.addEventListener('click', () => dispatchWorkflow());
  const bAuth = $('#btn-google-auth'); if (bAuth) bAuth.addEventListener('click', () => ensureGoogleToken(true));
  const bDirect = $('#btn-direct-gslides'); if (bDirect) bDirect.addEventListener('click', () => dispatchAndDirectConvert());

  const bPptx = $('#btn-export-pptx'); if (bPptx) bPptx.addEventListener('click', () => exportPptxOffline());

  // expose fallbacks (for manual use)
  window.__newDoc = () => { if (!editor) return; editor.value = DEFAULT_MD; editor.dispatchEvent(new Event('input')); };
  window.__openFile = () => { const fo = $('#file-open'); if (fo) fo.click(); };
  window.__saveMd = () => { const blob = new Blob([editor.value], { type: 'text/markdown;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'majin-slides.md'; a.click(); URL.revokeObjectURL(a.href); };
  window.__saveHtml = () => { if (!marp) { alert('プレビュー用ライブラリが未ロードです。ネットワークやCDNを確認してください。'); return; } const { html, css } = marp.render(editor.value, { themeSet }); const doc = `<!doctype html><html lang=\"ja\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Majin Slides</title><style>${css}</style>${html}`; const blob = new Blob([doc], { type: 'text/html;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'majin-slides.html'; a.click(); URL.revokeObjectURL(a.href); };
  window.__openSettings = openSettings;
  window.__dispatch = () => dispatchWorkflow();
  window.__authGoogle = () => ensureGoogleToken(true);
  window.__direct = () => dispatchAndDirectConvert();
}

window.addEventListener('DOMContentLoaded', () => { tryRender(); attachHandlers(); initMarp(); });

// --- Offline PPTX export ---
let depsLoaded = false;
function loadScript(src){
  return new Promise((resolve, reject)=>{
    const exists = document.querySelector(`script[data-src="${src}"]`);
    if (exists) { exists.addEventListener('load', ()=>resolve()); if (exists.dataset.ready) resolve(); return; }
    const s=document.createElement('script'); s.src=src; s.async=true; s.crossOrigin='anonymous'; s.referrerPolicy='no-referrer'; s.setAttribute('data-src', src);
    s.onload=()=>{ s.dataset.ready='1'; resolve(); };
    s.onerror=()=>reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}
async function ensureOfflineDeps(){
  if (depsLoaded) return;
  if (!window.html2canvas) await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
  if (!window.PptxGenJS) await loadScript('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js');
  depsLoaded = true;
}
async function exportPptxOffline(){
  try {
    const btn = $('#btn-export-pptx'); if (btn) { btn.disabled = true; btn.textContent = '変換中…'; }
    await ensureOfflineDeps();
    const slides = preview ? preview.querySelectorAll('section') : [];
    if (!slides || slides.length === 0) { alert('スライドがありません'); return; }
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    for (let i = 0; i < slides.length; i++) {
      const el = slides[i];
      // Render each slide to image
      const canvas = await html2canvas(el, { backgroundColor: '#0e1117', scale: 2, useCORS: true });
      const dataUrl = canvas.toDataURL('image/png');
      const s = pptx.addSlide();
      s.addImage({ data: dataUrl, x: 0, y: 0, w: 10, h: 5.625, sizing: { type: 'contain', w: 10, h: 5.625 } });
    }
    await pptx.writeFile('majin-slides.pptx');
  } catch (e) {
    console.error(e); alert('PPTX出力に失敗しました: ' + (e.message || e));
  } finally {
    const btn = $('#btn-export-pptx'); if (btn) { btn.disabled = false; btn.textContent = 'PPTX(オフライン)'; }
  }
}

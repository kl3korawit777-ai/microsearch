// Microsearch Admin — Supabase-backed CRUD + Publish snapshot
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// ---- Config sanity ----
if (!window.SUPABASE_URL || !window.SUPABASE_ANON ||
    window.SUPABASE_URL.includes('YOUR-PROJECT')) {
  alert('admin/config.js ยังไม่ตั้งค่า — ดู README-admin.md');
  throw new Error('config not set');
}
const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON);

// ---- State ----
const state = {
  user: null,
  microbes: [],
  search: '',
  filterKingdom: '',
  editing: null, // existing row id or null for new
};

const $ = (id) => document.getElementById(id);

// ============ HELPERS ============
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
function toast(msg, kind = '') {
  const el = $('toast');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2800);
}
function kingdomLabel(k) {
  return { bacteria: 'แบคทีเรีย', virus: 'ไวรัส', parasite: 'ปรสิต' }[k] || k;
}
function categoryLabel(id) {
  for (const king of CATEGORY_TREE) {
    for (const grp of king.groups) {
      const f = grp.items.find((i) => i.id === id);
      if (f) return f.label;
    }
  }
  return id;
}

// ============ AUTH ============
async function checkSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) enterApp(session.user);
}
function enterApp(user) {
  state.user = user;
  $('loginScreen').hidden = true;
  $('adminApp').hidden = false;
  $('userBadge').textContent = user.email;
  loadMicrobes();
}
async function doLogin(e) {
  e.preventDefault();
  $('loginError').hidden = true;
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    $('loginError').textContent = error.message;
    $('loginError').hidden = false;
    return;
  }
  enterApp(data.user);
}
async function doLogout() {
  await sb.auth.signOut();
  location.reload();
}

// ============ LOAD / RENDER ============
async function loadMicrobes() {
  const { data, error } = await sb.from('microbes').select('*').order('name');
  if (error) { toast('โหลดล้มเหลว: ' + error.message, 'error'); return; }
  state.microbes = data || [];
  renderTable();
}

function filterRows() {
  const q = state.search.trim().toLowerCase();
  return state.microbes.filter((m) => {
    if (state.filterKingdom && m.kingdom !== state.filterKingdom) return false;
    if (q) {
      const hay = `${m.id} ${m.name} ${m.thai || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderTable() {
  const rows = filterRows();
  $('searchCount').textContent = `${rows.length} / ${state.microbes.length} รายการ`;

  if (state.microbes.length === 0) {
    $('emptyState').hidden = false;
    $('microbeTable').hidden = true;
    return;
  }
  $('emptyState').hidden = true;
  $('microbeTable').hidden = false;

  const body = $('microbeBody');
  body.innerHTML = rows.map((m) => {
    const cats = (m.categories || []).slice(0, 3).map(categoryLabel).join(', ');
    const more = (m.categories || []).length > 3 ? ` +${m.categories.length - 3}` : '';
    const updated = m.updated_at ? new Date(m.updated_at).toLocaleDateString('th-TH') : '';
    return `
      <tr data-id="${escapeHtml(m.id)}">
        <td class="row-name"><em>${escapeHtml(m.name)}</em></td>
        <td>${escapeHtml(m.thai || '')}</td>
        <td><span class="row-kingdom ${m.kingdom}">${kingdomLabel(m.kingdom)}</span></td>
        <td class="row-cats">${escapeHtml(cats)}${more}</td>
        <td class="row-cats">${updated}</td>
        <td class="row-actions">
          <button data-act="edit">แก้ไข</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ============ EDIT MODAL ============
function renderCategoryCheckboxes(kingdom, selected = []) {
  const box = $('categoryCheckboxes');
  const king = CATEGORY_TREE.find((k) => k.kingdom === kingdom);
  if (!king) { box.innerHTML = ''; return; }
  const sel = new Set(selected);
  box.innerHTML = king.groups.map((g) => `
    <div style="grid-column:1/-1;font-weight:600;color:var(--muted);margin-top:6px;font-size:.8rem">${escapeHtml(g.title)}</div>
    ${g.items.map((it) => `
      <label><input type="checkbox" name="cat" value="${escapeHtml(it.id)}" ${sel.has(it.id) ? 'checked' : ''}/> ${escapeHtml(it.label)}</label>
    `).join('')}
  `).join('');
}

function openEdit(id) {
  const m = id ? state.microbes.find((x) => x.id === id) : null;
  state.editing = id || null;
  $('editTitle').textContent = m ? `แก้ไข: ${m.name}` : 'เพิ่มเชื้อ';
  $('deleteBtn').hidden = !m;

  const f = $('editForm');
  f.reset();
  if (m) {
    f.id.value = m.id;
    f.id.readOnly = true;
    f.name.value = m.name || '';
    f.thai.value = m.thai || '';
    f.kingdom.value = m.kingdom || 'bacteria';
    f.icon.value = m.icon || '🦠';
    f.image.value = m.image || '';
    f.characteristics.value = m.characteristics || '';
    f.pathogenesis.value = m.pathogenesis || '';
    f.vector.value = m.vector || '';
    f.additional.value = m.additional || '';
    f.refs.value = (m.refs || []).join('\n');
  } else {
    f.id.readOnly = false;
    f.kingdom.value = 'bacteria';
    f.icon.value = '🦠';
  }
  renderCategoryCheckboxes(f.kingdom.value, m ? (m.categories || []) : []);
  showModal('editModal');
}

function collectForm() {
  const f = $('editForm');
  const cats = [...f.querySelectorAll('input[name=cat]:checked')].map((i) => i.value);
  const refs = f.refs.value.split('\n').map((s) => s.trim()).filter(Boolean);
  return {
    id: f.id.value.trim(),
    name: f.name.value.trim(),
    thai: f.thai.value.trim() || null,
    kingdom: f.kingdom.value,
    icon: f.icon.value.trim() || '🦠',
    image: f.image.value.trim() || null,
    categories: cats,
    characteristics: f.characteristics.value || null,
    pathogenesis: f.pathogenesis.value || null,
    vector: f.vector.value || null,
    additional: f.additional.value || null,
    refs,
  };
}

async function saveMicrobe(e) {
  e.preventDefault();
  const row = collectForm();
  if (!row.id || !row.name) { toast('ต้องมี id และ name', 'error'); return; }

  let resp;
  if (state.editing) {
    resp = await sb.from('microbes').update(row).eq('id', state.editing);
  } else {
    resp = await sb.from('microbes').insert(row);
  }
  if (resp.error) { toast('บันทึกล้มเหลว: ' + resp.error.message, 'error'); return; }
  toast('บันทึกเรียบร้อย', 'success');
  closeModal('editModal');
  loadMicrobes();
}

async function deleteMicrobe() {
  if (!state.editing) return;
  if (!confirm(`ลบ ${state.editing}? (ลบจริง — ย้อนกลับไม่ได้)`)) return;
  const { error } = await sb.from('microbes').delete().eq('id', state.editing);
  if (error) { toast('ลบล้มเหลว: ' + error.message, 'error'); return; }
  toast('ลบเรียบร้อย', 'success');
  closeModal('editModal');
  loadMicrobes();
}

// ============ MODAL HELPERS ============
function showModal(id) { $(id).hidden = false; document.body.style.overflow = 'hidden'; }
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = true; document.body.style.overflow = '';
}
window.closeModal = closeModal;

// ============ SEED from data.js ============
async function seedFromData() {
  if (!Array.isArray(window.MICROBES) || !MICROBES.length) {
    toast('ไม่พบ MICROBES ใน data.js', 'error'); return;
  }
  if (!confirm(`Seed ${MICROBES.length} รายการเข้า Supabase? (จะ skip ถ้า id ซ้ำ)`)) return;

  const rows = MICROBES.map((m) => ({
    id: m.id,
    name: m.name,
    thai: m.thai || null,
    kingdom: m.kingdom,
    icon: m.icon || '🦠',
    image: m.image || null,
    categories: m.categories || [],
    characteristics: m.characteristics || null,
    pathogenesis: m.pathogenesis || null,
    vector: m.vector || null,
    additional: m.additional || null,
    refs: m.references || [],
  }));

  // upsert in chunks of 50 to avoid payload limits
  let ok = 0, fail = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await sb.from('microbes').upsert(chunk, { onConflict: 'id' });
    if (error) { console.error(error); fail += chunk.length; }
    else ok += chunk.length;
  }
  toast(`Seed เสร็จ: ${ok} ok, ${fail} fail`, fail ? 'error' : 'success');
  loadMicrobes();
}

// ============ PUBLISH ============
async function publishDataJs() {
  if (!state.microbes.length) { toast('ไม่มีข้อมูล', 'error'); return; }

  // เรียงตาม kingdom > name เพื่อ diff อ่านง่าย
  const order = { bacteria: 0, virus: 1, parasite: 2 };
  const sorted = [...state.microbes].sort((a, b) =>
    (order[a.kingdom] - order[b.kingdom]) || a.name.localeCompare(b.name)
  );

  // แปลงเป็นรูปแบบเดียวกับ data.js เดิม (refs → references)
  const out = sorted.map((m) => ({
    id: m.id,
    name: m.name,
    thai: m.thai || '',
    kingdom: m.kingdom,
    icon: m.icon || '🦠',
    image: m.image || '',
    categories: m.categories || [],
    characteristics: m.characteristics || '',
    pathogenesis: m.pathogenesis || '',
    vector: m.vector || '',
    additional: m.additional || '',
    references: m.refs || [],
  }));

  // อ่าน CATEGORY_TREE จาก data.js ที่ load ไว้ — คงเดิม
  const tree = (typeof CATEGORY_TREE !== 'undefined') ? CATEGORY_TREE : [];

  const stamp = new Date().toISOString();
  const body =
    `// Microsearch — ข้อมูลเชื้อก่อโรค\n` +
    `// Generated by admin publish at ${stamp}\n` +
    `// อย่าแก้ไฟล์นี้ด้วยมือ — แก้ใน admin แล้วกด Publish ใหม่\n\n` +
    `const MICROBES = ${JSON.stringify(out, null, 2)};\n\n` +
    `const CATEGORY_TREE = ${JSON.stringify(tree, null, 2)};\n`;

  const blob = new Blob([body], { type: 'text/javascript;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'data.js';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  toast(`ดาวน์โหลด data.js (${out.length} รายการ) — เอาไปวางทับใน repo แล้ว push`, 'success');
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  checkSession();

  $('loginForm').addEventListener('submit', doLogin);
  $('logoutBtn').addEventListener('click', doLogout);
  $('addBtn').addEventListener('click', () => openEdit(null));
  $('publishBtn').addEventListener('click', publishDataJs);
  $('seedBtn').addEventListener('click', seedFromData);

  $('search').addEventListener('input', (e) => { state.search = e.target.value; renderTable(); });
  $('filterKingdom').addEventListener('change', (e) => { state.filterKingdom = e.target.value; renderTable(); });

  $('microbeBody').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    openEdit(tr.dataset.id);
  });

  $('editForm').addEventListener('submit', saveMicrobe);
  $('deleteBtn').addEventListener('click', deleteMicrobe);
  $('kingdomSelect').addEventListener('change', (e) => {
    const cur = [...document.querySelectorAll('input[name=cat]:checked')].map((i) => i.value);
    renderCategoryCheckboxes(e.target.value, cur);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('editModal').hidden) closeModal('editModal');
  });
});

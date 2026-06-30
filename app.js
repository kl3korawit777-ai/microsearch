// Microsearch — public app (read-only)
// อ่านข้อมูลจาก data.js (seed) เป็นหลัก; ไม่มี auth/add/edit/import/export อีกต่อไป
// CRUD ทั้งหมดย้ายไปที่ admin.html

const state = {
  microbes: [],
  search: '',
  activeCategory: null,
  activeKingdom: null,
  openGroups: new Set(),
};

const $ = (id) => document.getElementById(id);

// ============ DATA ============
function loadData() {
  state.microbes = Array.isArray(MICROBES) ? MICROBES.slice() : [];
}

// ============ HELPERS ============
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
function linkifyRefs(s) {
  return s.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ============ SIDEBAR ============
function renderSidebar() {
  const nav = $('categoryNav');
  nav.innerHTML = '';
  CATEGORY_TREE.forEach((king) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'cat-group' + (state.openGroups.has(king.kingdom) ? ' open' : '');

    const titleEl = document.createElement('div');
    titleEl.className = 'cat-group-title' + (state.activeKingdom === king.kingdom && !state.activeCategory ? ' active' : '');
    titleEl.innerHTML = `
      <span class="cat-dot ${king.kingdom}"></span>
      <span>${king.label}</span>
      <span class="cat-arrow">›</span>
    `;
    titleEl.onclick = () => {
      if (state.openGroups.has(king.kingdom)) {
        state.openGroups.delete(king.kingdom);
      } else {
        state.openGroups.add(king.kingdom);
      }
      state.activeKingdom = king.kingdom;
      state.activeCategory = null;
      render();
    };
    groupEl.appendChild(titleEl);

    king.groups.forEach((sub) => {
      const subBox = document.createElement('div');
      subBox.className = 'cat-sub';
      const subTitle = document.createElement('div');
      subTitle.className = 'cat-sub-title';
      subTitle.textContent = sub.title;
      subBox.appendChild(subTitle);

      sub.items.forEach((item) => {
        const a = document.createElement('a');
        a.className = 'cat-item' + (state.activeCategory === item.id ? ' active' : '');
        a.textContent = item.label;
        a.onclick = (e) => {
          e.preventDefault();
          state.activeCategory = state.activeCategory === item.id ? null : item.id;
          state.activeKingdom = king.kingdom;
          state.openGroups.add(king.kingdom);
          render();
        };
        subBox.appendChild(a);
      });
      groupEl.appendChild(subBox);
    });
    nav.appendChild(groupEl);
  });
}

// ============ FILTER ============
function filterMicrobes() {
  const q = state.search.trim().toLowerCase();
  return state.microbes.filter((m) => {
    if (state.activeKingdom && m.kingdom !== state.activeKingdom) return false;
    if (state.activeCategory && !(m.categories || []).includes(state.activeCategory)) return false;
    if (q) {
      const hay = `${m.name} ${m.thai} ${m.characteristics} ${m.pathogenesis}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderBreadcrumb() {
  const parts = ['ทั้งหมด'];
  if (state.activeKingdom) parts.push(kingdomLabel(state.activeKingdom));
  if (state.activeCategory) parts.push(categoryLabel(state.activeCategory));
  $('breadcrumb').innerHTML = parts
    .map((p, i) => (i === parts.length - 1 ? `<strong>${p}</strong>` : p))
    .join(' › ');
}

// ============ GRID ============
function renderGrid() {
  const grid = $('grid');
  const items = filterMicrobes();
  grid.innerHTML = '';
  $('emptyState').hidden = items.length > 0;
  $('searchCount').textContent = `${items.length} รายการ`;

  items.forEach((m) => {
    const card = document.createElement('div');
    card.className = 'card';

    const tagsHtml = (m.categories || [])
      .slice(0, 3)
      .map((c) => `<span class="tag">${escapeHtml(categoryLabel(c))}</span>`)
      .join('');

    const safeIcon = escapeHtml(m.icon || '🦠');
    const imgHtml = m.image
      ? `<img src="${escapeHtml(m.image)}" alt="${escapeHtml(m.name)}" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';">
         <div class="fallback" style="display:none">${safeIcon}</div>`
      : `<div class="fallback">${safeIcon}</div>`;

    card.innerHTML = `
      <div class="card-img ${m.kingdom}">
        ${imgHtml}
      </div>
      <div class="card-body">
        <h3 class="card-name"><em>${escapeHtml(m.name)}</em></h3>
        <p class="card-thai">${escapeHtml(m.thai || '')}</p>
        <div class="card-tags">
          <span class="tag kingdom-${m.kingdom}">${kingdomLabel(m.kingdom)}</span>
          ${tagsHtml}
        </div>
      </div>
    `;

    card.addEventListener('click', () => openView(m.id));

    grid.appendChild(card);
  });
}

// ============ VIEW MODAL ============
function openView(id) {
  const m = state.microbes.find((x) => x.id === id);
  if (!m) return;

  const tagsHtml = (m.categories || [])
    .map((c) => `<span class="tag">${escapeHtml(categoryLabel(c))}</span>`)
    .join('');

  const safeIcon = escapeHtml(m.icon || '🦠');
  const imgHtml = m.image
    ? `<img src="${escapeHtml(m.image)}" alt="${escapeHtml(m.name)}" loading="lazy" decoding="async" onerror="this.outerHTML='<span>${safeIcon}</span>'">`
    : safeIcon;

  const sections = [
    ['ลักษณะของเชื้อ', m.characteristics],
    ['การก่อโรค', m.pathogenesis],
    ['พาหะ / การติดต่อ', m.vector],
    ['ข้อมูลเพิ่มเติม', m.additional],
  ].filter(([_, v]) => v && v.trim())
   .map(([title, body]) => `
      <div class="detail-section">
        <h3>${title}</h3>
        <p>${escapeHtml(body)}</p>
      </div>
    `).join('');

  const refsHtml = (m.references && m.references.length)
    ? `<div class="detail-section">
        <h3>เอกสารอ้างอิง</h3>
        <ol class="ref-list">
          ${m.references.map(r => `<li>${linkifyRefs(escapeHtml(r))}</li>`).join('')}
        </ol>
      </div>`
    : '';

  $('viewModalBody').innerHTML = `
    <div class="modal-img ${m.kingdom}">${imgHtml}</div>
    <div class="modal-content">
      <div class="modal-header">
        <div>
          <h2><em>${escapeHtml(m.name)}</em></h2>
          <p class="modal-thai">${escapeHtml(m.thai || '')}</p>
        </div>
      </div>
      <div class="card-tags">
        <span class="tag kingdom-${m.kingdom}">${kingdomLabel(m.kingdom)}</span>
        ${tagsHtml}
      </div>
      ${sections}
      ${refsHtml}
    </div>
  `;
  showModal('viewModal');
}

// ============ MODAL HELPERS ============
function showModal(id) {
  $(id).hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = true;
  document.body.style.overflow = '';
}
window.closeModal = closeModal;

// ============ MAIN RENDER ============
function render() {
  renderSidebar();
  renderBreadcrumb();
  renderGrid();
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  render();

  $('search').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderGrid();
  });

  $('resetBtn').onclick = () => {
    state.search = '';
    state.activeCategory = null;
    state.activeKingdom = null;
    $('search').value = '';
    render();
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('viewModal').hidden) closeModal('viewModal');
  });
});

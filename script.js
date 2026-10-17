'use strict';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = { setup: false, me: null, view: 'kitoblar', auth: 'login', cfg: { card: '', fine: 1000 }, data: {}, pg: {}, f: { q: '', g: '', av: '', st: '' }, genres: [], pending: 0, days: 7, pay: 'naqd', tm: 0 };
const NAV = {
  mijoz: [['kitoblar', '📚 Kitoblar'], ['savatcha', '🛒 Savatcha'], ['buyurtmalar', '🧾 Buyurtmalarim'], ['ijaralar', '📖 Ijaralarim'], ['profil', '👤 Profil']],
  admin: [['kitoblar', '📚 Kitoblar'], ['buyurtmalar', '🧾 Buyurtmalar'], ['foydalanuvchilar', '👥 Foydalanuvchilar'], ['zaxira', '💾 Zaxira'], ['profil', '👤 Profil']],
};
const STAT = { kutilmoqda: 'Kutilmoqda', tasdiqlandi: 'Ijarada', 'rad etildi': 'Rad etildi', qaytarildi: 'Qaytarildi' };
const BCLS = { kutilmoqda: 'b-kutilmoqda', tasdiqlandi: 'b-tasdiqlandi', 'rad etildi': 'b-rad', qaytarildi: 'b-qaytarildi' };
const PAY = { naqd: 'Naqd', payme: 'Payme', click: 'Click', karta: 'Karta o‘tkazmasi' };
const PS = { naqd: 'Naqd (olib ketishda)', kutilmoqda: 'To‘lov kutilmoqda', tekshirilmoqda: 'Tekshirilmoqda', tolandi: 'To‘landi' };
const PSC = { naqd: 'b-tasdiqlandi', kutilmoqda: 'b-kutilmoqda', tekshirilmoqda: 'b-tasdiqlandi', tolandi: 'b-faol' };
const money = (n) => Number(n || 0).toLocaleString('ru-RU') + ' so‘m';
const dt = (s) => (s ? String(s).slice(0, 10) : '—');
const ckey = () => 'kx_cart_' + S.me.id;
const cart = () => { try { return JSON.parse(localStorage.getItem(ckey())) || []; } catch { return []; } };
const setCart = (c) => { try { localStorage.setItem(ckey(), JSON.stringify(c)); } catch {} };

function setTheme(t) { document.documentElement.dataset.theme = t; localStorage.setItem('kx_theme', t); $('#theme-btn').textContent = t === 'dark' ? '☀️' : '🌙'; }
setTheme(localStorage.getItem('kx_theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'));
function toast(m, t = '') { const d = document.createElement('div'); d.className = 'toast ' + t; d.textContent = m; $('#toasts').append(d); setTimeout(() => d.remove(), 3500); }
async function api(method, url, body) {
  const r = await fetch('/api' + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { if ((r.status === 401 || r.status === 403) && S.me) { S.me = null; render(); } throw new Error(d.error || 'Xatolik yuz berdi.'); }
  return d;
}
const cover = (b) => { if (b.cover) return `background:url(&quot;${esc(b.cover)}&quot;) center/cover,#ddd`; const h = (b.id * 47) % 360; return `background:linear-gradient(150deg,hsl(${h} 60% 48%),hsl(${(h + 40) % 360} 55% 28%))`; };
const pager = (d) => (d.pages > 1 ? `<div class="pager"><button class="btn sm ghost" data-a="pg" data-v="${d.page - 1}" ${d.page <= 1 ? 'disabled' : ''}>‹ Oldingi</button><span>${d.page} / ${d.pages}</span><button class="btn sm ghost" data-a="pg" data-v="${d.page + 1}" ${d.page >= d.pages ? 'disabled' : ''}>Keyingi ›</button></div>` : '');
const pageQ = () => ({ page: S.pg[S.view] || 1 });
const qs = (o) => new URLSearchParams(o).toString();
const empty = (m) => `<div class="empty">${m}</div>`;

/* ---------- Ko'rinishlar ---------- */
function authView() {
  const L = S.auth === 'login';
  return `<div class="auth-wrap"><div class="auth"><div class="logo"><i>K</i>Kitobxon</div>
  ${S.setup ? '<div class="note">Tizimda hali admin yo‘q. <b>Birinchi ro‘yxatdan o‘tgan hisob admin bo‘ladi</b> — o‘zingiz o‘ylab topgan email va parolni kiriting.</div>' : ''}
  <div class="tabs"><button data-a="tab" data-v="login" class="${L ? 'on' : ''}">Kirish</button><button data-a="tab" data-v="reg" class="${L ? '' : 'on'}">Ro‘yxatdan o‘tish</button></div>
  ${L ? `<form id="lf" novalidate><div id="fe" class="formerr" hidden></div>
    <div><label>Email yoki telefon raqami</label><input name="login" autocomplete="username"></div>
    <div><label>Parol</label><div class="pw"><input name="password" type="password" autocomplete="current-password"><button type="button" data-a="eye">Ko‘rsatish</button></div></div>
    <label class="chk"><input type="checkbox" name="remember" checked> Meni eslab qol</label><button class="btn full">Kirish</button></form>`
  : `<form id="rf" novalidate><div id="fe" class="formerr" hidden></div>
    <div><label>To‘liq ism</label><input name="name" autocomplete="name"></div>
    <div><label>Email</label><input name="email" type="email" autocomplete="email"></div>
    <div><label>Telefon raqami</label><input name="phone" type="tel" placeholder="+998901234567" autocomplete="tel"></div>
    <div><label>Parol</label><div class="pw"><input name="password" type="password" autocomplete="new-password"><button type="button" data-a="eye">Ko‘rsatish</button></div></div>
    <div><label>Parolni tasdiqlang</label><input name="confirm" type="password" autocomplete="new-password"></div>
    <label class="chk"><input type="checkbox" name="terms"> Foydalanish shartlariga roziman</label><button class="btn full">${S.setup ? 'Admin sifatida ro‘yxatdan o‘tish' : 'Ro‘yxatdan o‘tish'}</button></form>`}
  </div></div>`;
}
function navHtml() {
  const n = S.me.role === 'admin' ? S.pending : cart().length;
  return NAV[S.me.role].map(([k, t]) => `<button data-a="nav" data-v="${k}" class="${S.view === k ? 'on' : ''}">${t}${(k === 'savatcha' || (k === 'buyurtmalar' && S.me.role === 'admin')) && n ? ` (${n})` : ''}</button>`).join('');
}
function appView() {
  const m = S.me;
  return `<header class="top"><div class="logo"><i>K</i>Kitobxon</div><div class="who"><b>${esc(m.name)}</b><span class="role">${m.role === 'admin' ? 'Admin' : 'Mijoz'}</span></div>
    <button class="btn ghost sm" data-a="logout">Chiqish</button></header>
  <div class="app"><nav class="side">${navHtml()}</nav><main class="main" id="main">${V[S.view].html()}</main></div>`;
}
const filterBar = (extra = '') => `<div class="bar"><input id="q" value="${esc(S.f.q)}" placeholder="Kitob yoki muallif qidirish…" aria-label="Qidirish">
  <select id="g"><option value="">Barcha janrlar</option>${S.genres.map((g) => `<option ${S.f.g === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
  <select id="av"><option value="">Barchasi</option><option value="1" ${S.f.av ? 'selected' : ''}>Faqat mavjud</option></select>${extra}</div>`;

function ordersTable(d, adm) {
  if (!d.items.length) return empty('Hozircha buyurtmalar yo‘q.');
  const rows = d.items.map((o) => {
    const ok = ['naqd', 'tolandi'].includes(o.pay_status); let act = '—';
    if (adm) act = [
      o.pay_status === 'tekshirilmoqda' ? `<button class="btn sm" data-a="opay" data-id="${o.id}" data-v="1">To‘lovni tasdiqlash</button><button class="btn sm danger" data-a="opay" data-id="${o.id}" data-v="0">To‘lov kelmadi</button>` : '',
      o.status === 'kutilmoqda' ? `<button class="btn sm" data-a="ord" data-id="${o.id}" data-v="tasdiqlandi" ${ok ? '' : 'disabled title="Avval to‘lov tasdiqlansin"'}>Tasdiqlash</button><button class="btn sm danger" data-a="ord" data-id="${o.id}" data-v="rad etildi">Rad etish</button>` : '',
      o.status === 'tasdiqlandi' ? `<button class="btn sm ghost" data-a="ord" data-id="${o.id}" data-v="qaytarildi">Qaytarildi</button>` : ''].join('') || '—';
    else if (o.status === 'kutilmoqda' && o.pay_method !== 'naqd' && o.pay_status === 'kutilmoqda') act = `<button class="btn sm" data-a="paid" data-id="${o.id}">To‘lov qildim</button>`;
    return `<tr><td>${o.id}</td><td>${esc(o.book)}</td>${adm ? `<td>${esc(o.user)}</td>` : ''}<td>${o.days} kun</td><td>${money(o.amount)}</td>
      <td>${PAY[o.pay_method]}<br><span class="badge ${PSC[o.pay_status]}">${PS[o.pay_status]}</span></td><td><span class="badge ${BCLS[o.status]}">${STAT[o.status]}</span></td>
      <td>${dt(o.due)}${o.late > 0 ? `<br><span class="badge b-rad">${o.late} kun kechikdi · jarima ${money(o.fine)}</span>` : ''}</td><td>${act}</td></tr>`;
  }).join('');
  return `<div class="scroll"><table><thead><tr><th>№</th><th>Kitob</th>${adm ? '<th>Mijoz</th>' : ''}<th>Muddat</th><th>Summa</th><th>To‘lov</th><th>Holat</th><th>Qaytarish sanasi</th><th>Amallar</th></tr></thead><tbody>${rows}</tbody></table></div>${pager(d)}`;
}
const cardBox = () => `<div class="paybox"><div><b>To‘lov kartasi:</b> <span class="cardno">${esc(S.cfg.card)}</span></div>
  <div class="sub">Payme, Click yoki bank ilovasi orqali shu kartaga o‘tkazing, so‘ng buyurtmadagi “To‘lov qildim” tugmasini bosing. Admin tushumni tekshirib tasdiqlaydi.</div><button class="btn sm ghost" data-a="copy">Raqamni nusxalash</button></div>`;

const V = {
  kitoblar: {
    html: () => `<h2>${S.me.role === 'admin' ? 'Kitoblarni boshqarish' : 'Kitoblar'}</h2>${filterBar(S.me.role === 'admin' ? '<button class="btn" data-a="new">+ Kitob qo‘shish</button>' : '')}<div id="list"></div>`,
    async load() {
      S.genres = await api('GET', '/genres');
      S.data.books = await api('GET', '/books?' + qs({ q: S.f.q, genre: S.f.g, avail: S.f.av, limit: 12, ...pageQ() }));
    },
    draw() {
      const d = S.data.books, el = $('#list'); if (!el) return;
      if (!d.items.length) return (el.innerHTML = empty('Hech narsa topilmadi. Qidiruv yoki filtrni o‘zgartiring.'));
      if (S.me.role === 'admin') el.innerHTML = `<div class="scroll"><table><thead><tr><th>Muqova</th><th>Nomi</th><th>Muallif</th><th>Janr</th><th>Narx (haftasiga)</th><th>Nusxa</th><th>Amallar</th></tr></thead><tbody>
        ${d.items.map((b) => `<tr><td><div class="thumb" style="${cover(b)}"></div></td><td>${esc(b.title)}</td><td>${esc(b.author)}</td><td>${esc(b.genre)}</td><td>${money(b.price)}</td><td>${b.stock}</td>
        <td><button class="btn sm ghost" data-a="edit" data-id="${b.id}">Tahrirlash</button><button class="btn sm danger" data-a="del" data-id="${b.id}">O‘chirish</button></td></tr>`).join('')}</tbody></table></div>${pager(d)}`;
      else el.innerHTML = `<div class="grid">${d.items.map((b) => `<article class="card"><div class="cover" style="${cover(b)}">${b.cover ? '' : esc(b.title)}</div><h3>${esc(b.title)}</h3><div class="au">${esc(b.author)}</div><span class="tag">${esc(b.genre)}</span>
        <div class="row"><div><div class="price">${money(b.price)} <small>/hafta</small></div><div class="st ${b.stock < 1 ? 'no' : b.stock < 3 ? 'low' : ''}">${b.stock < 1 ? 'Mavjud emas' : b.stock + ' ta mavjud'}</div></div>
        <button class="btn sm ${cart().includes(b.id) ? 'ghost' : ''}" data-a="rent" data-id="${b.id}" ${b.stock < 1 ? 'disabled' : ''}>${cart().includes(b.id) ? 'Savatchada ✓' : 'Ijaraga olish'}</button></div></article>`).join('')}</div>${pager(d)}`;
    },
  },
  savatcha: {
    html: () => '<h2>Savatcha</h2><div id="list"></div>',
    async load() { const ids = cart(); S.data.cart = ids.length ? (await api('GET', '/books?' + qs({ ids: ids.join(','), limit: 50 }))).items : []; },
    draw() {
      const items = S.data.cart, el = $('#list');
      if (!items.length) return (el.innerHTML = empty('Savatchangiz bo‘sh. <a href="#" data-a="nav" data-v="kitoblar" style="color:var(--p);font-weight:700">Kitoblarni ko‘rish</a>'));
      const bad = items.some((b) => b.stock < 1), total = items.reduce((s, b) => s + Math.round(b.price * S.days / 7), 0);
      el.innerHTML = `<div class="scroll"><table><thead><tr><th>Kitob</th><th>Muallif</th><th>${S.days} kunlik narx</th><th>Holat</th><th></th></tr></thead><tbody>
        ${items.map((b) => `<tr><td>${esc(b.title)}</td><td>${esc(b.author)}</td><td>${money(Math.round(b.price * S.days / 7))}</td><td><span class="st ${b.stock < 1 ? 'no' : ''}">${b.stock < 1 ? 'Mavjud emas' : 'Mavjud'}</span></td>
        <td><button class="btn sm danger" data-a="cdel" data-id="${b.id}">Olib tashlash</button></td></tr>`).join('')}</tbody></table></div>
      <div class="panel"><label>Ijara muddati</label><select id="dy">${[7, 14, 21].map((d) => `<option value="${d}" ${S.days === d ? 'selected' : ''}>${d} kun</option>`).join('')}</select>
        <label style="margin-top:14px">To‘lov usuli</label><div class="opts">${[['naqd', 'Naqd', 'Kitobni olib ketganda to‘laysiz'], ['payme', 'Payme', 'Payme orqali kartaga o‘tkazma'], ['click', 'Click', 'Click orqali kartaga o‘tkazma'], ['karta', 'Karta o‘tkazmasi', 'Istalgan bank ilovasi']]
          .map(([v, t, s]) => `<label class="opt ${S.pay === v ? 'on' : ''}"><input type="radio" name="pay" value="${v}" ${S.pay === v ? 'checked' : ''}><span><b>${t}</b><small>${s}</small></span></label>`).join('')}</div>
        ${S.pay !== 'naqd' ? '<p class="sub" style="margin-top:10px">Buyurtmadan keyin karta raqami ko‘rsatiladi. O‘tkazma qilgach “To‘lov qildim” tugmasini bosasiz.</p>' : ''}</div>
      <div class="cartbar"><div><span class="sub">Jami (${items.length} ta kitob, ${S.days} kun):</span> <b class="price">${money(total)}</b><div class="sub">Kechiksangiz, har kun uchun ${money(S.cfg.fine)} jarima.</div>
        ${bad ? '<div class="formerr" style="margin-top:8px">Mavjud bo‘lmagan kitobni savatchadan olib tashlang.</div>' : ''}</div><button class="btn" data-a="checkout" ${bad ? 'disabled' : ''}>Buyurtma berish</button></div>`;
    },
  },
  buyurtmalar: {
    html: () => `<h2>${S.me.role === 'admin' ? 'Buyurtmalar' : 'Buyurtmalarim'}</h2>${S.me.role === 'admin'
      ? `<div class="bar" style="grid-template-columns:1fr"><select id="st"><option value="">Barcha holatlar</option>${Object.entries(STAT).map(([k, v]) => `<option value="${k}" ${S.f.st === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>` : cardBox()}<div id="list"></div>`,
    async load() { S.data.orders = await api('GET', '/orders?' + qs({ status: S.f.st, ...pageQ() })); },
    draw: () => ($('#list').innerHTML = ordersTable(S.data.orders, S.me.role === 'admin')),
  },
  ijaralar: {
    html: () => '<h2>Ijaralarim</h2><div id="list"></div>',
    async load() { S.data.orders = await api('GET', '/orders?' + qs({ status: 'ijara', ...pageQ() })); },
    draw: () => ($('#list').innerHTML = ordersTable(S.data.orders, false)),
  },
  profil: {
    html: () => { const m = S.me; return `<h2>Profil</h2><div class="prof"><p><span>Email</span><b>${esc(m.email)}</b></p><p><span>Ro‘yxatdan o‘tgan sana</span><b>${dt(m.created)}</b></p><p><span>Rol</span><b>${m.role === 'admin' ? 'Admin' : 'Mijoz'}</b></p></div>
      <div class="two" style="margin-top:18px;align-items:start"><form id="pf" class="panel" novalidate><h3>Ma’lumotlarni tahrirlash</h3><div id="fe" class="formerr" hidden></div><div><label>To‘liq ism</label><input name="name" value="${esc(m.name)}"></div>
      <div><label>Telefon raqami</label><input name="phone" value="${esc(m.phone)}"></div><button class="btn">Saqlash</button></form>
      <form id="pwf" class="panel" novalidate><h3>Parolni almashtirish</h3><div id="fe2" class="formerr" hidden></div><div><label>Joriy parol</label><input name="cur" type="password" autocomplete="current-password"></div>
      <div><label>Yangi parol</label><input name="nw" type="password" autocomplete="new-password"></div><div><label>Yangi parolni tasdiqlang</label><input name="cf" type="password" autocomplete="new-password"></div><button class="btn">Parolni yangilash</button></form></div>`; },
    async load() {}, draw() {},
  },
  foydalanuvchilar: {
    html: () => `<h2>Foydalanuvchilar</h2><div class="bar" style="grid-template-columns:1fr"><input id="q" value="${esc(S.f.q)}" placeholder="Ism, email yoki telefon bo‘yicha qidirish…"></div><div id="list"></div>`,
    async load() { S.data.users = await api('GET', '/users?' + qs({ q: S.f.q, ...pageQ() })); },
    draw() {
      const d = S.data.users; if (!d.items.length) return ($('#list').innerHTML = empty('Foydalanuvchi topilmadi.'));
      $('#list').innerHTML = `<div class="scroll"><table><thead><tr><th>Ism</th><th>Email</th><th>Telefon</th><th>Rol</th><th>Holat</th><th>Amallar</th></tr></thead><tbody>
      ${d.items.map((u) => { const me = u.id === S.me.id; return `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.phone)}</td><td>${u.role === 'admin' ? 'Admin' : 'Mijoz'}</td>
        <td><span class="badge ${u.blocked ? 'b-rad' : 'b-faol'}">${u.blocked ? 'Bloklangan' : 'Faol'}</span></td><td>${me ? 'Siz' : (u.role === 'mijoz' ? `<button class="btn sm ${u.blocked ? '' : 'danger'}" data-a="blk" data-id="${u.id}" data-v="${u.blocked ? 0 : 1}">${u.blocked ? 'Blokdan chiqarish' : 'Bloklash'}</button><button class="btn sm ghost" data-a="role" data-id="${u.id}" data-v="admin">Admin qilish</button>`
        : `<button class="btn sm ghost" data-a="role" data-id="${u.id}" data-v="mijoz">Mijoz qilish</button>`)}</td></tr>`; }).join('')}</tbody></table></div>${pager(d)}`;
    },
  },
  zaxira: {
    html: () => '<h2>Ma’lumotlar bazasi zaxirasi</h2><p class="sub" style="margin-bottom:14px">Zaxira server ishga tushganda va har 24 soatda avtomatik olinadi. Oxirgi 7 tasi saqlanadi (<code>backups/</code> papkasi).</p><button class="btn" data-a="bk" style="margin-bottom:14px">Hozir zaxira olish</button><div id="list"></div>',
    async load() { S.data.bk = await api('GET', '/backups'); },
    draw: () => ($('#list').innerHTML = S.data.bk.length ? `<div class="scroll"><table><thead><tr><th>Fayl</th><th>Hajmi</th></tr></thead><tbody>${S.data.bk.map((b) => `<tr><td>${esc(b.name)}</td><td>${(b.size / 1024).toFixed(0)} KB</td></tr>`).join('')}</tbody></table></div>` : empty('Hozircha zaxira yo‘q.')),
  },
};
function draw() { try { V[S.view].draw(); } catch {} const n = $('.side'); if (n && S.me) n.innerHTML = navHtml(); }
async function pend() { if (S.me?.role === 'admin') S.pending = (await api('GET', '/orders?status=kutilmoqda&limit=1')).total; }
async function refresh() { if (!S.me) return; await V[S.view].load(); await pend(); draw(); }
async function show() {
  $('#root').innerHTML = appView();
  try { await refresh(); } catch (e) { if (S.me) toast(e.message, 'er'); }
}
function render() { if (S.me) show(); else $('#root').innerHTML = authView(); }
async function go(v) { S.view = v; S.f = { q: '', g: '', av: '', st: '' }; S.pg[v] = 1; render(); }

/* ---------- Kitob oynasi (admin) ---------- */
function bookModal(id) {
  const b = (S.data.books?.items || []).find((x) => x.id === id) || { title: '', author: '', genre: '', price: 5000, stock: 1, cover: '' };
  const m = $('#modal'); m.hidden = false;
  m.innerHTML = `<div class="box"><h2>${id ? 'Kitobni tahrirlash' : 'Yangi kitob'}</h2><form id="bf" data-id="${id || ''}" novalidate><div id="fe" class="formerr" hidden></div>
    <div><label>Nomi</label><input name="title" value="${esc(b.title)}"></div><div><label>Muallif</label><input name="author" value="${esc(b.author)}"></div><div><label>Janr</label><input name="genre" value="${esc(b.genre)}"></div>
    <div class="two"><div><label>Narx (so‘m/hafta)</label><input name="price" type="number" min="0" step="500" value="${b.price}"></div><div><label>Nusxalar soni</label><input name="stock" type="number" min="0" value="${b.stock}"></div></div>
    <div><label>Muqova rasmi havolasi (ixtiyoriy)</label><input name="cover" placeholder="https://…/muqova.jpg" value="${esc(b.cover)}"></div>
    <div class="acts"><button type="button" class="btn ghost" data-a="close">Bekor qilish</button><button class="btn">Saqlash</button></div></form></div>`;
}
const closeModal = () => { $('#modal').hidden = true; $('#modal').innerHTML = ''; };
const showErr = (m, id = 'fe') => { const e = $('#' + id); if (e) { e.textContent = m; e.hidden = false; } };
const emailOk = (v) => /^\S+@\S+\.\S+$/.test(v), phoneOk = (v) => /^\+?\d{9,15}$/.test(v.replace(/[\s()-]/g, ''));
async function enter(user, msg) { S.me = user; S.view = 'kitoblar'; S.f = { q: '', g: '', av: '', st: '' }; S.pg = {}; render(); toast(msg, 'ok'); }

/* ---------- Hodisalar ---------- */
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-a]'); if (!t) return;
  const a = t.dataset.a, id = +t.dataset.id, v = t.dataset.v, ok = (m) => toast(m, 'ok');
  try {
    if (a === 'theme') setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    else if (a === 'tab') { S.auth = v; render(); }
    else if (a === 'eye') { const i = t.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; t.textContent = i.type === 'password' ? 'Ko‘rsatish' : 'Yashirish'; }
    else if (a === 'nav') go(v);
    else if (a === 'logout') { await api('POST', '/logout'); S.me = null; S.auth = 'login'; render(); toast('Tizimdan chiqdingiz.'); }
    else if (a === 'close') closeModal();
    else if (a === 'new') bookModal(0);
    else if (a === 'edit') bookModal(id);
    else if (a === 'pg') { S.pg[S.view] = +v; await refresh(); scrollTo({ top: 0, behavior: 'smooth' }); }
    else if (a === 'copy') { try { await navigator.clipboard.writeText(S.cfg.card.replace(/\s/g, '')); ok('Karta raqami nusxalandi.'); } catch { toast('Nusxalab bo‘lmadi. Raqamni qo‘lda belgilang.', 'er'); } }
    else if (a === 'del') { if (confirm('Bu kitobni o‘chirmoqchimisiz?')) { await api('DELETE', '/books/' + id); await refresh(); ok('Kitob o‘chirildi.'); } }
    else if (a === 'rent') { const c = cart(); if (c.includes(id)) toast('Bu kitob allaqachon savatchada.'); else { setCart([...c, id]); draw(); ok('Kitob savatchaga qo‘shildi.'); } }
    else if (a === 'cdel') { setCart(cart().filter((i) => i !== id)); await refresh(); toast('Savatchadan olib tashlandi.'); }
    else if (a === 'checkout') {
      const ids = S.data.cart.map((b) => b.id); if (!ids.length) return; t.disabled = true;
      await api('POST', '/orders', { bookIds: ids, days: S.days, payMethod: S.pay }); setCart([]);
      await go('buyurtmalar'); ok(S.pay === 'naqd' ? 'Buyurtma yuborildi. Admin tasdiqlashini kuting.' : 'Buyurtma yuborildi. Kartaga o‘tkazib, “To‘lov qildim” tugmasini bosing.');
    }
    else if (a === 'paid') { await api('POST', `/orders/${id}/paid`); await refresh(); ok('To‘lov admin tekshiruviga yuborildi.'); }
    else if (a === 'opay') { await api('PATCH', `/orders/${id}/pay`, { ok: v === '1' }); await refresh(); ok(v === '1' ? 'To‘lov tasdiqlandi.' : 'To‘lov kelmagan deb belgilandi.'); }
    else if (a === 'ord') { await api('PATCH', '/orders/' + id, { status: v }); await refresh(); ok('Buyurtma holati yangilandi.'); }
    else if (a === 'blk') { await api('PATCH', `/users/${id}/block`, { blocked: v === '1' }); await refresh(); ok(v === '1' ? 'Foydalanuvchi bloklandi.' : 'Blokdan chiqarildi.'); }
    else if (a === 'role') { if (confirm(v === 'admin' ? 'Bu foydalanuvchini admin qilasizmi?' : 'Adminlik huquqi olib tashlansinmi?')) { await api('PATCH', `/users/${id}/role`, { role: v }); await refresh(); ok('Rol yangilandi.'); } }
    else if (a === 'bk') { await api('POST', '/backups'); await refresh(); ok('Zaxira nusxa yaratildi.'); }
  } catch (err) { toast(err.message, 'er'); try { await refresh(); } catch {} }
});
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
const refilter = () => { S.pg[S.view] = 1; refresh().catch((e) => toast(e.message, 'er')); };
document.addEventListener('input', (e) => { if (e.target.id === 'q') { clearTimeout(S.tm); S.tm = setTimeout(() => { S.f.q = e.target.value; refilter(); }, 300); } });
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'g' || t.id === 'av' || t.id === 'st') { S.f[t.id] = t.value; refilter(); }
  else if (t.id === 'dy') { S.days = +t.value; draw(); } else if (t.name === 'pay') { S.pay = t.value; draw(); }
});
document.addEventListener('submit', async (e) => {
  e.preventDefault(); const f = e.target, d = Object.fromEntries(new FormData(f)), btn = $('.btn:not(.ghost)', f), eid = f.id === 'pwf' ? 'fe2' : 'fe';
  let url, body, err = '';
  if (f.id === 'lf') {
    if (!d.login.trim() || !d.password) err = 'Email/telefon va parolni kiriting.';
    else if (!emailOk(d.login) && !phoneOk(d.login)) err = 'Email yoki telefon raqami noto‘g‘ri.';
    url = '/login'; body = { login: d.login, password: d.password, remember: !!d.remember };
  } else if (f.id === 'rf') {
    if (!d.name.trim() || !d.email.trim() || !d.phone.trim() || !d.password || !d.confirm) err = 'Barcha maydonlarni to‘ldiring.';
    else if (!emailOk(d.email)) err = 'Email formati noto‘g‘ri.';
    else if (!phoneOk(d.phone)) err = 'Telefon raqami noto‘g‘ri.';
    else if (d.password.length < 6) err = 'Parol kamida 6 belgidan iborat bo‘lsin.';
    else if (d.password !== d.confirm) err = 'Parollar bir xil emas.';
    else if (!d.terms) err = 'Foydalanish shartlariga rozilik bering.';
    url = '/register'; body = { name: d.name, email: d.email, phone: d.phone, password: d.password };
  } else if (f.id === 'bf') {
    if (!d.title.trim() || !d.author.trim() || !d.genre.trim()) err = 'Nom, muallif va janrni kiriting.';
    else if (d.price === '' || d.stock === '' || !(+d.price >= 0) || !(+d.stock >= 0)) err = 'Narx va nusxalar sonini to‘g‘ri kiriting.';
    else if (d.cover.trim() && !/^https?:\/\/\S+$/i.test(d.cover.trim())) err = 'Rasm havolasi http:// yoki https:// bilan boshlansin.';
  } else if (f.id === 'pf') { if (!d.name.trim() || !phoneOk(d.phone)) err = 'Ism va telefon raqamini to‘g‘ri kiriting.'; }
  else if (f.id === 'pwf') {
    if (!d.cur || !d.nw) err = 'Joriy va yangi parolni kiriting.'; else if (d.nw.length < 6) err = 'Yangi parol kamida 6 belgidan iborat bo‘lsin.'; else if (d.nw !== d.cf) err = 'Yangi parollar bir xil emas.';
  } else return;
  if (err) return showErr(err, eid);
  btn.disabled = true;
  try {
    if (f.id === 'bf') {
      const p = { ...d, price: +d.price, stock: +d.stock };
      f.dataset.id ? await api('PUT', '/books/' + f.dataset.id, p) : await api('POST', '/books', p);
      closeModal(); await refresh(); toast('Kitob saqlandi.', 'ok');
    } else if (f.id === 'pf') { S.me = await api('PUT', '/me', { name: d.name, phone: d.phone }); render(); toast('Profil yangilandi.', 'ok'); }
    else if (f.id === 'pwf') { await api('PUT', '/me', { currentPassword: d.cur, newPassword: d.nw }); f.reset(); btn.disabled = false; toast('Parol yangilandi.', 'ok'); }
    else {
      const u = await api('POST', url, body); S.setup = false;
      await enter(u, f.id === 'rf' ? (u.role === 'admin' ? 'Admin hisobi yaratildi!' : 'Ro‘yxatdan muvaffaqiyatli o‘tdingiz!') : 'Xush kelibsiz!');
    }
  } catch (x) { showErr(x.message, eid); btn.disabled = false; }
});

/* Ishga tushirish: sessiyani tiklash + har 8 soniyada sinxronlash */
(async () => {
  try { S.me = await api('GET', '/me'); S.cfg = await api('GET', '/config'); }
  catch { S.me = null; try { S.setup = (await api('GET', '/setup')).needsAdmin; if (S.setup) S.auth = 'reg'; } catch {} }
  render();
  setInterval(() => { if (S.me && !document.hidden) refresh().catch(() => {}); }, 8000);
})();

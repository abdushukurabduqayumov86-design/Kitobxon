// Kitobxon backend: Express + SQLite (better-sqlite3) + bcrypt + JWT (httpOnly cookie).
// Rol (admin/mijoz) FAQAT bazadan olinadi — mijoz o'zini admin qila olmaydi.
const express = require('express'), bcrypt = require('bcrypt'), jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser'), Database = require('better-sqlite3'), path = require('path'), fs = require('fs');
const SECRET = process.env.JWT_SECRET || 'ISHLAB-CHIQARISHDA-ALMASHTIRING';
const FINE = Number(process.env.FINE_PER_DAY) || 1000;                       // kechikish jarimasi (so'm/kun)
const CARD = (process.env.CARD_NUMBER || '5614681813119538').replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
const db = new Database(path.join(__dirname, 'kitobxon-v2.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE, phone TEXT UNIQUE, hash TEXT,
  role TEXT DEFAULT 'mijoz', blocked INTEGER DEFAULT 0, created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS books(id INTEGER PRIMARY KEY, title TEXT, author TEXT, genre TEXT, price INTEGER, stock INTEGER, cover TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, user_id INTEGER, book_id INTEGER, status TEXT DEFAULT 'kutilmoqda',
  days INTEGER, amount INTEGER, pay_method TEXT, pay_status TEXT, due TEXT, fine INTEGER DEFAULT 0, late_days INTEGER DEFAULT 0,
  created TEXT DEFAULT CURRENT_TIMESTAMP, updated TEXT);
CREATE INDEX IF NOT EXISTS ix_o_user ON orders(user_id); CREATE INDEX IF NOT EXISTS ix_o_status ON orders(status);`);

const SEED = `O‘tkan kunlar|Abdulla Qodiriy|Roman;Mehrobdan chayon|Abdulla Qodiriy|Roman;Kecha va kunduz|Cho‘lpon|Roman;Sariq devni minib|Xudoyberdi To‘xtaboyev|Bolalar;Shirin qovunlar mamlakati|Xudoyberdi To‘xtaboyev|Bolalar;Ikki eshik orasi|O‘tkir Hoshimov|Roman;Dunyoning ishlari|O‘tkir Hoshimov|Hikoyalar;Tushda kechgan umrlar|O‘tkir Hoshimov|Roman;Shaytanat|Tohir Malik|Detektiv;Ulug‘bek xazinasi|Odil Yoqubov|Tarix;Xamsa|Alisher Navoiy|She’riyat;Boburnoma|Zahiriddin Bobur|Tarix;Qutadg‘u bilig|Yusuf Xos Hojib|Falsafa;Mantiq ut-tayr|Alisher Navoiy|She’riyat;Ming bir kecha|Xalq ijodi|Hikoyalar;Ufq|Said Ahmad|Roman;Jamila|Chingiz Aytmatov|Roman;Alkimyogar|Paulo Koelo|Falsafa;Kichik shahzoda|Antuan de Sent-Ekzyuperi|Bolalar;1984|Jorj Oruell|Fantastika;Hayvonlar fermasi|Jorj Oruell|Fantastika;Atom odatlar|Jeyms Klir|Rivojlanish;Boy ota, kambag‘al ota|Robert Kiyosaki|Rivojlanish;Usta va Margarita|Mixail Bulgakov|Roman;Jinoyat va jazo|Fyodor Dostoyevskiy|Roman;Urush va tinchlik|Lev Tolstoy|Roman;Anna Karenina|Lev Tolstoy|Roman;Qariya va dengiz|Ernest Xeminguey|Roman;Buyuk Getsbi|Frensis Fitsjerald|Roman;Sherlok Xolms sarguzashtlari|Artur Konan Doyl|Detektiv;Garri Potter va falsafa toshi|Dj. K. Rouling|Fantastika;Uch mushketyor|Aleksandr Dyuma|Roman;Graf Monte-Kristo|Aleksandr Dyuma|Roman;Robinzon Kruzo|Daniel Defo|Bolalar;Xobbit|Dj. R. R. Tolkin|Fantastika;Fahrenheit 451|Rey Bredberi|Fantastika;Sapiens|Yuval Noy Harari|Tarix;Dorian Greyning portreti|Oskar Uayld|Roman;Gulliverning sayohatlari|Jonatan Svift|Fantastika`;
if (!db.prepare('SELECT COUNT(*) c FROM books').get().c) {
  const ins = db.prepare('INSERT INTO books(title,author,genre,price,stock) VALUES(?,?,?,?,?)');
  SEED.split(';').forEach((r, i) => { const [t, a, g] = r.split('|'); ins.run(t, a, g, 5000 + (i % 8) * 1000, 1 + ((i * 3) % 8)); });
}

// Zaxira: ishga tushganda va har 24 soatda; oxirgi 7 tasi saqlanadi
const BK = path.join(__dirname, 'backups'); fs.mkdirSync(BK, { recursive: true });
async function backup() {
  const f = path.join(BK, 'kitobxon-' + new Date().toISOString().replace(/[:.]/g, '-') + '.db');
  await db.backup(f);
  fs.readdirSync(BK).filter((x) => x.endsWith('.db')).sort().slice(0, -7).forEach((x) => fs.unlinkSync(path.join(BK, x)));
  return path.basename(f);
}
backup().catch(console.error); setInterval(() => backup().catch(console.error), 864e5);

const app = express();
app.use(express.json()); app.use(cookieParser()); app.use(express.static(path.join(__dirname, 'public')));
const h = (f) => (q, s) => Promise.resolve().then(() => f(q, s)).catch((e) => { console.error(e); s.status(500).json({ error: 'Server xatosi.' }); });
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, created: u.created });
const np = (p) => (p || '').replace(/[\s()-]/g, '');
const pg = (x, def) => { const l = Math.min(50, Math.max(1, +x.limit || def)), p = Math.max(1, +x.page || 1); return [l, (p - 1) * l, p]; };
const out = (items, total, l, p) => ({ items, total, page: p, pages: Math.max(1, Math.ceil(total / l)) });
const hasAdmin = () => !!db.prepare("SELECT 1 FROM users WHERE role='admin'").get();
function auth(q, s, n) {
  let u;
  try { u = db.prepare('SELECT * FROM users WHERE id=?').get(jwt.verify(q.cookies.token, SECRET).id); } catch {}
  if (!u) return s.status(401).json({ error: 'Tizimga kiring.' });
  if (u.blocked) return s.status(403).json({ error: 'Hisobingiz bloklangan.' });
  q.user = u; n();
}
const admin = (q, s, n) => (q.user.role === 'admin' ? n() : s.status(403).json({ error: 'Bu amal faqat admin uchun.' }));
function session(s, u, remember) {
  s.cookie('token', jwt.sign({ id: u.id }, SECRET, { expiresIn: remember ? '30d' : '1d' }),
    { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', ...(remember ? { maxAge: 30 * 864e5 } : {}) });
}
const today = () => new Date().toISOString().slice(0, 10);
const lateDays = (due) => Math.max(0, Math.floor((Date.parse(today()) - Date.parse(due)) / 864e5));

app.get('/api/setup', (q, s) => s.json({ needsAdmin: !hasAdmin() }));
app.post('/api/register', h(async (q, s) => {
  const { name, email, phone, password } = q.body || {};
  if (!name?.trim() || !email || !phone || !password) return s.status(400).json({ error: 'Barcha maydonlarni to‘ldiring.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return s.status(400).json({ error: 'Email formati noto‘g‘ri.' });
  if (!/^\+?\d{9,15}$/.test(np(phone))) return s.status(400).json({ error: 'Telefon raqami noto‘g‘ri.' });
  if (password.length < 6) return s.status(400).json({ error: 'Parol kamida 6 belgidan iborat bo‘lsin.' });
  const e = email.trim().toLowerCase(), p = np(phone);
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(e)) return s.status(409).json({ error: 'Bu email allaqachon ro‘yxatdan o‘tgan.' });
  if (db.prepare('SELECT 1 FROM users WHERE phone=?').get(p)) return s.status(409).json({ error: 'Bu telefon raqami allaqachon ro‘yxatdan o‘tgan.' });
  const hash = await bcrypt.hash(password, 12);
  const role = hasAdmin() ? 'mijoz' : 'admin';   // birinchi hisob — admin (tekshiruv va yozish orasida await yo'q)
  const id = db.prepare('INSERT INTO users(name,email,phone,hash,role) VALUES(?,?,?,?,?)').run(name.trim(), e, p, hash, role).lastInsertRowid;
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(id); session(s, u, true); s.status(201).json(pub(u));
}));
app.post('/api/login', h(async (q, s) => {
  const { login, password, remember } = q.body || {};
  if (!login || !password) return s.status(400).json({ error: 'Email/telefon va parolni kiriting.' });
  const u = db.prepare('SELECT * FROM users WHERE email=? OR phone=?').get(login.trim().toLowerCase(), np(login));
  if (!u || !(await bcrypt.compare(password, u.hash))) return s.status(401).json({ error: 'Email/telefon yoki parol noto‘g‘ri.' });
  if (u.blocked) return s.status(403).json({ error: 'Hisobingiz bloklangan. Admin bilan bog‘laning.' });
  session(s, u, !!remember); s.json(pub(u));
}));
app.post('/api/logout', (q, s) => { s.clearCookie('token'); s.json({ ok: true }); });
app.get('/api/me', auth, (q, s) => s.json(pub(q.user)));
app.get('/api/config', auth, (q, s) => s.json({ card: CARD, fine: FINE }));

// Profilni tahrirlash: ism/telefon yoki parol almashtirish
app.put('/api/me', auth, h(async (q, s) => {
  const { name, phone, currentPassword, newPassword } = q.body || {};
  if (newPassword !== undefined) {
    if (String(newPassword).length < 6) return s.status(400).json({ error: 'Yangi parol kamida 6 belgidan iborat bo‘lsin.' });
    if (!(await bcrypt.compare(currentPassword || '', q.user.hash))) return s.status(400).json({ error: 'Joriy parol noto‘g‘ri.' });
    db.prepare('UPDATE users SET hash=? WHERE id=?').run(await bcrypt.hash(newPassword, 12), q.user.id);
    return s.json({ ok: true });
  }
  if (!name?.trim() || !/^\+?\d{9,15}$/.test(np(phone))) return s.status(400).json({ error: 'Ism va telefon raqamini to‘g‘ri kiriting.' });
  if (db.prepare('SELECT 1 FROM users WHERE phone=? AND id<>?').get(np(phone), q.user.id)) return s.status(409).json({ error: 'Bu telefon raqami band.' });
  db.prepare('UPDATE users SET name=?,phone=? WHERE id=?').run(name.trim(), np(phone), q.user.id);
  s.json(pub(db.prepare('SELECT * FROM users WHERE id=?').get(q.user.id)));
}));

// Kitoblar (sahifalash + qidiruv + filtr serverda)
app.get('/api/books', auth, (q, s) => {
  const [l, o, p] = pg(q.query, 12), { q: t, genre, avail, ids } = q.query, w = [], a = [];
  if (t) { w.push('(title LIKE ? OR author LIKE ?)'); a.push(`%${t}%`, `%${t}%`); }
  if (genre) { w.push('genre=?'); a.push(genre); }
  if (avail) w.push('stock>0');
  if (ids) { const L = String(ids).split(',').map(Number).filter(Number.isInteger).slice(0, 50); w.push(`id IN (${L.map(() => '?').join(',') || 'NULL'})`); a.push(...L); }
  const W = w.length ? 'WHERE ' + w.join(' AND ') : '';
  s.json(out(db.prepare(`SELECT * FROM books ${W} ORDER BY id LIMIT ? OFFSET ?`).all(...a, l, o), db.prepare(`SELECT COUNT(*) c FROM books ${W}`).get(...a).c, l, p));
});
app.get('/api/genres', auth, (q, s) => s.json(db.prepare('SELECT DISTINCT genre FROM books ORDER BY genre').all().map((x) => x.genre)));
function bookData(b = {}) {
  const t = String(b.title || '').trim(), a = String(b.author || '').trim(), g = String(b.genre || '').trim(), p = Number(b.price), k = Number(b.stock), c = String(b.cover || '').trim();
  if (!t || !a || !g) return 'Nom, muallif va janrni kiriting.';
  if (!Number.isInteger(p) || p < 0 || !Number.isInteger(k) || k < 0) return 'Narx va nusxalar soni 0 yoki undan katta butun son bo‘lsin.';
  if (c && !/^https?:\/\/\S+$/i.test(c)) return 'Muqova rasmi havolasi http:// yoki https:// bilan boshlansin.';
  return [t, a, g, p, k, c];
}
app.post('/api/books', auth, admin, (q, s) => {
  const d = bookData(q.body); if (typeof d === 'string') return s.status(400).json({ error: d });
  s.status(201).json({ id: db.prepare('INSERT INTO books(title,author,genre,price,stock,cover) VALUES(?,?,?,?,?,?)').run(...d).lastInsertRowid });
});
app.put('/api/books/:id', auth, admin, (q, s) => {
  const d = bookData(q.body); if (typeof d === 'string') return s.status(400).json({ error: d });
  if (!db.prepare('UPDATE books SET title=?,author=?,genre=?,price=?,stock=?,cover=? WHERE id=?').run(...d, q.params.id).changes) return s.status(404).json({ error: 'Kitob topilmadi.' });
  s.json({ ok: true });
});
app.delete('/api/books/:id', auth, admin, (q, s) => {
  if (db.prepare("SELECT 1 FROM orders WHERE book_id=? AND status IN ('kutilmoqda','tasdiqlandi')").get(q.params.id))
    return s.status(409).json({ error: 'Bu kitobda faol buyurtma bor. Avval buyurtmalarni yakunlang.' });
  db.prepare('DELETE FROM books WHERE id=?').run(q.params.id); s.json({ ok: true });
});

// Buyurtmalar
const shape = (o) => { const late = o.status === 'qaytarildi' ? o.late_days : o.status === 'tasdiqlandi' && o.due ? lateDays(o.due) : 0; return { ...o, late, fine: o.status === 'qaytarildi' ? o.fine : late * FINE }; };
app.get('/api/orders', auth, (q, s) => {
  const [l, o, p] = pg(q.query, 10), w = [], a = [], st = q.query.status;
  if (q.user.role !== 'admin') { w.push('o.user_id=?'); a.push(q.user.id); }
  if (st === 'ijara') w.push("o.status IN ('tasdiqlandi','qaytarildi')"); else if (st) { w.push('o.status=?'); a.push(st); }
  const W = w.length ? 'WHERE ' + w.join(' AND ') : '';
  const rows = db.prepare(`SELECT o.*,COALESCE(b.title,'O‘chirilgan kitob') book,u.name user FROM orders o LEFT JOIN books b ON b.id=o.book_id JOIN users u ON u.id=o.user_id ${W} ORDER BY o.id DESC LIMIT ? OFFSET ?`).all(...a, l, o);
  s.json(out(rows.map(shape), db.prepare(`SELECT COUNT(*) c FROM orders o ${W}`).get(...a).c, l, p));
});
app.post('/api/orders', auth, (q, s) => {
  if (q.user.role === 'admin') return s.status(403).json({ error: 'Admin kitob ijaraga ola olmaydi.' });
  const ids = [...new Set((Array.isArray(q.body?.bookIds) ? q.body.bookIds : [q.body?.bookId]).map(Number))], days = Number(q.body?.days), pm = q.body?.payMethod;
  if (!ids.length || ids.length > 20 || ids.some((i) => !Number.isInteger(i))) return s.status(400).json({ error: 'Savatcha bo‘sh yoki noto‘g‘ri.' });
  if (![7, 14, 21].includes(days)) return s.status(400).json({ error: 'Ijara muddatini tanlang.' });
  if (!['naqd', 'payme', 'click', 'karta'].includes(pm)) return s.status(400).json({ error: 'To‘lov usulini tanlang.' });
  const r = db.transaction(() => {
    const books = [];
    for (const id of ids) {   // avval hammasi tekshiriladi — yoki hammasi yoziladi, yoki hech biri
      const b = db.prepare('SELECT * FROM books WHERE id=?').get(id);
      if (!b) return [404, 'Savatchadagi kitob topilmadi.'];
      if (b.stock < 1) return [409, `“${b.title}” hozir mavjud emas.`];
      if (db.prepare("SELECT 1 FROM orders WHERE user_id=? AND book_id=? AND status IN ('kutilmoqda','tasdiqlandi')").get(q.user.id, id)) return [409, `“${b.title}” uchun faol buyurtmangiz bor.`];
      books.push(b);
    }
    for (const b of books) {
      db.prepare('UPDATE books SET stock=stock-1 WHERE id=?').run(b.id);
      db.prepare('INSERT INTO orders(user_id,book_id,days,amount,pay_method,pay_status) VALUES(?,?,?,?,?,?)').run(q.user.id, b.id, days, Math.round(b.price * days / 7), pm, pm === 'naqd' ? 'naqd' : 'kutilmoqda');
    }
    return [201];
  })();
  s.status(r[0]).json(r[1] ? { error: r[1] } : { ok: true });
});
// Mijoz: "To'lov qildim"
app.post('/api/orders/:id/paid', auth, (q, s) => {
  const ch = db.prepare("UPDATE orders SET pay_status='tekshirilmoqda' WHERE id=? AND user_id=? AND status='kutilmoqda' AND pay_method<>'naqd' AND pay_status='kutilmoqda'").run(q.params.id, q.user.id).changes;
  ch ? s.json({ ok: true }) : s.status(400).json({ error: 'Bu buyurtma uchun to‘lovni belgilab bo‘lmaydi.' });
});
// Admin: to'lovni tasdiqlash / "to'lov kelmadi"
app.patch('/api/orders/:id/pay', auth, admin, (q, s) => {
  const ch = db.prepare("UPDATE orders SET pay_status=? WHERE id=? AND pay_status='tekshirilmoqda'").run(q.body?.ok ? 'tolandi' : 'kutilmoqda', q.params.id).changes;
  ch ? s.json({ ok: true }) : s.status(400).json({ error: 'To‘lov tekshiruv holatida emas.' });
});
app.patch('/api/orders/:id', auth, admin, (q, s) => {
  const st = q.body?.status;
  const r = db.transaction(() => {
    const o = db.prepare('SELECT * FROM orders WHERE id=?').get(q.params.id);
    if (!o) return [404, 'Buyurtma topilmadi.'];
    const ok = (o.status === 'kutilmoqda' && (st === 'tasdiqlandi' || st === 'rad etildi')) || (o.status === 'tasdiqlandi' && st === 'qaytarildi');
    if (!ok) return [400, 'Bu holatga o‘tkazib bo‘lmaydi.'];
    if (st === 'tasdiqlandi') {
      if (!['naqd', 'tolandi'].includes(o.pay_status)) return [400, 'Avval to‘lovni tasdiqlang.'];
      db.prepare("UPDATE orders SET status=?,due=?,updated=datetime('now') WHERE id=?").run(st, new Date(Date.now() + o.days * 864e5).toISOString().slice(0, 10), o.id);
    } else if (st === 'qaytarildi') {
      const late = lateDays(o.due);
      db.prepare("UPDATE orders SET status=?,late_days=?,fine=?,updated=datetime('now') WHERE id=?").run(st, late, late * FINE, o.id);
      db.prepare('UPDATE books SET stock=stock+1 WHERE id=?').run(o.book_id);
    } else {
      db.prepare("UPDATE orders SET status=?,updated=datetime('now') WHERE id=?").run(st, o.id);
      db.prepare('UPDATE books SET stock=stock+1 WHERE id=?').run(o.book_id);
    }
    return [200];
  })();
  s.status(r[0]).json(r[1] ? { error: r[1] } : { ok: true });
});

// Foydalanuvchilar
app.get('/api/users', auth, admin, (q, s) => {
  const [l, o, p] = pg(q.query, 10), t = q.query.q, W = t ? 'WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?' : '', a = t ? [`%${t}%`, `%${t}%`, `%${t}%`] : [];
  s.json(out(db.prepare(`SELECT id,name,email,phone,role,blocked,created FROM users ${W} ORDER BY id LIMIT ? OFFSET ?`).all(...a, l, o), db.prepare(`SELECT COUNT(*) c FROM users ${W}`).get(...a).c, l, p));
});
app.patch('/api/users/:id/block', auth, admin, (q, s) => {
  const ch = db.prepare("UPDATE users SET blocked=? WHERE id=? AND role='mijoz'").run(q.body?.blocked ? 1 : 0, q.params.id).changes;
  ch ? s.json({ ok: true }) : s.status(404).json({ error: 'Mijoz topilmadi.' });
});
app.patch('/api/users/:id/role', auth, admin, (q, s) => {   // yangi admin tayinlash / mijozga qaytarish
  if (+q.params.id === q.user.id) return s.status(400).json({ error: 'O‘z rolingizni o‘zgartira olmaysiz.' });
  const ch = db.prepare('UPDATE users SET role=?,blocked=0 WHERE id=?').run(q.body?.role === 'admin' ? 'admin' : 'mijoz', q.params.id).changes;
  ch ? s.json({ ok: true }) : s.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
});

// Zaxira nusxalar
app.get('/api/backups', auth, admin, (q, s) => s.json(fs.readdirSync(BK).filter((x) => x.endsWith('.db')).sort().reverse().map((n) => ({ name: n, size: fs.statSync(path.join(BK, n)).size }))));
app.post('/api/backups', auth, admin, h(async (q, s) => s.json({ name: await backup() })));

app.listen(process.env.PORT || 3000, () => console.log('Kitobxon: http://localhost:' + (process.env.PORT || 3000)));

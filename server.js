const express = require("express");
const cors    = require("cors");
const crypto  = require("crypto");
const path    = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 4000;

// ── DATABASE SETUP ────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, "plyk.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    category    TEXT    NOT NULL DEFAULT 'Lainnya',
    price       INTEGER NOT NULL,
    discount    INTEGER NOT NULL DEFAULT 0,
    stock       TEXT    NOT NULL DEFAULT 'Ready',
    contact     TEXT    NOT NULL,
    contactType TEXT    NOT NULL DEFAULT 'whatsapp',
    image       TEXT    NOT NULL DEFAULT '',
    createdAt   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// Seed jika kosong
const count = db.prepare("SELECT COUNT(*) as c FROM products").get();
if (count.c === 0) {
  const insert = db.prepare(`
    INSERT INTO products (name, category, price, discount, stock, contact, contactType, image)
    VALUES (@name, @category, @price, @discount, @stock, @contact, @contactType, @image)
  `);
  const seedMany = db.transaction((items) => items.forEach(i => insert.run(i)));
  seedMany([
    { name:"Akun ML Sultan",           category:"Mobile Legends", price:150000, discount:0,  stock:"Ready",    contact:"6281234567890", contactType:"whatsapp", image:"https://upload.wikimedia.org/wikipedia/en/6/6e/Mobile_Legends_Bang_Bang.png" },
    { name:"Diamond Slr Member Emerald",category:"Minecraft",     price:50000,  discount:20, stock:"Ready",    contact:"6281234567890", contactType:"whatsapp", image:"https://upload.wikimedia.org/wikipedia/en/4/49/Minecraft_cover.png" },
    { name:"Akun Valorant Skin Wep",   category:"Valorant",       price:650000, discount:0,  stock:"Ready",    contact:"6281234567890", contactType:"telegram", image:"https://upload.wikimedia.org/wikipedia/en/thumb/5/5f/Valorant_official_game_poster.jpg/220px-Valorant_official_game_poster.jpg" },
    { name:"Voucher Gaming 20Rb",      category:"Voucher",        price:20000,  discount:0,  stock:"Ready",    contact:"6281234567890", contactType:"whatsapp", image:"https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Telkomsel_2021.svg/1200px-Telkomsel_2021.svg.png" },
    { name:"Credentials Prime Video",  category:"Streaming",      price:10000,  discount:50, stock:"Habis",    contact:"6281234567890", contactType:"telegram", image:"https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Amazon_Prime_Video_logo.svg/1200px-Amazon_Prime_Video_logo.svg.png" },
    { name:"Top Up Steam Wallet 100K", category:"Steam",          price:100000, discount:0,  stock:"Pre-order",contact:"6281234567890", contactType:"whatsapp", image:"https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/512px-Steam_icon_logo.svg.png" },
  ]);
}

// ── AUTH ──────────────────────────────────────────────────────────────
// PIN  : 1612  | PASS: PlykAdmin_16  (SHA-256)
const HASH_PIN  = "76ced5b53829bb4ca8ab376be09683e92512ef0aab8fb68fcee5121596f94143";
const HASH_PASS = "8e03bd0fac273783b443ceff78b9dd612e853508223751b3b1f49b9a50f1cc00";

const sha256 = (str) => crypto.createHash("sha256").update(str).digest("hex");

// Simple in-memory session (cukup untuk single-admin)
const sessions = new Set();
const genToken = () => crypto.randomBytes(32).toString("hex");

// Brute-force protection
const failMap = new Map(); // ip → { count, lockedUntil }
const MAX_FAIL = 3;
const LOCK_MS  = 5 * 60 * 1000;

function checkLock(ip) {
  const f = failMap.get(ip);
  if (!f) return false;
  if (f.lockedUntil && Date.now() < f.lockedUntil) return true;
  if (f.lockedUntil && Date.now() >= f.lockedUntil) { failMap.delete(ip); return false; }
  return false;
}
function recordFail(ip) {
  const f = failMap.get(ip) || { count: 0 };
  f.count++;
  if (f.count >= MAX_FAIL) f.lockedUntil = Date.now() + LOCK_MS;
  failMap.set(ip, f);
}
function clearFail(ip) { failMap.delete(ip); }

function authMiddleware(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!token || !sessions.has(token)) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ── MIDDLEWARE ────────────────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json());

// ── AUTH ROUTES ───────────────────────────────────────────────────────
app.post("/api/auth/verify-pin", (req, res) => {
  const ip = req.ip;
  if (checkLock(ip)) return res.status(429).json({ error: "Terlalu banyak percobaan. Tunggu 5 menit." });
  const { pin } = req.body;
  if (sha256(String(pin)) === HASH_PIN) {
    clearFail(ip);
    return res.json({ ok: true });
  }
  recordFail(ip);
  const f = failMap.get(ip) || {};
  const remaining = MAX_FAIL - (f.count || 0);
  res.status(401).json({ error: "PIN salah", remaining: Math.max(remaining, 0) });
});

app.post("/api/auth/login", (req, res) => {
  const ip = req.ip;
  if (checkLock(ip)) return res.status(429).json({ error: "Terlalu banyak percobaan. Tunggu 5 menit." });
  const { password } = req.body;
  if (sha256(String(password)) === HASH_PASS) {
    clearFail(ip);
    const token = genToken();
    sessions.add(token);
    return res.json({ ok: true, token });
  }
  recordFail(ip);
  const f = failMap.get(ip) || {};
  const remaining = MAX_FAIL - (f.count || 0);
  res.status(401).json({ error: "Password salah", remaining: Math.max(remaining, 0) });
});

app.post("/api/auth/logout", (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

// ── PRODUCT ROUTES ────────────────────────────────────────────────────
// GET all (public)
app.get("/api/products", (req, res) => {
  const { category, stock } = req.query;
  let q = "SELECT * FROM products WHERE 1=1";
  const params = [];
  if (category && category !== "Semua") { q += " AND category = ?"; params.push(category); }
  if (stock    && stock    !== "Semua") { q += " AND stock = ?";    params.push(stock); }
  q += " ORDER BY createdAt DESC";
  res.json(db.prepare(q).all(...params));
});

// GET categories (public)
app.get("/api/categories", (req, res) => {
  const rows = db.prepare("SELECT DISTINCT category FROM products ORDER BY category").all();
  res.json(["Semua", ...rows.map(r => r.category)]);
});

// POST add (admin)
app.post("/api/products", authMiddleware, (req, res) => {
  const { name, category, price, discount, stock, contact, contactType, image } = req.body;
  if (!name || !price || !contact) return res.status(400).json({ error: "Nama, harga & kontak wajib diisi" });
  const result = db.prepare(`
    INSERT INTO products (name, category, price, discount, stock, contact, contactType, image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, category||"Lainnya", Number(price), Number(discount)||0, stock||"Ready", contact, contactType||"whatsapp", image||"");
  res.json(db.prepare("SELECT * FROM products WHERE id = ?").get(result.lastInsertRowid));
});

// PUT edit (admin)
app.put("/api/products/:id", authMiddleware, (req, res) => {
  const { name, category, price, discount, stock, contact, contactType, image } = req.body;
  const { id } = req.params;
  db.prepare(`
    UPDATE products SET name=?, category=?, price=?, discount=?, stock=?, contact=?, contactType=?, image=? WHERE id=?
  `).run(name, category||"Lainnya", Number(price), Number(discount)||0, stock||"Ready", contact, contactType||"whatsapp", image||"", id);
  res.json(db.prepare("SELECT * FROM products WHERE id = ?").get(id));
});

// DELETE (admin)
app.delete("/api/products/:id", authMiddleware, (req, res) => {
  db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Health check
app.get("/api/health", (_, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.listen(PORT, () => console.log(`✅ Plyk Store API running on port ${PORT}`));

const express = require('express');
const bcrypt = require('bcryptjs');
const { query, run, scalar } = require('../db/connection');
const { auth, adminOnly, generateToken } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// AUTH
// ============================================================
function serializeUser(user, stores, perms) {
  const permissions = {};
  perms.forEach(r => { permissions[r.PageCode] = !!r.HasAccess; });
  return {
    id: user.Id,
    username: user.Username,
    name: user.DisplayName,
    role: user.Role,
    accessLevel: user.AccessLevel || 'full',
    stores,
    permissions
  };
}

async function buildAuthPayload(user) {
  const stores = await query('SELECT s.Id, s.Code, s.Name FROM UserStores us JOIN Stores s ON us.StoreId=s.Id WHERE us.UserId=?', [user.Id]);
  const perms = await query('SELECT PageCode, HasAccess FROM UserPermissions WHERE UserId=?', [user.Id]);
  return serializeUser(user, stores, perms);
}

router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = await query('SELECT * FROM Users WHERE Username=? AND IsActive=1', [username]);
    if (!users.length) return res.status(401).json({ error: 'Λάθος στοιχεία' });

    const user = users[0];
    if (!bcrypt.compareSync(password, user.Password)) return res.status(401).json({ error: 'Λάθος στοιχεία' });

    const token = generateToken(user);
    const secure = process.env.NODE_ENV === 'production';
    res.cookie('koupis_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({ user: await buildAuthPayload(user) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('koupis_session', { path: '/' });
  res.json({ ok: true });
});

router.get('/auth/me', auth, async (req, res) => {
  try {
    const users = await query('SELECT * FROM Users WHERE Id=? AND IsActive=1', [req.user.id]);
    if (!users.length) return res.status(401).json({ error: 'Απαιτείται σύνδεση' });
    res.json({ user: await buildAuthPayload(users[0]) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// STORES
// ============================================================
router.get('/stores', auth, async (req, res) => {
  try {
    const rows = req.user.role === 'admin'
      ? await query('SELECT * FROM Stores WHERE IsActive=1 ORDER BY Code')
      : await query('SELECT s.* FROM Stores s JOIN UserStores us ON s.Id=us.StoreId WHERE us.UserId=? AND s.IsActive=1', [req.user.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// ACCOUNTS
// ============================================================
router.get('/accounts', auth, async (req, res) => {
  try { res.json(await query('SELECT * FROM Accounts WHERE IsActive=1 ORDER BY Type, SortOrder, Name')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});




router.post('/accounts', auth, async (req, res) => {
  try {
    const { name, type } = req.body;
    const sort = (await scalar('SELECT COALESCE(MAX(SortOrder),0)+1 FROM Accounts WHERE Type=?', [type])) || 1;
    const { lastId } = await run('INSERT INTO Accounts(Name,Type,SortOrder) VALUES(?,?,?)', [name.toUpperCase(), type, sort]);
    const rows = await query('SELECT * FROM Accounts WHERE Id=?', [lastId]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/accounts/:id', auth, async (req, res) => {
  try { await run('UPDATE Accounts SET IsActive=0 WHERE Id=?', [+req.params.id]); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// TRANSACTIONS
// ============================================================
router.get('/transactions', auth, async (req, res) => {
  try {
    const { storeId, from, to, page = 1, limit = 50, search } = req.query;
    if (req.user.role !== 'admin') {
      const access = await query('SELECT 1 FROM UserStores WHERE UserId=? AND StoreId=?', [req.user.id, +storeId]);
      if (!access.length) return res.status(403).json({ error: 'Δεν έχετε πρόσβαση' });
    }
    let where = 't.StoreId=?'; const params = [+storeId];
    if (from) { where += ' AND t.Date>=?'; params.push(from); }
    if (to) { where += ' AND t.Date<=?'; params.push(to); }
    if (search) { where += ' AND (t.Description LIKE ? OR a.Name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    const total = await scalar(`SELECT COUNT(*) FROM Transactions t JOIN Accounts a ON t.AccountId=a.Id WHERE ${where}`, params);
    const offset = (+page - 1) * +limit;
    const data = await query(
      `SELECT t.*, a.Name AS AccountName, a.Type AS AccountType, s.Name AS StoreName
       FROM Transactions t JOIN Accounts a ON t.AccountId=a.Id JOIN Stores s ON t.StoreId=s.Id
       WHERE ${where} ORDER BY t.Date DESC, t.Id DESC LIMIT ? OFFSET ?`,
      [...params, +limit, offset]);

    res.json({ data, total, page: +page, pages: Math.ceil(total / +limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/transactions', auth, async (req, res) => {
  try {
    const { date, description, amount, accountId, storeId } = req.body;
    if (req.user.role !== 'admin') {
      const access = await query('SELECT 1 FROM UserStores WHERE UserId=? AND StoreId=?', [req.user.id, storeId]);
      if (!access.length) return res.status(403).json({ error: 'Δεν έχετε πρόσβαση' });
    }
    const { lastId } = await run(
      'INSERT INTO Transactions(Date,Description,Amount,AccountId,StoreId,CreatedBy) VALUES(?,?,?,?,?,?)',
      [date, description, amount, accountId, storeId, req.user.id]);
    res.json({ ok: true, id: lastId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/transactions/:id', auth, async (req, res) => {
  try { await run('DELETE FROM Transactions WHERE Id=?', [+req.params.id]); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// REPORT
// ============================================================
router.get('/report', auth, async (req, res) => {
  try {
    const { storeId, from, to } = req.query;
    if (req.user.role !== 'admin') {
      const access = await query('SELECT 1 FROM UserStores WHERE UserId=? AND StoreId=?', [req.user.id, +storeId]);
      if (!access.length) return res.status(403).json({ error: 'Δεν έχετε πρόσβαση' });
    }
    const rows = await query(
      `SELECT a.Name AS AccountName, a.Type AS AccountType, SUM(t.Amount) AS Total
       FROM Transactions t JOIN Accounts a ON t.AccountId=a.Id
       WHERE t.StoreId=? AND t.Date>=? AND t.Date<=?
       GROUP BY a.Name, a.Type ORDER BY a.Type, a.Name`,
      [+storeId, from, to]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// P&L
// ============================================================
router.get('/pnl', auth, async (req, res) => {
  try {
    const { year = 2026, storeId } = req.query;
    let where = "CAST(strftime('%Y',t.Date) AS INTEGER)=?";
    const params = [+year];
    if (storeId && storeId !== 'all') {
      where += ' AND t.StoreId=?'; params.push(+storeId);
      if (req.user.role !== 'admin') {
        const access = await query('SELECT 1 FROM UserStores WHERE UserId=? AND StoreId=?', [req.user.id, +storeId]);
        if (!access.length) return res.status(403).json({ error: 'Δεν έχετε πρόσβαση' });
      }
    }
    const rows = await query(
      `SELECT a.Name AS AccountName, a.Type AS AccountType, a.SortOrder,
              CAST(strftime('%m',t.Date) AS INTEGER) AS Month, SUM(t.Amount) AS Total
       FROM Transactions t JOIN Accounts a ON t.AccountId=a.Id
       WHERE ${where}
       GROUP BY a.Name, a.Type, a.SortOrder, strftime('%m',t.Date)
       ORDER BY a.Type DESC, a.SortOrder, a.Name, Month`, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// DASHBOARD
// ============================================================
router.get('/dashboard', auth, async (req, res) => {
  try {
    const { year = 2026 } = req.query;
    let storeFilter = ''; const params = [+year];
    if (req.user.role !== 'admin') {
      storeFilter = 'AND t.StoreId IN (SELECT StoreId FROM UserStores WHERE UserId=?)';
      params.push(req.user.id);
    }
    const monthly = await query(
      `SELECT CAST(strftime('%m',t.Date) AS INTEGER) AS Month, a.Type, SUM(t.Amount) AS Total
       FROM Transactions t JOIN Accounts a ON t.AccountId=a.Id
       WHERE CAST(strftime('%Y',t.Date) AS INTEGER)=? ${storeFilter}
       GROUP BY strftime('%m',t.Date), a.Type ORDER BY Month`, params);

    let perStore = [];
    if (req.user.role === 'admin') {
      perStore = await query(
        `SELECT s.Name AS StoreName, a.Type, CAST(strftime('%m',t.Date) AS INTEGER) AS Month, SUM(t.Amount) AS Total
         FROM Transactions t JOIN Accounts a ON t.AccountId=a.Id JOIN Stores s ON t.StoreId=s.Id
         WHERE CAST(strftime('%Y',t.Date) AS INTEGER)=?
         GROUP BY s.Name, a.Type, Month ORDER BY s.Name, Month`, [+year]);
    }

    const txParams = [+year];
    if (req.user.role !== 'admin') txParams.push(req.user.id);
    const txCount = await scalar(
      `SELECT COUNT(*) FROM Transactions t WHERE CAST(strftime('%Y',t.Date) AS INTEGER)=? ${storeFilter}`, txParams);

    res.json({ monthly, perStore, txCount: txCount || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// USERS (Admin)
// ============================================================
router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const users = await query(
      `SELECT u.Id, u.Username, u.DisplayName, u.Role, u.AccessLevel,
              GROUP_CONCAT(s.Name, ', ') AS StoreNames,
              GROUP_CONCAT(s.Id) AS StoreIds
       FROM Users u LEFT JOIN UserStores us ON u.Id=us.UserId LEFT JOIN Stores s ON us.StoreId=s.Id
       WHERE u.IsActive=1 GROUP BY u.Id ORDER BY u.Role, u.Username`);
    for (const user of users) {
      const perms = await query('SELECT PageCode, HasAccess FROM UserPermissions WHERE UserId=?', [user.Id]);
      user.permissions = {};
      perms.forEach(r => { user.permissions[r.PageCode] = !!r.HasAccess; });
    }
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users', auth, adminOnly, async (req, res) => {
  try {
    const { username, password, displayName, role, storeIds, accessLevel, permissions } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    const { lastId } = await run('INSERT INTO Users(Username,Password,DisplayName,Role,AccessLevel) VALUES(?,?,?,?,?)',
      [username, hash, displayName, role, accessLevel || 'full']);

    const sids = role === 'admin' ? (await query('SELECT Id FROM Stores')).map(r => r.Id) : (storeIds || []);
    for (const sid of sids) await run('INSERT INTO UserStores(UserId,StoreId) VALUES(?,?)', [lastId, sid]);

    const pages = ['dashboard','transactions','accounts','report','pnl'];
    for (const pg of pages) {
      const has = permissions ? (permissions[pg] !== false ? 1 : 0) : 1;
      await run('INSERT INTO UserPermissions(UserId,PageCode,HasAccess) VALUES(?,?,?)', [lastId, pg, has]);
    }
    res.json({ ok: true, id: lastId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id', auth, adminOnly, async (req, res) => {
  try {
    const id = +req.params.id;
    const { displayName, password, role, storeIds, accessLevel, permissions } = req.body;
    if (displayName) await run('UPDATE Users SET DisplayName=? WHERE Id=?', [displayName, id]);
    if (role) await run('UPDATE Users SET Role=? WHERE Id=?', [role, id]);
    if (accessLevel) await run('UPDATE Users SET AccessLevel=? WHERE Id=?', [accessLevel, id]);
    if (password) await run('UPDATE Users SET Password=? WHERE Id=?', [bcrypt.hashSync(password, 10), id]);

    if (storeIds !== undefined) {
      await run('DELETE FROM UserStores WHERE UserId=?', [id]);
      const sids = role === 'admin' ? (await query('SELECT Id FROM Stores')).map(r => r.Id) : (storeIds || []);
      for (const sid of sids) await run('INSERT INTO UserStores(UserId,StoreId) VALUES(?,?)', [id, sid]);
    }
    if (permissions) {
      const pages = ['dashboard','transactions','accounts','report','pnl'];
      for (const pg of pages) {
        const has = permissions[pg] !== false ? 1 : 0;
        await run('DELETE FROM UserPermissions WHERE UserId=? AND PageCode=?', [id, pg]);
        await run('INSERT INTO UserPermissions(UserId,PageCode,HasAccess) VALUES(?,?,?)', [id, pg, has]);
      }
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/users/:id', auth, adminOnly, async (req, res) => {
  try { await run('UPDATE Users SET IsActive=0 WHERE Id=?', [+req.params.id]); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

// ============================================================
// STORES MANAGEMENT (Admin)
// ============================================================
router.post('/stores', auth, adminOnly, async (req, res) => {
  try {
    const { code, name } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'Απαιτούνται κωδικός και όνομα' });
    const { lastId } = await run('INSERT INTO Stores(Code,Name) VALUES(?,?)', [code.toUpperCase(), name]);
    const rows = await query('SELECT * FROM Stores WHERE Id=?', [lastId]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/stores/:id', auth, adminOnly, async (req, res) => {
  try {
    const { code, name } = req.body;
    if (code) await run('UPDATE Stores SET Code=? WHERE Id=?', [code.toUpperCase(), +req.params.id]);
    if (name) await run('UPDATE Stores SET Name=? WHERE Id=?', [name, +req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// BACKUP (Admin)
// ============================================================
const fs = require('fs');
const path = require('path');
router.get('/backup', auth, adminOnly, async (req, res) => {
  try {
    const { save, getDb } = require('../db/connection');
    save();
    const dbPath = path.join(__dirname, '..', 'database.db');
    if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'Δεν βρέθηκε αρχείο βάσης' });
    const dt = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="koupis_backup_${dt}.db"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.sendFile(dbPath);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- BACKUP VIA EMAIL ---
router.post('/backup/email', auth, adminOnly, async (req, res) => {
  try {
    const nodemailer = require('nodemailer');
    const { save } = require('../db/connection');
    save();
    const dbPath = path.join(__dirname, '..', 'database.db');
    if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'Δεν βρέθηκε αρχείο βάσης' });
    const { smtp, port, from, pass, to } = req.body;
    if (!smtp || !from || !pass || !to) return res.status(400).json({ error: 'Λείπουν στοιχεία SMTP' });
    const transporter = nodemailer.createTransport({ host: smtp, port: +port || 587, secure: +port === 465, auth: { user: from, pass } });
    const dt = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    await transporter.sendMail({
      from, to,
      subject: `KOUPIS Backup ${dt}`,
      text: `Αυτόματο backup βάσης δεδομένων KOUPIS.
Ημερομηνία: ${dt}`,
      attachments: [{ filename: `koupis_backup_${dt}.db`, path: dbPath }]
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- BACKUP VIA TELEGRAM ---
router.post('/backup/telegram', auth, adminOnly, async (req, res) => {
  try {
    const { save } = require('../db/connection');
    save();
    const dbPath = path.join(__dirname, '..', 'database.db');
    if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'Δεν βρέθηκε αρχείο βάσης' });
    const { token, chatId } = req.body;
    if (!token || !chatId) return res.status(400).json({ error: 'Λείπουν token ή chatId' });
    const dt = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const FormData = require('form-data');
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', `💾 KOUPIS Backup
📅 ${dt}`);
    form.append('document', fs.createReadStream(dbPath), { filename: `koupis_backup_${dt}.db` });
    const https = require('https');
    await new Promise((resolve, reject) => {
      const req2 = https.request(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', headers: form.getHeaders() }, (r) => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => {
          const j = JSON.parse(d);
          if (j.ok) resolve(); else reject(new Error(j.description || 'Telegram error'));
        });
      });
      req2.on('error', reject);
      form.pipe(req2);
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- BACKUP VIA WEBHOOK ---
router.post('/backup/webhook', auth, adminOnly, async (req, res) => {
  try {
    const { save } = require('../db/connection');
    save();
    const dbPath = path.join(__dirname, '..', 'database.db');
    if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'Δεν βρέθηκε αρχείο βάσης' });
    const { url, auth: authHeader } = req.body;
    if (!url) return res.status(400).json({ error: 'Λείπει URL' });
    const FormData = require('form-data');
    const form = new FormData();
    const dt = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    form.append('backup', fs.createReadStream(dbPath), { filename: `koupis_backup_${dt}.db` });
    form.append('timestamp', dt);
    const headers = { ...form.getHeaders() };
    if (authHeader) headers['Authorization'] = authHeader;
    const https = require(url.startsWith('https') ? 'https' : 'http');
    await new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const reqOpts = { hostname: urlObj.hostname, port: urlObj.port, path: urlObj.pathname + urlObj.search, method: 'POST', headers };
      const req2 = https.request(reqOpts, (r) => { r.resume(); r.on('end', resolve); });
      req2.on('error', reject);
      form.pipe(req2);
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

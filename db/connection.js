const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database.db');
let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  // Enable WAL mode for better concurrent reads
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');
  return db;
}

function save() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Auto-save every 5 seconds if changes were made
let dirty = false;
function markDirty() { dirty = true; }
const autoSaveTimer = setInterval(() => {
  if (dirty) { save(); dirty = false; }
}, 5000);

// Allow Node.js to exit cleanly even if the timer is still pending
if (autoSaveTimer.unref) autoSaveTimer.unref();

function shutdown() {
  clearInterval(autoSaveTimer);
  save();
}

// Save on exit
process.on('exit', shutdown);
process.on('SIGINT', () => { shutdown(); process.exit(); });
process.on('SIGTERM', () => { shutdown(); process.exit(); });

// Helper: run query and return results as array of objects
async function query(sql, params = []) {
  const d = await getDb();
  const stmt = d.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper: run insert/update/delete
async function run(sql, params = []) {
  const d = await getDb();
  d.run(sql, params);
  markDirty();
  return { lastId: d.exec("SELECT last_insert_rowid()")[0]?.values[0][0] || 0 };
}

// Helper: get single value
async function scalar(sql, params = []) {
  const d = await getDb();
  const stmt = d.prepare(sql);
  if (params.length) stmt.bind(params);
  let result = null;
  if (stmt.step()) result = stmt.get()[0];
  stmt.free();
  return result;
}

module.exports = { getDb, save, query, run, scalar };

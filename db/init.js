/**
 * KOUPIS GROUP - Database Init & Seed
 * Creates tables and inserts initial data
 * Run: node db/init.js
 */
const { getDb, save } = require('./connection');
const bcrypt = require('bcryptjs');

const ACCOUNTS = [
  ['ΕΣΟΔΑ','Income',1],['WOLT','Income',2],['EFOOD','Income',3],
  ['PLAISIO','Expenses',10],['ADVERTISMENT RPN','Expenses',11],['ΜΙΣΘΟΔΟΣΙΑ','Expenses',12],
  ['ΕΝΟΙΚΙΟ ΜΑΡΚΟΥ','Expenses',13],['ΕΝΟΙΚΙΟ ΞΗΝΤΑΡΑ ΑΓΓΕΛΑ','Expenses',14],
  ['ΕΝΟΙΚΙΟ ΞΗΝΤΑΡΑ ΘΑΝΑΣΗ','Expenses',15],['ΓΕΩΡΓΙΑΔΗΣ','Expenses',16],
  ['ΖΕΝΙΘ','Expenses',17],['ΔΗΜΟΣ ΝΕΡΟ','Expenses',18],['ΚΑΝΕΛΛΗΣ ΛΟΓΙΣΤΗΣ','Expenses',19],
  ['GKM','Expenses',20],['BAR SUPPLY','Expenses',21],['GRAFO','Expenses',22],
  ['FAMILIA NUTS','Expenses',23],['ΠΡΟΤΥΠΟ','Expenses',24],['GLOBAL FOODS','Expenses',25],
  ['STATHIS','Expenses',26],['FORAGE','Expenses',27],['LYDIAS','Expenses',28],
  ['XRONAS','Expenses',29],['MARKOY WINERY','Expenses',30],['WINE CIRCUS','Expenses',31],
  ['ASSAGIO','Expenses',32],['ΦΡΑΓΚΟΥ','Expenses',33],['ΤΣΟΥΡΗΣ','Expenses',34],
  ['ΟΚΑ','Expenses',35],['ΔΗΜΗΤΡΙΟΥ','Expenses',36],['CITY PACK','Expenses',37],
  ['LAZ GAS','Expenses',38],['ΓΙΑΝΝΙΚΑΣ','Expenses',39],['ADVERTISMENT IRAFINA','Expenses',40],
  ['ADVERTISMENT I SELIDA','Expenses',41],['COSTO MENU','Expenses',42],
  ['ΦΠΑ','Expenses',43],['ΙΚΑ','Expenses',44],['ΕΦΚΑ','Expenses',45],
  ['OPTIMA','Expenses',46],['ΠΑΓΟΣ','Expenses',47],['ΤΖΑΜΙΑ','Expenses',48],
  ['SIVVAS','Expenses',49],['ΒΕΝΙΕΡΗΣ','Expenses',50],['ΡΟΛΑ PRINTER','Expenses',51],
  ['ΜΑΣΤΟΡΑΣ','Expenses',52],['JUMBO','Expenses',53],['TAF','Expenses',54],
];

async function init() {
  console.log('🔧 Δημιουργία βάσης δεδομένων...');
  const db = await getDb();

  // Create tables
  db.run(`CREATE TABLE IF NOT EXISTS Stores (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Code TEXT NOT NULL UNIQUE,
    Name TEXT NOT NULL,
    IsActive INTEGER DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS Users (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Username TEXT NOT NULL UNIQUE,
    Password TEXT NOT NULL,
    DisplayName TEXT NOT NULL,
    Role TEXT NOT NULL DEFAULT 'user',
    AccessLevel TEXT DEFAULT 'full',
    IsActive INTEGER DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS UserStores (
    UserId INTEGER NOT NULL REFERENCES Users(Id) ON DELETE CASCADE,
    StoreId INTEGER NOT NULL REFERENCES Stores(Id) ON DELETE CASCADE,
    PRIMARY KEY (UserId, StoreId)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS UserPermissions (
    UserId INTEGER NOT NULL REFERENCES Users(Id) ON DELETE CASCADE,
    PageCode TEXT NOT NULL,
    HasAccess INTEGER DEFAULT 1,
    PRIMARY KEY (UserId, PageCode)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS Accounts (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL UNIQUE,
    Type TEXT NOT NULL CHECK(Type IN ('Income','Expenses')),
    SortOrder INTEGER DEFAULT 0,
    IsActive INTEGER DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS Transactions (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Date TEXT NOT NULL,
    Description TEXT,
    Amount REAL NOT NULL,
    AccountId INTEGER NOT NULL REFERENCES Accounts(Id),
    StoreId INTEGER NOT NULL REFERENCES Stores(Id),
    CreatedBy INTEGER REFERENCES Users(Id),
    CreatedAt TEXT DEFAULT (datetime('now'))
  )`);

  // Indexes
  db.run('CREATE INDEX IF NOT EXISTS IX_Trans_Date_Store ON Transactions(Date, StoreId)');
  db.run('CREATE INDEX IF NOT EXISTS IX_Trans_Account ON Transactions(AccountId)');

  console.log('📋 Πίνακες δημιουργήθηκαν!');

  // ============================================
  // SEED DATA
  // ============================================
  
  // Stores
  const storeCount = db.exec("SELECT COUNT(*) FROM Stores")[0]?.values[0][0] || 0;
  if (storeCount === 0) {
    console.log('🏪 Εισαγωγή καταστημάτων...');
    db.run("INSERT INTO Stores(Code,Name) VALUES('S1','Κατάστημα 1')");
    db.run("INSERT INTO Stores(Code,Name) VALUES('S2','Κατάστημα 2')");
    db.run("INSERT INTO Stores(Code,Name) VALUES('S3','Κατάστημα 3')");
  }

  // Accounts
  const accCount = db.exec("SELECT COUNT(*) FROM Accounts")[0]?.values[0][0] || 0;
  if (accCount === 0) {
    console.log('📒 Εισαγωγή λογαριασμών...');
    for (const [name, type, sort] of ACCOUNTS) {
      db.run("INSERT INTO Accounts(Name,Type,SortOrder) VALUES(?,?,?)", [name, type, sort]);
    }
  }

  // Users
  const userCount = db.exec("SELECT COUNT(*) FROM Users")[0]?.values[0][0] || 0;
  if (userCount === 0) {
    console.log('👤 Εισαγωγή χρηστών...');
    const hashAdmin = bcrypt.hashSync('admin', 10);
    const hash1234 = bcrypt.hashSync('1234', 10);

    db.run("INSERT INTO Users(Username,Password,DisplayName,Role,AccessLevel) VALUES(?,?,?,?,?)",
      ['admin', hashAdmin, 'Administrator', 'admin', 'full']);
    db.run("INSERT INTO Users(Username,Password,DisplayName,Role,AccessLevel) VALUES(?,?,?,?,?)",
      ['store1', hash1234, 'Manager Store 1', 'user', 'full']);
    db.run("INSERT INTO Users(Username,Password,DisplayName,Role,AccessLevel) VALUES(?,?,?,?,?)",
      ['store2', hash1234, 'Manager Store 2', 'user', 'full']);
    db.run("INSERT INTO Users(Username,Password,DisplayName,Role,AccessLevel) VALUES(?,?,?,?,?)",
      ['store3', hash1234, 'Manager Store 3', 'user', 'full']);

    // UserStores
    db.run("INSERT INTO UserStores VALUES(1,1)"); // admin -> all
    db.run("INSERT INTO UserStores VALUES(1,2)");
    db.run("INSERT INTO UserStores VALUES(1,3)");
    db.run("INSERT INTO UserStores VALUES(2,1)"); // store1 -> S1
    db.run("INSERT INTO UserStores VALUES(3,2)"); // store2 -> S2
    db.run("INSERT INTO UserStores VALUES(4,3)"); // store3 -> S3

    // Permissions (all enabled by default)
    const pages = ['dashboard','transactions','accounts','report','pnl'];
    for (let uid = 1; uid <= 4; uid++) {
      for (const pg of pages) {
        db.run("INSERT INTO UserPermissions VALUES(?,?,1)", [uid, pg]);
      }
    }
  }

  // Sample transactions
  const txCount = db.exec("SELECT COUNT(*) FROM Transactions")[0]?.values[0][0] || 0;
  if (txCount === 0) {
    console.log('💰 Εισαγωγή demo συναλλαγών...');
    
    const expBases = {
      'ΜΙΣΘΟΔΟΣΙΑ':4500,'ΕΝΟΙΚΙΟ ΜΑΡΚΟΥ':1200,'ΕΝΟΙΚΙΟ ΞΗΝΤΑΡΑ ΑΓΓΕΛΑ':900,
      'ΕΝΟΙΚΙΟ ΞΗΝΤΑΡΑ ΘΑΝΑΣΗ':900,'ΦΠΑ':2000,'ΙΚΑ':1000,'ΕΦΚΑ':800,
      'ΚΑΝΕΛΛΗΣ ΛΟΓΙΣΤΗΣ':400,'ΓΕΩΡΓΙΑΔΗΣ':600,'ΖΕΝΙΘ':350,'GKM':300,
      'BAR SUPPLY':250,'GLOBAL FOODS':500,'FAMILIA NUTS':200,
      'MARKOY WINERY':300,'WINE CIRCUS':250,'FORAGE':220,
    };

    let count = 0;
    db.run("BEGIN TRANSACTION");
    
    for (let storeId = 1; storeId <= 3; storeId++) {
      const mult = storeId === 1 ? 1.2 : storeId === 2 ? 1.0 : 0.85;
      
      for (let m = 1; m <= 12; m++) {
        const season = 1 + 0.2 * Math.sin((m - 4) * Math.PI / 6);
        
        // Income
        for (const [accName, base] of [['ΕΣΟΔΑ',25000],['WOLT',5000],['EFOOD',5000]]) {
          const val = Math.round(base * mult * season + (Math.random()-.5) * base * .12);
          if (val > 0) {
            const day = String(Math.min(28, Math.floor(Math.random()*28)+1)).padStart(2,'0');
            const accId = ACCOUNTS.findIndex(a => a[0] === accName) + 1;
            db.run("INSERT INTO Transactions(Date,Description,Amount,AccountId,StoreId) VALUES(?,?,?,?,?)",
              [`2026-${String(m).padStart(2,'0')}-${day}`, accName, val, accId, storeId]);
            count++;
          }
        }
        
        // Expenses
        for (let i = 0; i < ACCOUNTS.length; i++) {
          if (ACCOUNTS[i][1] !== 'Expenses') continue;
          const accName = ACCOUNTS[i][0];
          const base = expBases[accName] || (Math.floor(Math.random()*180)+40);
          const val = Math.round(base * mult + (Math.random()-.5) * base * .2);
          if (val > 0 && Math.random() > 0.12) {
            const day = String(Math.min(28, Math.floor(Math.random()*28)+1)).padStart(2,'0');
            db.run("INSERT INTO Transactions(Date,Description,Amount,AccountId,StoreId) VALUES(?,?,?,?,?)",
              [`2026-${String(m).padStart(2,'0')}-${day}`, accName, val, i+1, storeId]);
            count++;
          }
        }
      }
    }
    
    db.run("COMMIT");
    console.log(`   ${count} συναλλαγές εισήχθησαν.`);
  }

  save();
  console.log('\n✅ Η βάση δημιουργήθηκε επιτυχώς! (database.db)');
  process.exit(0);
}

init().catch(err => { console.error('❌ Σφάλμα:', err.message); process.exit(1); });

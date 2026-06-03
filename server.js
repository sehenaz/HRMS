const express    = require('express');
const bodyParser = require('body-parser');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');
const multer     = require('multer');
const initSqlJs  = require('sql.js');

const app  = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// // Directories
// const persistenceDir = process.env.PERSISTENCE_DIR || __dirname;
// if (persistenceDir !== __dirname && !fs.existsSync(persistenceDir)) {
//   fs.mkdirSync(persistenceDir, { recursive: true });
// }



// NAYA (sahi) — yeh lagao
const persistenceDir = (() => {
  const base = process.env.PERSISTENCE_DIR ||
    (process.resourcesPath
      ? path.join(process.resourcesPath, '..', 'userData')
      : __dirname);
  if (!fs.existsSync(base)) {
    fs.mkdirSync(base, { recursive: true });
  } else if (!fs.statSync(base).isDirectory()) {
    // agar file hai toh parent directory use karo
    return path.dirname(base);
  }
  return base;
})();
const uploadsDir = path.join(persistenceDir, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename:    (req, file, cb) => {
    const u = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + u + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

const dbPath = path.join(persistenceDir, 'attendance.db');

function saveDb(db) {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

// Boot
initSqlJs().then(SQL => {

  let db;
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }
  console.log('Connected to SQLite (sql.js)');

  // Create tables
  db.run(`CREATE TABLE IF NOT EXISTS attendance (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id          TEXT,
    emp_name        TEXT,
    dept            TEXT,
    city            TEXT,
    date            TEXT,
    clock_in        TEXT,
    clock_in_iso    TEXT,
    clock_out       TEXT,
    clock_out_iso   TEXT,
    work_hours      TEXT,
    attendance_type TEXT,
    location        TEXT,
    lat             REAL,
    lng             REAL,
    photo           TEXT,
    timestamp       DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS employees (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id             TEXT UNIQUE,
    employee_name      TEXT,
    employee_email     TEXT,
    phone_number       TEXT,
    alternative_phone  TEXT,
    dob                TEXT,
    age                TEXT,
    marital_status     TEXT,
    blood_group        TEXT,
    address            TEXT,
    nominee_name       TEXT,
    nominee_phone      TEXT,
    bank_name          TEXT,
    branch_name        TEXT,
    account_number     TEXT,
    ifsc_code          TEXT,
    branch_code        TEXT,
    upi_id             TEXT,
    employee_type      TEXT,
    salary             TEXT,
    designation        TEXT,
    joining_date       TEXT,
    work_location      TEXT,
    cv_resume          TEXT,
    id_proof           TEXT,
    bank_passbook      TEXT,
    marksheet          TEXT,
    appointment_letter TEXT,
    registered_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Migrations
  const safeAlter = (sql) => { try { db.run(sql); saveDb(db); } catch(e) {} };
  safeAlter("ALTER TABLE attendance ADD COLUMN lat REAL");
  safeAlter("ALTER TABLE attendance ADD COLUMN lng REAL");
  safeAlter("ALTER TABLE attendance ADD COLUMN clock_in_iso TEXT");
  safeAlter("ALTER TABLE attendance ADD COLUMN clock_out_iso TEXT");
  ['cv_resume','id_proof','bank_passbook','marksheet','appointment_letter'].forEach(col =>
    safeAlter(`ALTER TABLE employees ADD COLUMN ${col} TEXT`)
  );

  saveDb(db);

  // Helpers
  function query(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  function run(sql, params = []) {
    db.run(sql, params);
    saveDb(db);
    const r = query("SELECT last_insert_rowid() as id");
    return r[0] ? r[0].id : null;
  }

  // ========================
  // EMPLOYEE REGISTRATION
  // ========================

  app.post('/api/register', upload.fields([
    { name: 'cvResume',          maxCount: 1 },
    { name: 'idProof',           maxCount: 1 },
    { name: 'bankPassbook',      maxCount: 1 },
    { name: 'marksheet',         maxCount: 1 },
    { name: 'appointmentLetter', maxCount: 1 }
  ]), (req, res) => {
    const {
      employeeId, employeeName, employeeEmail, phoneNumber, alternativePhone,
      dob, age, maritalStatus, bloodGroup, address,
      nomineeName, nomineePhone, bankName, branchName,
      accountNumber, ifscCode, branchCode, upiId,
      employeeType, salary, designation, joiningDate, workLocation
    } = req.body;

    if (!employeeName || !employeeEmail)
      return res.status(400).json({ error: 'Employee name and email are required' });

    const emp_id             = employeeId || `MEV/${Math.floor(Math.random()*999)+100}/2025`;
    const cv_resume          = req.files['cvResume']          ? `/uploads/${req.files['cvResume'][0].filename}`          : null;
    const id_proof           = req.files['idProof']           ? `/uploads/${req.files['idProof'][0].filename}`           : null;
    const bank_passbook      = req.files['bankPassbook']      ? `/uploads/${req.files['bankPassbook'][0].filename}`      : null;
    const marksheet_file     = req.files['marksheet']         ? `/uploads/${req.files['marksheet'][0].filename}`         : null;
    const appointment_letter = req.files['appointmentLetter'] ? `/uploads/${req.files['appointmentLetter'][0].filename}` : null;

    try {
      const rowId = run(`
        INSERT OR REPLACE INTO employees (
          emp_id, employee_name, employee_email, phone_number, alternative_phone,
          dob, age, marital_status, blood_group, address,
          nominee_name, nominee_phone, bank_name, branch_name,
          account_number, ifsc_code, branch_code, upi_id,
          employee_type, salary, designation, joining_date, work_location,
          cv_resume, id_proof, bank_passbook, marksheet, appointment_letter
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          emp_id, employeeName, employeeEmail, phoneNumber, alternativePhone,
          dob, age, maritalStatus, bloodGroup, address,
          nomineeName, nomineePhone, bankName, branchName,
          accountNumber, ifscCode, branchCode, upiId,
          employeeType, salary, designation, joiningDate, workLocation,
          cv_resume, id_proof, bank_passbook, marksheet_file, appointment_letter
        ]
      );
      res.json({ message: 'Employee registered successfully', id: emp_id, rowId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/employees', (req, res) => {
    try {
      res.json(query(`SELECT * FROM employees ORDER BY registered_at DESC`));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/employees/:emp_id', (req, res) => {
    try {
      run(`DELETE FROM employees WHERE emp_id = ?`, [req.params.emp_id]);
      res.json({ message: 'Employee deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ========================
  // ATTENDANCE
  // ========================

  app.post('/api/attendance', (req, res) => {
    const {
      emp_id, emp_name, dept, city, date,
      clock_in, clock_in_iso, clock_out, clock_out_iso,
      work_hours, attendance_type, location, lat, lng, photo
    } = req.body;

    if (!emp_id || !date)
      return res.status(400).json({ error: 'emp_id and date are required' });

    try {
      const existing = query(`SELECT id FROM attendance WHERE emp_id = ? AND date = ?`, [emp_id, date]);

      if (existing.length > 0) {
        run(`UPDATE attendance SET
          emp_name=?, dept=?, city=?,
          clock_in=?, clock_in_iso=?, clock_out=?, clock_out_iso=?,
          work_hours=?, attendance_type=?, location=?, lat=?, lng=?, photo=?
          WHERE id=?`,
          [emp_name, dept, city,
           clock_in, clock_in_iso||null, clock_out, clock_out_iso||null,
           work_hours, attendance_type, location, lat||null, lng||null, photo,
           existing[0].id]
        );
        res.json({ message: 'Attendance updated successfully', id: existing[0].id });
      } else {
        const rowId = run(`
          INSERT INTO attendance
            (emp_id, emp_name, dept, city, date,
             clock_in, clock_in_iso, clock_out, clock_out_iso,
             work_hours, attendance_type, location, lat, lng, photo)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [emp_id, emp_name, dept, city, date,
           clock_in, clock_in_iso||null, clock_out, clock_out_iso||null,
           work_hours, attendance_type, location, lat||null, lng||null, photo]
        );
        res.json({ message: 'Attendance saved successfully', id: rowId });
      }
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/attendance', (req, res) => {
    try {
      res.json(query(`SELECT * FROM attendance ORDER BY date DESC, id DESC`));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/attendance/:emp_id', (req, res) => {
    try {
      res.json(query(`SELECT * FROM attendance WHERE emp_id = ? ORDER BY date DESC`, [req.params.emp_id]));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/employee-attendance', (req, res) => {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID is required' });
    try {
      res.json(query(`SELECT * FROM attendance WHERE emp_id = ? ORDER BY date DESC`, [id]));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Serve frontend
  app.use(express.static(__dirname));

  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

}).catch(err => {
  console.error('Failed to initialize sql.js:', err);
  process.exit(1);
});
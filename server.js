// const express    = require('express');
// const mysql      = require('mysql2/promise');
// const multer     = require('multer');
// const path       = require('path');
// const fs         = require('fs');
// const cors       = require('cors');

// const app  = express();
// const PORT = process.env.PORT || 3000;

// // ── Middleware ─────────────────────────────────────────
// app.use(cors());
// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// // NOTE: express.static REMOVED from here — moved to bottom

// // ── Uploads folder ────────────────────────────────────
// const uploadDir = path.join(__dirname, 'uploads');
// if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// const storage = multer.diskStorage({
//     destination: (req, file, cb) => cb(null, uploadDir),
//     filename:    (req, file, cb) => cb(null, Date.now() + '_' + file.originalname)
// });
// const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// // ── MySQL Connection Pool ──────────────────────────────
// const pool = mysql.createPool({
//     host:            'localhost',
//     user:            'wwwmevrick_mspldatabase1',
//     password:        'Mspl@2026',
//     database:        'wwwmevrick_mevtencia_db',
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit:      0
// });

// // ── Create Tables if not exist ────────────────────────
// async function initDB() {
//     const conn = await pool.getConnection();
//     try {
//         // 1. Employees table
//         await conn.query(`
//             CREATE TABLE IF NOT EXISTS employees (
//                 id                INT AUTO_INCREMENT PRIMARY KEY,
//                 employee_id       VARCHAR(50) UNIQUE NOT NULL,
//                 name              VARCHAR(100),
//                 email             VARCHAR(100),
//                 phone             VARCHAR(15),
//                 alt_phone         VARCHAR(15),
//                 dob               DATE,
//                 age               INT,
//                 marital_status    VARCHAR(20),
//                 blood_group       VARCHAR(5),
//                 address           TEXT,
//                 nominee_name      VARCHAR(100),
//                 nominee_phone     VARCHAR(15),
//                 bank_name         VARCHAR(100),
//                 branch_name       VARCHAR(100),
//                 account_number    VARCHAR(50),
//                 ifsc_code         VARCHAR(20),
//                 branch_code       VARCHAR(20),
//                 upi_id            VARCHAR(100),
//                 employee_type     VARCHAR(30),
//                 salary            DECIMAL(10,2),
//                 designation       VARCHAR(100),
//                 joining_date      DATE,
//                 work_location     VARCHAR(50),
//                 password          VARCHAR(100) DEFAULT 'MEVRICK1707',
//                 cv_path           VARCHAR(255),
//                 id_proof_path     VARCHAR(255),
//                 bank_passbook_path VARCHAR(255),
//                 marksheet_path    VARCHAR(255),
//                 registered_at     DATETIME DEFAULT CURRENT_TIMESTAMP
//             ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
//         `);

//         // 2. Attendance table
//         await conn.query(`
//             CREATE TABLE IF NOT EXISTS attendance (
//                 id              INT AUTO_INCREMENT PRIMARY KEY,
//                 emp_id          VARCHAR(50),
//                 emp_name        VARCHAR(100),
//                 dept            VARCHAR(100),
//                 city            VARCHAR(100),
//                 date            VARCHAR(20),
//                 clock_in        VARCHAR(20),
//                 clock_out       VARCHAR(20),
//                 work_hours      VARCHAR(20),
//                 location        TEXT,
//                 lat             VARCHAR(30),
//                 lng             VARCHAR(30),
//                 photo           LONGTEXT,
//                 clock_in_photo  LONGTEXT,
//                 clock_out_photo LONGTEXT,
//                 attendance_type VARCHAR(30) DEFAULT 'In Progress',
//                 created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
//                 INDEX idx_emp_id (emp_id),
//                 INDEX idx_date  (date)
//             ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
//         `);

//         // 3. Leave store table
//         await conn.query(`
//             CREATE TABLE IF NOT EXISTS leave_store (
//                 id          INT AUTO_INCREMENT PRIMARY KEY,
//                 emp_id      VARCHAR(50),
//                 emp_name    VARCHAR(100),
//                 leave_date  VARCHAR(20),
//                 leave_type  VARCHAR(50),
//                 reason      TEXT,
//                 marked_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
//                 UNIQUE KEY unique_leave (emp_id, leave_date)
//             ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
//         `);

//         console.log('✅ All tables ready!');
//     } finally {
//         conn.release();
//     }
// }

// // ════════════════════════════════════════════════════════
// //  EMPLOYEE ROUTES
// // ════════════════════════════════════════════════════════

// // Register new employee
// app.post('/api/register', upload.fields([
//     { name: 'cvResume' },
//     { name: 'idProof' },
//     { name: 'bankPassbook' },
//     { name: 'marksheet' }
// ]), async (req, res) => {
//     try {
//         const d = req.body;
//         const files = req.files || {};

//         const cvPath   = files.cvResume?.[0]?.filename     || null;
//         const idPath   = files.idProof?.[0]?.filename      || null;
//         const bankPath = files.bankPassbook?.[0]?.filename || null;
//         const markPath = files.marksheet?.[0]?.filename    || null;

//         await pool.query(`
//             INSERT INTO employees
//             (employee_id, name, email, phone, alt_phone, dob, age,
//              marital_status, blood_group, address,
//              nominee_name, nominee_phone,
//              bank_name, branch_name, account_number, ifsc_code, branch_code, upi_id,
//              employee_type, salary, designation, joining_date, work_location, password,
//              cv_path, id_proof_path, bank_passbook_path, marksheet_path)
//             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
//             ON DUPLICATE KEY UPDATE
//             name=VALUES(name), email=VALUES(email), salary=VALUES(salary),
//             designation=VALUES(designation), password=VALUES(password)
//         `, [
//             d.employeeId, d.employeeName, d.employeeEmail,
//             d.phoneNumber, d.alternativePhone || null,
//             d.dob || null, d.age || null,
//             d.maritalStatus, d.bloodGroup, d.address,
//             d.nomineeName, d.nomineePhone,
//             d.bankName, d.branchName, d.accountNumber, d.ifscCode,
//             d.branchCode || null, d.upiId || null,
//             d.employeeType, d.salary || 0,
//             d.designation, d.joiningDate || null,
//             d.workLocation, d.loginPassword || 'MEVRICK1707',
//             cvPath, idPath, bankPath, markPath
//         ]);

//         res.json({ success: true, employeeId: d.employeeId, message: 'Employee registered successfully!' });
//     } catch (err) {
//         console.error('Register error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // Get all employees
// app.get('/api/employees', async (req, res) => {
//     try {
//         const [rows] = await pool.query(
//             'SELECT * FROM employees ORDER BY registered_at DESC'
//         );
//         res.json(rows);
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // Get single employee
// app.get('/api/employees/:id', async (req, res) => {
//     try {
//         const [rows] = await pool.query(
//             'SELECT * FROM employees WHERE employee_id = ?',
//             [req.params.id]
//         );
//         if (!rows.length) return res.status(404).json({ error: 'Employee not found' });
//         res.json(rows[0]);
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // Delete employee
// app.delete('/api/employees/:id', async (req, res) => {
//     try {
//         await pool.query('DELETE FROM employees WHERE employee_id = ?', [req.params.id]);
//         res.json({ success: true });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // Get all employee credentials
// app.get('/api/credentials', async (req, res) => {
//     try {
//         const [rows] = await pool.query(
//             'SELECT employee_id as id, name, password, designation as dept, work_location as city, salary FROM employees'
//         );
//         const creds = {};
//         rows.forEach(r => { creds[r.id] = r; });
//         res.json(creds);
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // Update employee password
// app.put('/api/credentials/:id', async (req, res) => {
//     try {
//         const { password, name, dept, city } = req.body;
//         await pool.query(
//             'UPDATE employees SET password=?, designation=?, work_location=? WHERE employee_id=?',
//             [password, dept, city, req.params.id]
//         );
//         res.json({ success: true });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // ════════════════════════════════════════════════════════
// //  ATTENDANCE ROUTES
// // ════════════════════════════════════════════════════════

// // Save attendance (clock in / clock out)
// app.post('/api/attendance', async (req, res) => {
//     try {
//         const d = req.body;

//         const [existing] = await pool.query(
//             'SELECT id FROM attendance WHERE emp_id = ? AND date = ?',
//             [d.emp_id, d.date]
//         );

//         if (existing.length > 0) {
//             await pool.query(`
//                 UPDATE attendance SET
//                     clock_out       = ?,
//                     work_hours      = ?,
//                     attendance_type = ?,
//                     clock_out_photo = ?
//                 WHERE emp_id = ? AND date = ?
//             `, [
//                 d.clock_out, d.work_hours,
//                 d.attendance_type || 'Full Day',
//                 d.clock_out_photo || null,
//                 d.emp_id, d.date
//             ]);
//         } else {
//             await pool.query(`
//                 INSERT INTO attendance
//                 (emp_id, emp_name, dept, city, date, clock_in,
//                  location, lat, lng, photo, clock_in_photo, attendance_type)
//                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
//             `, [
//                 d.emp_id, d.emp_name, d.dept || '', d.city || '',
//                 d.date, d.clock_in,
//                 d.location || '', d.lat || null, d.lng || null,
//                 d.photo || null, d.clock_in_photo || null,
//                 'In Progress'
//             ]);
//         }

//         res.json({ success: true });
//     } catch (err) {
//         console.error('Attendance error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// // Get all attendance records
// app.get('/api/attendance', async (req, res) => {
//     try {
//         const [rows] = await pool.query(
//             'SELECT * FROM attendance ORDER BY date DESC, clock_in DESC'
//         );
//         res.json(rows);
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // Get attendance by employee
// app.get('/api/attendance/:empId', async (req, res) => {
//     try {
//         const [rows] = await pool.query(
//             'SELECT * FROM attendance WHERE emp_id = ? ORDER BY date DESC',
//             [req.params.empId]
//         );
//         res.json(rows);
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // ════════════════════════════════════════════════════════
// //  LEAVE ROUTES
// // ════════════════════════════════════════════════════════

// // Save / update leave
// app.post('/api/leave', async (req, res) => {
//     try {
//         const { emp_id, emp_name, leave_date, leave_type, reason } = req.body;
//         await pool.query(`
//             INSERT INTO leave_store (emp_id, emp_name, leave_date, leave_type, reason)
//             VALUES (?,?,?,?,?)
//             ON DUPLICATE KEY UPDATE leave_type=VALUES(leave_type), reason=VALUES(reason)
//         `, [emp_id, emp_name, leave_date, leave_type, reason || '']);
//         res.json({ success: true });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // Get all leaves
// app.get('/api/leave', async (req, res) => {
//     try {
//         const [rows] = await pool.query(
//             'SELECT * FROM leave_store ORDER BY leave_date DESC'
//         );
//         const store = {};
//         rows.forEach(r => {
//             store[`${r.emp_id}|${r.leave_date}`] = {
//                 type:    r.leave_type,
//                 reason:  r.reason,
//                 empName: r.emp_name,
//                 empId:   r.emp_id,
//                 date:    r.leave_date
//             };
//         });
//         res.json(store);
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // ════════════════════════════════════════════════════════
// //  EMPLOYEE LOGIN
// // ════════════════════════════════════════════════════════
// app.post('/api/login', async (req, res) => {
//     try {
//         const { emp_id, password } = req.body;
//         const [rows] = await pool.query(
//             'SELECT employee_id as id, name, password, designation as dept, work_location as city, salary FROM employees WHERE employee_id = ?',
//             [emp_id]
//         );
//         if (!rows.length)                  return res.status(401).json({ error: 'Employee ID not found' });
//         if (rows[0].password !== password) return res.status(401).json({ error: 'Incorrect password' });
//         res.json({ success: true, employee: rows[0] });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // ── Health check ───────────────────────────────────────
// app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// // ── Serve static files LAST (after all API routes) ────
// app.use(express.static(path.join(__dirname)));

// // ── Start server ───────────────────────────────────────
// initDB().then(() => {
//     app.listen(PORT, () => {
//         console.log(`🚀 MEVTENCIA Server running on port ${PORT}`);
//         console.log(`📦 MySQL: wwwmevrick_mevtencia_db`);
//     });
// }).catch(err => {
//     console.error('❌ DB init failed:', err);
//     process.exit(1);
// });'


////////////////////////////////////////////////

// const express = require('express');
// const cors = require('cors');
// const multer = require('multer');
// const path = require('path');

// const app = express();
// const PORT = process.env.PORT || 4000;

// // Middleware
// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // Static files
// app.use(express.static(__dirname));

// // Upload folder
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'uploads/');
//   },
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + '-' + file.originalname);
//   }
// });

// const upload = multer({ storage });

// // Home Route
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, 'index.html'));
// });

// // Employee Registration API
// app.post('/api/register', upload.any(), (req, res) => {
//   console.log('Employee Registration Data:', req.body);

//   res.json({
//     success: true,
//     message: 'Employee registered successfully'
//   });
// });

// // Attendance API
// app.post('/api/attendance', (req, res) => {
//   console.log('Attendance Data:', req.body);

//   res.json({
//     success: true,
//     message: 'Attendance saved successfully'
//   });
// });

// // Employee List API
// app.get('/api/employees', (req, res) => {
//   res.json([]);
// });

// // Attendance List API
// app.get('/api/attendance', (req, res) => {
//   res.json([]);
// });

// // Start Server
// app.listen(PORT, () => {
//   console.log(`✅ MEVTENCIA Server Running`);
//   console.log(`🌐 URL: http://localhost:${PORT}`);
// });


require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const multer   = require('multer');
const mongoose = require('mongoose');

const app  = express();
const PORT = process.env.PORT || 4000;

mongoose.connect('mongodb://samaresh_Mondal:Mspl%402026@ac-yuzpvud-shard-00-00.xjccckc.mongodb.net:27017,ac-yuzpvud-shard-00-01.xjccckc.mongodb.net:27017,ac-yuzpvud-shard-00-02.xjccckc.mongodb.net:27017/mevtencia?authSource=admin&tls=true')
  .then(() => console.log('✅ MongoDB Atlas Connected!'))
  .catch(err => { console.error('❌ MongoDB Error:', err); process.exit(1); });

const employeeSchema = new mongoose.Schema({
  emp_id:         { type: String, required: true, unique: true },
  employee_name:  String,
  employee_email: String,
  phone_number:   String,
  dept:           String,
  city:           String,
  designation:    String,
  salary:         String,
  joining_date:   String,
  employee_type:  { type: String, default: 'Full Time' },
  password:       { type: String, default: 'MEVRICK1707' },
  work_location:  String,
  address:        String,
  registered_at:  { type: Date, default: Date.now },
  updated_at:     { type: Date, default: Date.now }
});

const attendanceSchema = new mongoose.Schema({
  emp_id:          { type: String, required: true },
  emp_name:        String,
  dept:            String,
  city:            String,
  date:            { type: String, required: true },
  clock_in:        String,
  clock_out:       String,
  work_hours:      String,
  attendance_type: { type: String, default: 'In Progress' },
  location:        String,
  lat:             String,
  lng:             String,
  photo:           String,
  tasks:           Array,
  note:            String,
  updated_at:      { type: Date, default: Date.now }
});

const leaveSchema = new mongoose.Schema({
  key:        { type: String, required: true, unique: true },
  type:       String,
  reason:     String,
  empName:    String,
  empId:      String,
  date:       String,
  updated_at: { type: Date, default: Date.now }
});

const Employee   = mongoose.model('Employee',   employeeSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const Leave      = mongoose.model('Leave',      leaveSchema);

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(__dirname));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// EMPLOYEES
app.get('/api/employees', async (req, res) => {
  try {
    const employees = await Employee.find().sort({ registered_at: -1 });
    res.json(employees);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/employees', upload.any(), async (req, res) => {
  try {
    const emp = req.body;
    const empId = emp.emp_id || emp.employeeId;
    if (!empId) return res.status(400).json({ error: 'emp_id required' });
    const data = {
      emp_id: empId,
      employee_name:  emp.employee_name  || emp.employeeName  || '',
      employee_email: emp.employee_email || emp.employeeEmail || '',
      phone_number:   emp.phone_number   || emp.phoneNumber   || '',
      dept:           emp.dept || emp.department || '',
      city:           emp.city || emp.work_location || emp.workLocation || '',
      designation:    emp.designation   || '',
      salary:         emp.salary        || '',
      joining_date:   emp.joining_date  || emp.joiningDate || '',
      employee_type:  emp.employee_type || emp.employeeType || 'Full Time',
      password:       emp.password      || 'MEVRICK1707',
      work_location:  emp.work_location || emp.workLocation || '',
      address:        emp.address       || '',
      updated_at:     new Date()
    };
    const result = await Employee.findOneAndUpdate(
      { emp_id: empId }, data, { upsert: true, new: true }
    );
    res.json({ success: true, employee: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
/////////////////////////////////////////////////////////////////////////////

// app.post('/api/register', upload.any(), async (req, res) => {
//   try {
//     const emp = req.body;
//     const empId = emp.emp_id || emp.employeeId;
//     if (!empId) return res.status(400).json({ error: 'emp_id required' });
//     const data = {
//       emp_id: empId,
//       employee_name:  emp.employee_name  || emp.employeeName  || '',
//       employee_email: emp.employee_email || emp.employeeEmail || '',
//       phone_number:   emp.phone_number   || emp.phoneNumber   || '',
//       dept:           emp.dept || emp.department || '',
//       city:           emp.city || emp.work_location || emp.workLocation || '',
//       designation:    emp.designation   || '',
//       salary:         emp.salary        || '',
//       joining_date:   emp.joining_date  || emp.joiningDate || '',
//       employee_type:  emp.employee_type || emp.employeeType || 'Full Time',
//       password:       emp.password      || 'MEVRICK1707',
//       work_location:  emp.work_location || emp.workLocation || '',
//       address:        emp.address       || '',
//       updated_at:     new Date()
//     };
//     const result = await Employee.findOneAndUpdate(
//       { emp_id: empId }, data, { upsert: true, new: true }
//     );
//     res.json({ success: true, employee: result });
//   } catch (err) { res.status(500).json({ error: err.message }); }
// });

app.post('/api/register', upload.any(), async (req, res) => {
  try {
    const emp = req.body;
    const empId = emp.emp_id || emp.employeeId;
    if (!empId) return res.status(400).json({ error: 'emp_id required' });
    const data = {
      emp_id:         empId,
      employee_name:  emp.employee_name  || emp.employeeName  || '',
      employee_email: emp.employee_email || emp.employeeEmail || '',
      phone_number:   emp.phone_number   || emp.phoneNumber   || '',
      dept:           emp.dept || emp.department || '',
      city:           emp.city || emp.work_location || emp.workLocation || '',
      designation:    emp.designation   || '',
      salary:         emp.salary        || '',
      joining_date:   emp.joining_date  || emp.joiningDate || '',
      employee_type:  emp.employee_type || emp.employeeType || 'Full Time',
      password:       emp.password      || 'MEVRICK1707',
      work_location:  emp.work_location || emp.workLocation || '',
      address:        emp.address       || '',
      updated_at:     new Date()
    };
    const result = await Employee.findOneAndUpdate(
      { emp_id: empId }, data, { upsert: true, new: true }
    );
    res.json({ success: true, employee: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});



app.delete('/api/employees/:empId', async (req, res) => {
  try {
    await Employee.deleteOne({ emp_id: decodeURIComponent(req.params.empId) });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ATTENDANCE
app.get('/api/attendance', async (req, res) => {
  try {
    const records = await Attendance.find().sort({ date: -1 });
    res.json(records);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/employee-attendance', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    const records = await Attendance.find({ emp_id: id }).sort({ date: -1 });
    res.json(records);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/attendance', async (req, res) => {
  try {
    const d = req.body;
    if (!d.emp_id || !d.date) return res.status(400).json({ error: 'emp_id and date required' });
    const data = {
      emp_id: d.emp_id, emp_name: d.emp_name || '',
      dept: d.dept || '', city: d.city || '',
      date: d.date, clock_in: d.clock_in || '',
      clock_out: d.clock_out || '', work_hours: d.work_hours || '',
      attendance_type: d.attendance_type || 'In Progress',
      location: d.location || 'Unknown',
      lat: d.lat || null, lng: d.lng || null,
      photo: d.photo || '', tasks: d.tasks || [],
      note: d.note || '', updated_at: new Date()
    };
    const entry = await Attendance.findOneAndUpdate(
      { emp_id: d.emp_id, date: d.date }, data, { upsert: true, new: true }
    );
    res.json({ success: true, entry });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/attendance/:empId/:date', async (req, res) => {
  try {
    await Attendance.deleteOne({ emp_id: req.params.empId, date: req.params.date });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// LEAVES
app.get('/api/leaves', async (req, res) => {
  try {
    const leaves = await Leave.find();
    const store = {};
    leaves.forEach(l => { store[l.key] = l; });
    res.json(store);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/leaves', async (req, res) => {
  try {
    const { key, data } = req.body;
    if (!key) return res.status(400).json({ error: 'key required' });
    if (data === null) {
      await Leave.deleteOne({ key });
    } else {
      await Leave.findOneAndUpdate({ key }, { ...data, key, updated_at: new Date() }, { upsert: true });
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { id, password } = req.body;
    const emp = await Employee.findOne({ emp_id: id, password });
    if (emp) {
      res.json({ success: true, employee: emp });
    } else {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// STATS
app.get('/api/stats', async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }).split('/').join('/');
    const [totalEmployees, totalRecords, todayRecs] = await Promise.all([
      Employee.countDocuments(),
      Attendance.countDocuments(),
      Attendance.find({ date: today })
    ]);
    res.json({
      total_records:     totalRecords,
      total_employees:   totalEmployees,
      today_present:     todayRecs.length,
      today_full:        todayRecs.filter(r => r.attendance_type === 'Full Day').length,
      today_half:        todayRecs.filter(r => (r.attendance_type || '').includes('Half')).length,
      today_in_progress: todayRecs.filter(r => !r.clock_out || r.attendance_type === 'In Progress').length,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/health', (req, res) => {
  res.redirect('/index.html');

  res.json({ status: 'ok', time: new Date().toISOString(), db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   MEVTENCIA + MongoDB Atlas ✅               ║');
  console.log(`║   Running at: http://localhost:${PORT}          ║`);
  console.log('╚══════════════════════════════════════════════╝\n');
});
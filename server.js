

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
  .catch(err => {
    // ✅ FIX: previously this called process.exit(1), which killed the
    // entire Node server (and every API route) the moment MongoDB failed
    // to connect (e.g. due to an IP not being whitelisted on Atlas).
    // That meant ALL employees saw the "✕ Server Offline" badge and every
    // employee's salary fell back to the hardcoded ₹15000 default on
    // AttendanceTracker.html, since /api/employees was unreachable.
    //
    // Now the server keeps running even if MongoDB is unreachable — API
    // routes that hit the DB will fail individually (each already has its
    // own try/catch returning a 500), but the rest of the app (static
    // files, localStorage-based flows) keeps working, and once the IP is
    // whitelisted on Atlas + the server is restarted, it reconnects fine.
    console.error('❌ MongoDB Error:', err.message);
    console.error('⚠️  Server will keep running, but any /api/* route that needs the database will fail until MongoDB connects.');
    console.error('⚠️  Fix: whitelist this server\'s IP in MongoDB Atlas → Network Access, then restart the server.');
  });



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
  // ✅ FIX: these fields were completely missing from the schema, so
  // Mongoose silently dropped them on every save (this is the same class
  // of bug we already fixed for documents) — this is why DOB, Age, Marital
  // Status, Blood Group, Nominee, and Bank details always showed N/A on
  // the profile page even though Registration.html was sending them.
  alternative_phone: String,
  dob:               String,
  age:               String,
  marital_status:    String,
  blood_group:       String,
  nominee_name:      String,
  nominee_phone:     String,
  bank_name:         String,
  branch_name:       String,
  account_number:    String,
  ifsc_code:         String,
  branch_code:       String,
  upi_id:            String,
  registered_at:  { type: Date, default: Date.now },
  updated_at:     { type: Date, default: Date.now }
});

// ✅ FIX: documents (CV, ID proof, bank passbook, marksheet, appointment
// letter) used to be stuffed as base64 strings directly onto the Employee
// document. MongoDB caps every single document at 16MB — with 4 uploaded
// files plus a generated PDF all base64-encoded (~33% larger than the raw
// file) inside ONE employee record, larger uploads silently failed to save
// or got truncated. Each document now gets its OWN MongoDB document in a
// separate collection, keyed by emp_id + doc_type, so the 16MB limit
// applies per-file instead of per-employee, and one employee's stored size
// only grows with actual usage rather than being capped as a group.
const documentSchema = new mongoose.Schema({
  emp_id:      { type: String, required: true },
  doc_type:    { type: String, required: true }, // 'cv_resume' | 'id_proof' | 'bank_passbook' | 'marksheet' | 'appointment_letter'
  filename:    String,
  data:        String, // base64 data URI
  uploaded_at: { type: Date, default: Date.now }
});
documentSchema.index({ emp_id: 1, doc_type: 1 }, { unique: true });

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

// ── ADMIN SCHEMA (Normal Admin created by Super Admin) ──
const adminSchema = new mongoose.Schema({
  admin_id:           { type: String, required: true, unique: true },
  password:           { type: String, required: true },
  employee_id:        String,
  employee_name:      String,
  assigned_employees: [String],   // array of emp_ids under this admin
  created_at:         { type: Date, default: Date.now }
});

const salarySchema = new mongoose.Schema({
  emp_id:     { type: String, required: true },
  date:       { type: String, required: true },
  amount:     { type: Number, required: true },
  note:       String,
  empName:    String,
  addedBy:    String,
  updated_at: { type: Date, default: Date.now }
});

const Employee   = mongoose.model('Employee',   employeeSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const Leave      = mongoose.model('Leave',      leaveSchema);
const Admin      = mongoose.model('Admin',      adminSchema);
const Salary     = mongoose.model('Salary',     salarySchema);
const Document   = mongoose.model('Document',   documentSchema);

app.use(cors({ origin: '*' }));
// Each request now carries at most ONE document (via /api/documents) instead
// of four bundled together, so 8mb comfortably covers a base64-encoded 5MB
// file (~6.7MB) with headroom, while still protecting the server from
// oversized payloads.
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));
app.use(express.static(__dirname));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// ════════════════════════════════════════════════════════
//  EMPLOYEES
// ════════════════════════════════════════════════════════

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
      // ✅ FIX: previously missing — this is why DOB/Age/Marital Status/
      // Blood Group/Nominee/Bank details always showed N/A.
      alternative_phone: emp.alternative_phone || emp.alternativePhone || '',
      dob:               emp.dob || '',
      age:               emp.age || '',
      marital_status:    emp.marital_status || emp.maritalStatus || '',
      blood_group:       emp.blood_group || emp.bloodGroup || '',
      nominee_name:      emp.nominee_name || emp.nomineeName || '',
      nominee_phone:     emp.nominee_phone || emp.nomineePhone || '',
      bank_name:         emp.bank_name || emp.bankName || '',
      branch_name:       emp.branch_name || emp.branchName || '',
      account_number:    emp.account_number || emp.accountNumber || '',
      ifsc_code:         emp.ifsc_code || emp.ifscCode || '',
      branch_code:       emp.branch_code || emp.branchCode || '',
      upi_id:            emp.upi_id || emp.upiId || '',
      updated_at:     new Date()
    };
    const result = await Employee.findOneAndUpdate(
      { emp_id: empId }, data, { upsert: true, new: true }
    );
    res.json({ success: true, employee: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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
      // ✅ FIX: previously missing — this is why DOB/Age/Marital Status/
      // Blood Group/Nominee/Bank details always showed N/A.
      alternative_phone: emp.alternative_phone || emp.alternativePhone || '',
      dob:               emp.dob || '',
      age:               emp.age || '',
      marital_status:    emp.marital_status || emp.maritalStatus || '',
      blood_group:       emp.blood_group || emp.bloodGroup || '',
      nominee_name:      emp.nominee_name || emp.nomineeName || '',
      nominee_phone:     emp.nominee_phone || emp.nomineePhone || '',
      bank_name:         emp.bank_name || emp.bankName || '',
      branch_name:       emp.branch_name || emp.branchName || '',
      account_number:    emp.account_number || emp.accountNumber || '',
      ifsc_code:         emp.ifsc_code || emp.ifscCode || '',
      branch_code:       emp.branch_code || emp.branchCode || '',
      upi_id:            emp.upi_id || emp.upiId || '',
      updated_at:     new Date()
    };
    const result = await Employee.findOneAndUpdate(
      { emp_id: empId }, data, { upsert: true, new: true }
    );
    res.json({ success: true, employee: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════
//  DOCUMENTS (stored separately from the Employee record so a single
//  large file — or several of them together — never risks hitting
//  MongoDB's 16MB per-document limit on the Employee record itself)
// ════════════════════════════════════════════════════════

// Save/replace ONE document for one employee. Body: { emp_id, doc_type, filename, data }
app.post('/api/documents', async (req, res) => {
  try {
    const { emp_id, doc_type, filename, data } = req.body;
    if (!emp_id || !doc_type) {
      return res.status(400).json({ error: 'emp_id and doc_type are required' });
    }
    const result = await Document.findOneAndUpdate(
      { emp_id, doc_type },
      { emp_id, doc_type, filename: filename || '', data: data || '', uploaded_at: new Date() },
      { upsert: true, new: true }
    );
    res.json({ success: true, document: { emp_id: result.emp_id, doc_type: result.doc_type, filename: result.filename } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get all documents for one employee, returned as a flat object:
// { cv_resume: "data:...", id_proof: "data:...", ... }
app.get('/api/documents/:empId', async (req, res) => {
  try {
    const docs = await Document.find({ emp_id: decodeURIComponent(req.params.empId) });
    const out = {};
    docs.forEach(d => { out[d.doc_type] = d.data; });
    res.json(out);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/documents/:empId', async (req, res) => {
  try {
    await Document.deleteMany({ emp_id: decodeURIComponent(req.params.empId) });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

///////////////////////////////
app.patch('/api/admins/:adminId', async (req, res) => {
  try {
    const { assigned_employees, permissions } = req.body;
    const admin = await Admin.findOneAndUpdate(
      { admin_id: req.params.adminId },
      { $set: { assigned_employees, permissions } },
      { new: true }
    );
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    res.json({ success: true, admin });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
//////////////////////////////
app.delete('/api/employees/:empId', async (req, res) => {
  try {
    await Employee.deleteOne({ emp_id: decodeURIComponent(req.params.empId) });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════
//  ATTENDANCE
// ════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════
//  LEAVES
// ════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════
//  SALARIES
// ════════════════════════════════════════════════════════

app.get('/api/salary', async (req, res) => {
  try {
    const { emp_id } = req.query;
    const filter = emp_id ? { emp_id } : {};
    const entries = await Salary.find(filter).sort({ date: -1 });
    res.json(entries);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/salary', async (req, res) => {
  try {
    const { emp_id, date, amount, note, empName, addedBy } = req.body;
    if (!emp_id || !date || !amount) {
      return res.status(400).json({ error: 'emp_id, date and amount required' });
    }
    const data = {
      emp_id,
      date,
      amount,
      note: note || '',
      empName: empName || '',
      addedBy: addedBy || 'admin',
      updated_at: new Date()
    };
    const entry = new Salary(data);
    await entry.save();
    res.json(entry);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/salary/:id', async (req, res) => {
  try {
    const result = await Salary.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Salary entry not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════
//  EMPLOYEE LOGIN
// ════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════
//  STATS
// ════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════
//  NORMAL ADMIN ROUTES (created by Super Admin)
// ════════════════════════════════════════════════════════

app.get('/api/admins', async (req, res) => {
  try {
    const admins = await Admin.find().sort({ created_at: -1 });
    res.json(admins);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admins', async (req, res) => {
  try {
    const { admin_id, password, employee_id, employee_name, assigned_employees } = req.body;

    if (!admin_id || !password || !employee_id) {
      return res.status(400).json({ error: 'admin_id, password and employee_id are required' });
    }

    const existing = await Admin.findOne({ admin_id });
    if (existing) {
      return res.status(409).json({ error: 'This Admin ID already exists' });
    }

    const admin = new Admin({
      admin_id,
      password,
      employee_id,
      employee_name: employee_name || '',
      assigned_employees: assigned_employees || []
    });

    await admin.save();
    res.json({ success: true, admin });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admins/:adminId', async (req, res) => {
  try {
    await Admin.deleteOne({ admin_id: req.params.adminId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin-login', async (req, res) => {
  try {
    const { admin_id, password } = req.body;
    const admin = await Admin.findOne({ admin_id, password });
    if (admin) {
      res.json({ success: true, admin });
    } else {
      res.status(401).json({ success: false, error: 'Invalid Admin ID or Password' });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════
//  HEALTH CHECK + HOME
// ════════════════════════════════════════════════════════

app.get('/api/health', (req, res) => {
  res.json({
    
    status: 'ok',
    time: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
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
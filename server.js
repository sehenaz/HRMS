require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const multer   = require('multer');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const bcrypt   = require('bcryptjs');

// ── PASSWORD HASHING HELPERS ──
// SALT_ROUNDS: cost factor for bcrypt hashing (10 is a solid default).
const SALT_ROUNDS = 10;

function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

function looksHashed(pw) {
  // bcrypt hashes always look like $2a$10$..., $2b$10$..., or $2y$10$...
  return typeof pw === 'string' && /^\$2[aby]\$\d{2}\$/.test(pw);
}

// verifyAndMigratePassword — compares a plaintext candidate against a
// mongoose document's `password` field.
// - If the stored value is already a bcrypt hash, does a normal bcrypt compare.
// - If the stored value is still old plaintext (from before this fix), it
//   compares directly, and — if it matches — silently re-hashes it and saves
//   the document, so every account gets upgraded to a hash the next time it
//   logs in successfully, with zero downtime and no forced password resets.
async function verifyAndMigratePassword(candidatePlain, doc) {
  if (!doc || typeof candidatePlain !== 'string' || !doc.password) return false;

  if (looksHashed(doc.password)) {
    return bcrypt.compare(candidatePlain, doc.password);
  }

  const matches = doc.password === candidatePlain;
  if (matches) {
    doc.password = await hashPassword(candidatePlain);
    await doc.save();
  }
  return matches;
}

const app  = express();
const PORT = process.env.PORT || 4000;
app.use(cors({ origin: '*' }));  // sirf development ke liye, production me specific origins use karo
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Strict rate limiter ONLY for login endpoints (brute-force protection)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 login attempts per 15 min per IP
  message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false
});
// Note: NOT applying any global rate limiter — only login endpoints are limited

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Atlas Connected!'))
  .catch(err => {
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
attendanceSchema.index({ emp_id: 1, date: 1 });

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
  role: { type: String, enum: ['normal', 'recruiter', 'hr'], default: 'normal' },
  permissions: {
    attendance:              { type: Boolean, default: true },
    leave:                   { type: Boolean, default: false },
    salary:                  { type: Boolean, default: false },
    employeeDatabase:        { type: Boolean, default: false },
    newEmployeeRegistration: { type: Boolean, default: false }
  },
  created_at:         { type: Date, default: Date.now }
});

const superAdminSchema = new mongoose.Schema({
  super_id:   { type: String, required: true, unique: true },
  name:       String,
  password:   { type: String, required: true },
  phone:      String,
  created_at: { type: Date, default: Date.now }
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
const SuperAdmin = mongoose.model('SuperAdmin', superAdminSchema);
///////////////////////////////////

// ════════════════════════════════════════════════════════
//  PERMISSION MIDDLEWARE
// ════════════════════════════════════════════════════════
//
// ✅ SECURITY FIX: previously `requireSuperAdmin` (and the super-admin
// bypass inside `requirePermission`) trusted the client-supplied header
// `x-super-admin: true` at face value. That header proves NOTHING — any
// caller (curl, browser devtools, a modified frontend) could set it
// themselves and instantly get full super-admin rights on every admin
// route, with no credential check at all.
//
// Fix: the frontend now sends `x-super-admin-id` set to the *actual*
// super admin's id (the one returned by /api/super-admin/login and
// stored in `mev_superSession`). This middleware looks that id up in the
// SuperAdmin collection — if it doesn't exist, the request is rejected.
// This is still not as strong as a signed session token/JWT (a stolen id
// string is still enough), but it closes the "anyone can just claim
// x-super-admin: true" hole and ties every privileged action to a real,
// provisioned Super Admin account.
async function verifySuperAdmin(req) {
  const superId = req.headers['x-super-admin-id'];
  if (!superId) return false;
  const sa = await SuperAdmin.findOne({ super_id: superId });
  return !!sa;
}

function requirePermission(permKey) {
  return async (req, res, next) => {
    try {
      if (await verifySuperAdmin(req)) return next();

      const adminId = req.headers['x-admin-id'];
      if (!adminId) {
        return res.status(401).json({ error: 'Missing admin identity (x-admin-id header)' });
      }

      const admin = await Admin.findOne({ admin_id: adminId });
      if (!admin) {
        return res.status(404).json({ error: 'Admin not found' });
      }

      if (!admin.permissions || !admin.permissions[permKey]) {
        return res.status(403).json({ error: `You don't have permission for "${permKey}"` });
      }

      req.currentAdmin = admin;
      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

// requireSuperAdmin — for routes that must ONLY ever be touched by a real
// Super Admin (creating/editing/deleting admin accounts).
async function requireSuperAdmin(req, res, next) {
  try {
    if (await verifySuperAdmin(req)) return next();
    return res.status(403).json({ error: 'Super Admin access required for this action.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// requireAssignedEmployee — for routes that act on ONE employee (by
// :empId param or emp_id in the body) and must be restricted to only the
// employees a normal admin is actually assigned to. Super Admins bypass
// this. Must run AFTER requirePermission(...) so req.currentAdmin is
// already populated (super admins skip this check entirely since
// req.currentAdmin won't matter for them).
function requireAssignedEmployee(getEmpId) {
  return async (req, res, next) => {
    if (await verifySuperAdmin(req)) return next();
    const empId = getEmpId(req);
    const admin = req.currentAdmin;
    const assigned = (admin && admin.assigned_employees) || [];
    if (!empId || !assigned.includes(empId)) {
      return res.status(403).json({ error: 'This employee is not assigned to you.' });
    }
    next();
  };
}
/////////////////////////////////
// One-time seed: if the SuperAdmin collection is empty, create the same
// 3 accounts that used to be hardcoded in SuperAdminLogin.html, so nothing
// breaks for existing users on first deploy of this DB-backed version.
async function seedSuperAdmins() {
  try {
    const count = await SuperAdmin.countDocuments();
    if (count > 0) return;
    await SuperAdmin.insertMany([
      { super_id: 'super1', name: 'Samaresh',    password: await hashPassword('super@20261'), phone: '9876543210' },
      { super_id: 'super2', name: 'Akash Singh', password: await hashPassword('super@20262'), phone: '8765432109' },
      { super_id: 'super3', name: 'Somnath',     password: await hashPassword('super@20263'), phone: '7654321098' }
    ]);
    console.log('✅ Seeded default Super Admin accounts into MongoDB');
  } catch (err) {
    console.warn('⚠️  Could not seed Super Admins:', err.message);
  }
}
mongoose.connection.once('open', seedSuperAdmins);

// CORS is applied once at the top of the file
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));
// app.use(express.static(__dirname));

////////////////////////////////////////
const fs = require('fs');

const BFCACHE_FIX_SCRIPT = `
<script>
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      window.location.reload();
    }
  });
</script>`;

app.get(/^\/$|\.html$/, (req, res, next) => {
  const reqPath = req.path === '/' ? '/index.html' : req.path;
  const filePath = path.join(__dirname, decodeURIComponent(reqPath));
  

  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) return next(); // file nahi mili, static/404 handle kar lega

    let injected;
    if (/<head[^>]*>/i.test(html)) {
      injected = html.replace(/<head[^>]*>/i, (match) => `${match}${BFCACHE_FIX_SCRIPT}`);
    } else {
      injected = BFCACHE_FIX_SCRIPT + html;
    }

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.send(injected);
  });
});
//////////////////////////////////////
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (path.extname(filePath) === '.html') {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  }
}));


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

    if (await verifySuperAdmin(req)) {
      return res.json(employees);
    }

    const adminId = req.headers['x-admin-id'];
    if (adminId) {
      const admin = await Admin.findOne({ admin_id: adminId });
      if (admin) {
        const assignedSet = new Set(admin.assigned_employees || []);
        return res.json(employees.filter(e => assignedSet.has(e.emp_id)));
      }
      return res.status(404).json({ error: 'Admin not found' });
    }

    res.json(employees);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/employees', upload.any(), async (req, res) => {
  try {
    const emp = req.body;
    const empId = emp.emp_id || emp.employeeId;
    if (!empId) return res.status(400).json({ error: 'emp_id required' });

    // Password handling: hash it if a new one was sent; otherwise keep the
    // existing employee's (already-hashed) password instead of clobbering
    // it with the plaintext default on every edit/upsert.
    let passwordToStore;
    if (emp.password) {
      passwordToStore = await hashPassword(emp.password);
    } else {
      const existingEmp = await Employee.findOne({ emp_id: empId }).select('password');
      passwordToStore = existingEmp ? existingEmp.password : await hashPassword('MEVRICK1707');
    }

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
      password:       passwordToStore,
      work_location:  emp.work_location || emp.workLocation || '',
      address:        emp.address       || '',
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

app.post('/api/register', requirePermission('newEmployeeRegistration'), upload.any(), async (req, res) => {
  try {
    const emp = req.body;
    const empId = emp.emp_id || emp.employeeId;
    if (!empId) return res.status(400).json({ error: 'emp_id required' });

    let passwordToStore;
    if (emp.password) {
      passwordToStore = await hashPassword(emp.password);
    } else {
      const existingEmp = await Employee.findOne({ emp_id: empId }).select('password');
      passwordToStore = existingEmp ? existingEmp.password : await hashPassword('MEVRICK1707');
    }

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
      password:       passwordToStore,
      work_location:  emp.work_location || emp.workLocation || '',
      address:        emp.address       || '',
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
//  DOCUMENTS
// ════════════════════════════════════════════════════════

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

app.get('/api/documents/:empId', async (req, res) => {
  try {
    const empId = decodeURIComponent(req.params.empId);

    if (!(await verifySuperAdmin(req))) {
      const adminId = req.headers['x-admin-id'];
      if (adminId) {
        const admin = await Admin.findOne({ admin_id: adminId });
        if (!admin) return res.status(404).json({ error: 'Admin not found' });
        if (!(admin.assigned_employees || []).includes(empId)) {
          return res.status(403).json({ error: 'This employee is not assigned to you.' });
        }
      }
    }

    const docs = await Document.find({ emp_id: empId });
    const out = {};
    docs.forEach(d => { out[d.doc_type] = d.data; });
    res.json(out);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/documents/:empId', async (req, res) => {
  try {
    const empId = decodeURIComponent(req.params.empId);

    if (!(await verifySuperAdmin(req))) {
      const adminId = req.headers['x-admin-id'];
      if (adminId) {
        const admin = await Admin.findOne({ admin_id: adminId });
        if (!admin) return res.status(404).json({ error: 'Admin not found' });
        if (!(admin.assigned_employees || []).includes(empId)) {
          return res.status(403).json({ error: 'This employee is not assigned to you.' });
        }
      }
    }

    await Document.deleteMany({ emp_id: empId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

///////////////////////////////
app.patch('/api/admins/:adminId', requireSuperAdmin, async (req, res) => {
  try {
    const { assigned_employees, role, permissions } = req.body;
    const update = {};
    if (assigned_employees !== undefined) update.assigned_employees = assigned_employees;
    if (role !== undefined) update.role = role;
    if (permissions !== undefined) update.permissions = permissions;
    const admin = await Admin.findOneAndUpdate(
      { admin_id: req.params.adminId },
      { $set: update },
      { new: true }
    );
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    res.json({ success: true, admin });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
//////////////////////////////
app.delete(
  '/api/employees/:empId',
  requirePermission('employeeDatabase'),
  requireAssignedEmployee(req => decodeURIComponent(req.params.empId)),
  async (req, res) => {
  try {
    await Employee.deleteOne({ emp_id: decodeURIComponent(req.params.empId) });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════
//  ATTENDANCE
// ════════════════════════════════════════════════════════

function sendAttendancePhoto(res, photo) {
  if (!photo || typeof photo !== 'string') return false;
  const trimmed = photo.trim();
  if (!trimmed) return false;
  res.set('Cache-Control', 'private, max-age=300');
  const dataUri = /^data:([^;]+);base64,([\s\S]+)$/i.exec(trimmed);
  if (dataUri) {
    res.set('Content-Type', dataUri[1]);
    res.send(Buffer.from(dataUri[2].replace(/\s/g, ''), 'base64'));
    return true;
  }
  try {
    const buf = Buffer.from(trimmed.replace(/\s/g, ''), 'base64');
    if (buf.length < 32) return false;
    res.set('Content-Type', 'image/jpeg');
    res.send(buf);
    return true;
  } catch {
    return false;
  }
}

app.get('/api/attendance', async (req, res) => {
  try {
    // Do not send base64 selfies in the list payload — that response can be
    // hundreds of MB and the dashboard fetch times out, then falls back to
    // localStorage (the red "Could not reach the backend" banner).
    const records = await Attendance.aggregate([
      {
        $addFields: {
          has_photo: { $gt: [{ $strLenCP: { $ifNull: ['$photo', ''] } }, 30] }
        }
      },
      { $project: { photo: 0 } },
      { $sort: { date: -1 } }
    ]).option({ maxTimeMS: 20000 });
    res.json(records);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/attendance-photo/:id', async (req, res) => {
  try {
    const rec = await Attendance.findById(req.params.id).select('photo').lean().maxTimeMS(10000);
    if (!sendAttendancePhoto(res, rec && rec.photo)) return res.status(404).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/attendance-photo', async (req, res) => {
  try {
    const { emp_id, date } = req.query;
    if (!emp_id || !date) return res.status(400).json({ error: 'emp_id and date required' });
    const rec = await Attendance.findOne({ emp_id, date }).select('photo').lean().maxTimeMS(10000);
    if (!sendAttendancePhoto(res, rec && rec.photo)) return res.status(404).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/employee-attendance', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    const records = await Attendance.find({ emp_id: id })
      .select('-photo')
      .sort({ date: -1 })
      .lean()
      .maxTimeMS(15000);
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
      tasks: d.tasks || [],
      note: d.note || '', updated_at: new Date()
    };
    // Never overwrite an existing selfie with an empty string (clock-out / retry syncs).
    if (d.photo) data.photo = d.photo;
    const entry = await Attendance.findOneAndUpdate(
      { emp_id: d.emp_id, date: d.date },
      { $set: data },
      { upsert: true, new: true }
    );
    res.json({ success: true, entry });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete(
  '/api/attendance/:empId/:date',
  requirePermission('attendance'),
  requireAssignedEmployee(req => req.params.empId),
  async (req, res) => {
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

app.post('/api/leaves', requirePermission('leave'), async (req, res) => {
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

app.get('/api/salary', requirePermission('salary'), async (req, res) => {
  try {
    const { emp_id } = req.query;
    const filter = emp_id ? { emp_id } : {};
    const entries = await Salary.find(filter).sort({ date: -1 });
    res.json(entries);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/salary', requirePermission('salary'), async (req, res) => {
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

app.delete('/api/salary/:id', requirePermission('salary'), async (req, res) => {
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
    const emp = await Employee.findOne({ emp_id: id });
    if (emp && await verifyAndMigratePassword(password, emp)) {
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
    const isSuper = await verifySuperAdmin(req);
    let query = Admin.find().sort({ created_at: -1 });
    if (!isSuper) query = query.select('-password');
    const admins = await query;
    res.json(admins);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admins', requireSuperAdmin, async (req, res) => {
  try {
    const { admin_id, password, employee_id, employee_name, assigned_employees, role, permissions } = req.body;

    if (!admin_id || !password || !employee_id) {
      return res.status(400).json({ error: 'admin_id, password and employee_id are required' });
    }

    const existing = await Admin.findOne({ admin_id });
    if (existing) {
      existing.employee_name = employee_name || existing.employee_name;
      existing.assigned_employees = assigned_employees || existing.assigned_employees;
      existing.role = role || existing.role;
      if (permissions) existing.permissions = permissions;
      await existing.save();
      return res.json({ success: true, admin: existing, updated: true });
    }

    const admin = new Admin({
      admin_id,
      password: await hashPassword(password),
      employee_id,
      employee_name: employee_name || '',
      assigned_employees: assigned_employees || [],
      role: role || 'normal',
      permissions: permissions || undefined // let schema defaults apply if not sent
    });

    await admin.save();
    res.json({ success: true, admin });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admins/:adminId', requireSuperAdmin, async (req, res) => {
  try {
    await Admin.deleteOne({ admin_id: req.params.adminId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/employee-login', loginLimiter, async (req, res) => {
  try {
    const { emp_id, password } = req.body;
    if (!emp_id || !password) return res.status(400).json({ error: 'emp_id and password required' });
    const emp = await Employee.findOne({ emp_id });
    if (emp && await verifyAndMigratePassword(password, emp)) {
      res.json({ success: true, employee: { id: emp.emp_id, name: emp.employee_name } });
    } else {
      res.status(401).json({ success: false, error: 'Invalid Employee ID or Password' });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin-login', loginLimiter, async (req, res) => {
  try {
    const { admin_id, password } = req.body;
    const admin = await Admin.findOne({ admin_id });
    if (admin && await verifyAndMigratePassword(password, admin)) {
      res.json({ success: true, admin });
    } else {
      res.status(401).json({ success: false, error: 'Invalid Admin ID or Password' });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════
//  SUPER ADMIN (login + change password)
// ════════════════════════════════════════════════════════

app.post('/api/super-admin/login', loginLimiter, async (req, res) => {
  try {
    const { id, password } = req.body;
    if (!id || !password) return res.status(400).json({ error: 'id and password required' });
    const sa = await SuperAdmin.findOne({ super_id: id });
    if (!sa || !await verifyAndMigratePassword(password, sa)) {
      return res.status(401).json({ error: 'Invalid Super Admin ID or Password' });
    }
    res.json({ success: true, superAdmin: { id: sa.super_id, name: sa.name } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/super-admin/change-password', async (req, res) => {
  try {
    const { id, currentPassword, newPassword } = req.body;
    if (!id || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'id, currentPassword and newPassword are required' });
    }
    const sa = await SuperAdmin.findOne({ super_id: id });
    if (!sa) return res.status(404).json({ error: 'Super Admin not found' });
    if (!await verifyAndMigratePassword(currentPassword, sa)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    sa.password = await hashPassword(newPassword);
    await sa.save();
    res.json({ success: true });
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
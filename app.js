/**
 * Vidya Sethu Admin — Express + EJS server
 * ------------------------------------------------
 */

const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');

const connection = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "Nupur@2006",
    database: "scholarshipdb",
    waitForConnections: true,
    connectionLimit: 10
});

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'change-this-to-a-long-random-string', // move to env var in production
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 hour session
}));

// ---------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------

// For page routes (redirects to /login if not authenticated)
function requireAuth(req, res, next) {
  if (!req.session || !req.session.admin) {
    return res.redirect('/login');
  }
  req.admin = req.session.admin;
  next();
}

// For JSON/fetch API routes (returns 401 instead of redirecting)
function requireAuthApi(req, res, next) {
  if (!req.session || !req.session.admin) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.admin = req.session.admin;
  next();
}

// =======================================================================
// LOGIN  —  GET/POST /login,  GET /logout
// =======================================================================

app.get('/login', (req, res) => {
  if (req.session && req.session.admin) {
    return res.redirect('/');
  }
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render('login', { error: 'Please enter both email and password.' });
    }

    const [rows] = await connection.query(
      `SELECT Admin_ID, Name, Email, Password FROM admin WHERE Email = ?`,
      [email]
    );

    if (!rows.length) {
      return res.render('login', { error: 'Invalid email or password.' });
    }

    const adminRow = rows[0];

    // ⚠️ Plaintext comparison — matches current schema. Switch to bcrypt for production.
    if (adminRow.Password !== password) {
      return res.render('login', { error: 'Invalid email or password.' });
    }

    req.session.admin = {
      id: adminRow.Admin_ID,
      initials: adminRow.Name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
      name: adminRow.Name,
      role: 'Super Admin', // TODO: pull from a real role column if you add one
      email: adminRow.Email,
      employeeId: `ADM-${String(adminRow.Admin_ID).padStart(4, '0')}`,
      department: 'Higher & Technical Education', // TODO: replace once you have a real column
      lastLogin: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    };

    res.redirect('/');
  } catch (err) {
    console.error('Login error:', err);
    res.render('login', { error: 'Something went wrong. Please try again.' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// =======================================================================
// DASHBOARD  —  GET /
// =======================================================================
app.get('/', requireAuth, async (req, res) => {
  const admin = req.admin;

  const [students] = await connection.query(
    "SELECT COUNT(Student_ID) AS count FROM Students"
  );

  const [scholarships] = await connection.query(
    "SELECT COUNT(Scholarship_ID) AS count FROM Scholarships"
  );

  const [applications] = await connection.query(
    "SELECT COUNT(Application_ID) AS count FROM Applications"
  );

  const [pending] = await connection.query(`
    SELECT COUNT(document_id) AS count
    FROM Documents
    WHERE Aadhaar_Status='Pending'
       OR Income_Certificate_Status='Pending'
       OR Caste_Certificate_Status='Pending'
       OR Bonafide_Status='Pending'
       OR Marksheet_Status='Pending'
  `);

  const [approved] = await connection.query(
    "SELECT COUNT(Application_ID) AS count FROM Applications WHERE Status='Approved'"
  );

  const [rejected] = await connection.query(
    "SELECT COUNT(Application_ID) AS count FROM Applications WHERE Status='Rejected'"
  );

  const totalApplications = applications[0].count;
  const approvedApplications = approved[0].count;
  const rejectedApplications = rejected[0].count;

  const kpis = {
    totalStudents: students[0].count,
    studentsGrowthPct: 3.2,

    totalScholarships: scholarships[0].count,
    newScholarshipsThisQuarter: 12,

    totalApplications: totalApplications,
    applicationsGrowthPct: 8.4,

    pendingApplications: pending[0].count,
    pendingAvgWaitDays: 5,

    approvedApplications: approvedApplications,
    approvalRatePct:
      totalApplications > 0
        ? ((approvedApplications / totalApplications) * 100).toFixed(2)
        : 0,

    rejectedApplications: rejectedApplications,
    rejectedPct:
      totalApplications > 0
        ? ((rejectedApplications / totalApplications) * 100).toFixed(2)
        : 0,

    pendingDocVerification: pending[0].count,
  };

  // TODO: SELECT month, submitted_count, approved_count FROM monthly_application_stats ORDER BY month
  const trend = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
    submitted: [1800, 2100, 1950, 2400, 2800, 2600, 3100, 3412],
    approved: [1200, 1450, 1500, 1850, 2100, 2000, 2350, 2600],
  };

  // TODO: SELECT ... FROM applications JOIN students JOIN scholarships ORDER BY submitted_at DESC LIMIT 5
  const recentApplications = [
    { initials: 'AN', studentName: 'Ananya Nair', college: 'MIT College of Engg.', scholarshipName: 'Merit-cum-Means Grant', amount: 45000, status: 'Pending' },
    { initials: 'RK', studentName: 'Rohan Kulkarni', college: 'SPPU, Pune', scholarshipName: 'SC/ST Post-Matric', amount: 28500, status: 'Approved' },
    { initials: 'SP', studentName: 'Sneha Patil', college: 'VJTI, Mumbai', scholarshipName: 'Girl Child STEM Award', amount: 60000, status: 'Pending' },
    { initials: 'MJ', studentName: 'Manav Joshi', college: 'COEP Technological Univ.', scholarshipName: 'Minority Welfare Fund', amount: 32000, status: 'Rejected' },
    { initials: 'TD', studentName: 'Tanvi Deshmukh', college: 'Fergusson College', scholarshipName: 'Sports Excellence Grant', amount: 20000, status: 'Approved' },
  ];

  // TODO: SELECT name, seats_filled, seats_total FROM scholarships ORDER BY (seats_filled/seats_total) DESC LIMIT 5
  const seatAvailability = [
    { name: 'Merit-cum-Means Grant', filled: 1840, total: 2000 },
    { name: 'SC/ST Post-Matric Scheme', filled: 2210, total: 3500 },
    { name: 'Girl Child STEM Award', filled: 640, total: 1200 },
    { name: 'Minority Welfare Fund', filled: 980, total: 2500 },
    { name: 'Sports Excellence Grant', filled: 410, total: 900 },
  ];

  // TODO: SELECT document_name, student_name, uploaded_at FROM documents WHERE status='pending' ORDER BY uploaded_at LIMIT 3
  const docVerification = [
    { docName: 'Income Certificate', studentName: 'Ananya Nair', timeAgo: '2h ago' },
    { docName: 'Caste Certificate', studentName: 'Rohan Kulkarni', timeAgo: '5h ago' },
    { docName: 'Fee Receipt', studentName: 'Sneha Patil', timeAgo: '1d ago' },
  ];

  // TODO: SELECT college_name, COUNT(*) FROM applications GROUP BY college_name ORDER BY COUNT(*) DESC LIMIT 5
  const topColleges = {
    labels: ['COEP', 'VJTI', 'SPPU', 'Fergusson', 'MIT-WPU'],
    data: [1840, 1620, 1510, 1280, 1090],
  };

  // TODO: SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 3
  const recentActivity = [
    { html: '<b>Rina Acharya</b> approved 42 applications', timeAgo: '18 minutes ago' },
    { html: 'New scholarship <b>"Rural Girl Child STEM Award"</b> published', timeAgo: '1 hour ago' },
    { html: 'Database backup completed <b>(2.4 GB)</b>', timeAgo: '3 hours ago' },
  ];

  res.render('dashboard', {
    admin,
    today: new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    kpis,
    trend,
    recentApplications,
    seatAvailability,
    docVerification,
    topColleges,
    recentActivity,
  });
});

// =======================================================================
// STUDENT MANAGEMENT  —  GET /students
// =======================================================================

function mapStudentRow(row) {
  return {
    id: row.Student_ID,
    initials: row.Student_Name
      .split(" ")
      .map(x => x[0])
      .join("")
      .substring(0, 2),

    name: row.Student_Name,
    studentCode: row.Student_ID,
    college: row.College_Name,
    collegeFull: row.College_Name,
    state: row.State_Name,
    category: row.Category,
    cgpa: row.CGPA,
    eligibilityLabel: row.Eligibility_Status,
    eligibilityClass:
      row.Eligibility_Status === "Eligible"
        ? "eligible"
        : row.Eligibility_Status === "Ineligible"
          ? "ineligible"
          : "review"
  };
}

app.get('/students', requireAuth, async (req, res) => {

  const admin = req.admin;

  const [studentRows] = await connection.query(`
        SELECT
        s.Student_ID,
        CONCAT(s.First_Name,' ',s.Last_Name) AS Student_Name,
        c.College_Name,
        st.State_Name,
        s.Category,
        s.CGPA,
        (
            SELECT a.Verification_Status
            FROM Applications a
            WHERE a.Student_ID = s.Student_ID
            ORDER BY a.Application_ID DESC
            LIMIT 1
        ) AS Verification_Status
    FROM Students s
    JOIN Colleges c ON s.College_ID = c.College_ID
    JOIN States st ON s.State_ID = st.State_ID
    ORDER BY s.First_Name;
    `);

  const students = studentRows.map(mapStudentRow);
  const [rows] = await connection.query("SELECT College_Name FROM Colleges");
  const [stateRows] = await connection.query("SELECT State_Name FROM States");
  const selectedStudent = {
    ...students[0],

    course: "B.Tech, Computer Engg. · 3rd Year",
    familyIncome: 240000,
    contact: "+91 98xxxxxx21",

    stats: {
      applied: 6,
      approved: 3,
      pending: 1
    },

    applicationHistory: [
      {
        scholarshipName: "Merit-cum-Means Grant",
        statusLine: "Submitted 12 Jul 2026",
        statusLabel: "Pending",
        statusClass: "review"
      },
      {
        scholarshipName: "Girl Child STEM Award",
        statusLine: "Approved 2 Jun 2026",
        statusLabel: "Approved",
        statusClass: "eligible"
      }
    ],

    documents: [
      {
        name: "Income Certificate",
        icon: "✓",
        iconClass: "ok"
      },
      {
        name: "Caste Certificate",
        icon: "✓",
        iconClass: "ok"
      },
      {
        name: "Bonafide Certificate",
        icon: "!",
        iconClass: "no"
      }
    ],

    scholarships: [
      {
        name: "Merit Scholarship",
        amount: 50000,
        deadline: "31 Aug 2026",
        statusLabel: "Eligible",
        statusClass: "eligible"
      },
      {
        name: "State Scholarship",
        amount: 25000,
        deadline: "15 Sep 2026",
        statusLabel: "Pending",
        statusClass: "review"
      }
    ]
  };

  const pagination = {
    from: 1,
    to: students.length,
    totalCount: students.length,
    currentPage: 1,
    totalPages: 1
  };

  res.render("student-management", {
    rows,
    stateRows,
    admin,
    students,
    selectedStudent,
    pagination
  });

});

app.get('/students/filter', requireAuthApi, async (req, res) => {
  try {
    const { college, state, category, cgpa, eligibility } = req.query;

    let sql = `
            SELECT
                s.Student_ID,
                CONCAT(s.First_Name,' ',s.Last_Name) AS Student_Name,
                c.College_Name,
                st.State_Name,
                s.Category,
                s.CGPA,
                (
                    SELECT a.Verification_Status
                    FROM Applications a
                    WHERE a.Student_ID = s.Student_ID
                    ORDER BY a.Application_ID DESC
                    LIMIT 1
                ) AS Verification_Status
            FROM Students s
            JOIN Colleges c ON s.College_ID = c.College_ID
            JOIN States st ON s.State_ID = st.State_ID
            WHERE 1=1
        `;
    const params = [];

    if (college) {
      sql += ` AND c.College_Name = ?`;
      params.push(college);
    }
    if (state) {
      sql += ` AND st.State_Name = ?`;
      params.push(state);
    }
    if (category) {
      sql += ` AND s.Category = ?`;
      params.push(category);
    }
    if (cgpa) {
      sql += ` AND s.CGPA >= ?`;
      params.push(parseFloat(cgpa));
    }
    if (eligibility) {
      sql += ` HAVING Verification_Status = ?`;
      params.push(eligibility);
    }

    sql += ` ORDER BY s.First_Name;`;

    const [studentRows] = await connection.query(sql, params);
    const students = studentRows.map(mapStudentRow);

    res.json({
      students,
      pagination: {
        from: students.length ? 1 : 0,
        to: students.length,
        totalCount: students.length,
        currentPage: 1,
        totalPages: 1
      }
    });

  } catch (err) {
    console.error('Error filtering students:', err);
    res.status(500).json({ error: 'Failed to filter students' });
  }
});

app.get('/students/:id', requireAuthApi, async (req, res) => {
  try {
    const studentId = req.params.id;

    const [studentRows] = await connection.query(`
            SELECT
                s.Student_ID,
                CONCAT(s.First_Name,' ',s.Last_Name) AS Student_Name,
                c.College_Name,
                st.State_Name,
                s.Category,
                s.CGPA,
                s.Annual_Income,
                
                a.Verification_Status
            FROM Students s
            JOIN Colleges c ON s.College_ID = c.College_ID
            JOIN States st ON s.State_ID = st.State_ID
            LEFT JOIN Applications a ON s.Student_ID = a.Student_ID
            WHERE s.Student_ID = ?
        `, [studentId]);

    if (!studentRows.length) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = mapStudentRow(studentRows[0]);

    // Application history
    const [historyRows] = await connection.query(`
            SELECT sch.Scholarship_Name,a.Verification_Status
            FROM Applications a
            JOIN Scholarships sch ON a.Scholarship_ID = sch.Scholarship_ID
            WHERE a.Student_ID = ?
            
        `, [studentId]);
    const [docRows] = await connection.query(`
    SELECT
        Aadhaar_Status,
        Income_Certificate_Status,
        Caste_Certificate_Status,
        Bonafide_Status,
        Marksheet_Status
    FROM Documents
    WHERE Student_ID = ?
`, [studentId]);

    const DOCUMENT_LABELS = [
      { key: 'Aadhaar_Status', name: 'Aadhaar Card' },
      { key: 'Income_Certificate_Status', name: 'Income Certificate' },
      { key: 'Caste_Certificate_Status', name: 'Caste Certificate' },
      { key: 'Bonafide_Status', name: 'Bonafide Certificate' },
      { key: 'Marksheet_Status', name: 'Marksheet' }
    ];

    const docRow = docRows[0] || {}; // handle case where no row exists yet for this student

    const documents = DOCUMENT_LABELS.map(({ key, name }) => {
      const status = docRow[key] || 'Pending'; // default if no record
      let icon, iconClass;

      if (status === 'Verified') {
        icon = '✓'; iconClass = 'ok';
      } else if (status === 'Rejected') {
        icon = '✕'; iconClass = 'no';
      } else {
        icon = '!'; iconClass = 'pending';
      }

      return { name, status, icon, iconClass };
    });
    // Available/eligible scholarships
    const [schRows] = await connection.query(`
            SELECT sch.Scholarship_Name, sch.scholarship_Amount, sch.Deadline, a.Verification_Status
            FROM Scholarships sch
            LEFT JOIN Applications a
                ON a.Scholarship_ID = sch.Scholarship_ID AND a.Student_ID = ?
        `, [studentId]);

    const applied = historyRows.length;
    const approved = historyRows.filter(h => h.Verification_Status === 'Approved').length;
    const pending = historyRows.filter(h => h.Verification_Status === 'Pending').length;

    const selectedStudent = {
      ...student,

      familyIncome: studentRows[0].Family_Income || 0,

      stats: { applied, approved, pending },

      applicationHistory: historyRows.map(h => ({
        scholarshipName: h.Scholarship_Name,

        statusLabel: h.Verification_Status,
        statusClass: h.Verification_Status === 'Approved' ? 'eligible'
          : h.Verification_Status === 'Rejected' ? 'no'
            : 'review'
      })),

      documents: documents,

      scholarships: schRows.map(s => ({
        name: s.Scholarship_Name,
        amount: s.Amount,

        statusLabel: s.Verification_Status || 'Eligible',
        statusClass: s.Verification_Status === 'Approved' ? 'eligible' : 'review'
      }))
    };

    res.json(selectedStudent);

  } catch (err) {
    console.error('Error fetching student detail:', err);
    res.status(500).json({ error: 'Failed to load student details' });
  }
});


// =======================================================================
// APPLICATION MANAGEMENT  —  GET /applications
// =======================================================================
const statusClassMap = { pending: 'pending', approved: 'approved', rejected: 'rejected' };

const toApplicationCode = (id) => `APP-${String(id).padStart(6, '0')}`;

async function getApplicationDetail(applicationId) {
  const [selRows] = await connection.query(
    `
    SELECT
      a.Application_ID AS id,
      a.Application_Date AS applicationDate,
      a.Status AS statusLabel,
      a.Verification_Status AS verificationStatus,
      CONCAT(s.First_Name, ' ', s.Last_Name) AS studentName,
      s.CGPA AS cgpa,
      s.Category AS category,
      s.Annual_Income AS familyIncome,
      sch.Scholarship_Name AS scholarshipName,
      sch.Scholarship_Amount AS amount
    FROM Applications a
    JOIN Students s ON s.Student_ID = a.Student_ID
    JOIN Scholarships sch ON sch.Scholarship_ID = a.Scholarship_ID
    WHERE a.Application_ID = ?
    `,
    [applicationId]
  );

  if (!selRows.length) return null;

  const row = selRows[0];

  const formattedDate = row.applicationDate
    ? new Date(row.applicationDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    : '—';

  const verificationDone = row.verificationStatus === 'Verified' || row.verificationStatus === 'Rejected';
  const decisionDone = row.statusLabel === 'Approved' || row.statusLabel === 'Rejected';

  const steps = [
    { number: 1, title: 'Submitted', date: formattedDate, state: 'done' },
    {
      number: 2,
      title: 'Verification',
      date: row.verificationStatus || 'Pending',
      state: verificationDone ? 'done' : 'current',
    },
    {
      number: 3,
      title: 'Decision',
      date: decisionDone ? row.statusLabel : 'Pending',
      state: decisionDone ? 'done' : (verificationDone ? 'current' : ''),
    },
  ];

  return {
    id: row.id,
    studentName: row.studentName,
    applicationCode: toApplicationCode(row.id),
    scholarshipName: row.scholarshipName,
    statusLabel: row.statusLabel,
    statusClass: statusClassMap[row.statusLabel?.toLowerCase()] || 'pending',
    amount: Number(row.amount),
    cgpa: row.cgpa,
    category: row.category,
    familyIncome: Number(row.familyIncome),
    verificationStatus: row.verificationStatus,
    steps,
    documents: [],
  };
}

app.get('/applications', requireAuth, async (req, res) => {
  const admin = req.admin;
  const activeTab = req.query.tab || 'Pending';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = 5;
  const offset = (page - 1) * pageSize;
  const searchQuery = (req.query.q || '').trim();
  const selectedScholarship = req.query.scholarship || '';
  const selectedCollege = req.query.college || '';

  const tabs = [
    { key: 'Pending', label: 'Pending' },
    { key: 'Approved', label: 'Approved' },
    { key: 'Rejected', label: 'Rejected' },
  ];

  const [pendingStats] = await connection.query(`
    SELECT
      COUNT(*) AS count,
      ROUND(AVG(DATEDIFF(NOW(), Application_Date))) AS avgWaitDays
    FROM Applications
    WHERE Status = 'Pending'
  `);
  const [approvedStats] = await connection.query(
    `SELECT COUNT(*) AS count FROM Applications WHERE Status = 'Approved'`
  );
  const [rejectedStats] = await connection.query(
    `SELECT COUNT(*) AS count FROM Applications WHERE Status = 'Rejected'`
  );
  const [totalStats] = await connection.query(
    `SELECT COUNT(*) AS count FROM Applications`
  );

  const totalApps = totalStats[0].count || 1;

  const kpis = {
    pendingCount: pendingStats[0].count,
    pendingAvgWaitDays: pendingStats[0].avgWaitDays || 0,
    approvedCount: approvedStats[0].count,
    approvedPct: Math.round((approvedStats[0].count / totalApps) * 100),
    rejectedCount: rejectedStats[0].count,
    rejectedPct: Math.round((rejectedStats[0].count / totalApps) * 100),
  };

  const whereClauses = ['a.Status = ?'];
  const whereParams = [activeTab];

  if (searchQuery) {
    whereClauses.push('(CONCAT(s.First_Name, " ", s.Last_Name) LIKE ? OR sch.Scholarship_Name LIKE ?)');
    whereParams.push(`%${searchQuery}%`, `%${searchQuery}%`);
  }
  if (selectedScholarship) {
    whereClauses.push('sch.Scholarship_ID = ?');
    whereParams.push(selectedScholarship);
  }
  if (selectedCollege) {
    whereClauses.push('s.College_ID = ?');
    whereParams.push(selectedCollege);
  }

  const whereSql = whereClauses.join(' AND ');

  const [totalRows] = await connection.query(
    `
    SELECT COUNT(*) AS count
    FROM Applications a
    JOIN Students s ON s.Student_ID = a.Student_ID
    JOIN Scholarships sch ON sch.Scholarship_ID = a.Scholarship_ID
    WHERE ${whereSql}
    `,
    whereParams
  );
  const totalCount = totalRows[0].count;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const [rows] = await connection.query(
    `
    SELECT
      a.Application_ID AS id,
      a.Application_Date AS applicationDate,
      CONCAT(s.First_Name, ' ', s.Last_Name) AS studentName,
      sch.Scholarship_Name AS scholarshipName,
      sch.Scholarship_Amount AS amount,
      a.Status AS statusLabel
    FROM Applications a
    JOIN Students s ON s.Student_ID = a.Student_ID
    JOIN Scholarships sch ON sch.Scholarship_ID = a.Scholarship_ID
    WHERE ${whereSql}
    ORDER BY a.Application_Date DESC
    LIMIT ? OFFSET ?
    `,
    [...whereParams, pageSize, offset]
  );

  const applications = rows.map(row => ({
    id: row.id,
    applicationCode: toApplicationCode(row.id),
    studentName: row.studentName,
    scholarshipName: row.scholarshipName,
    amount: Number(row.amount),
    statusLabel: row.statusLabel,
    statusClass: statusClassMap[row.statusLabel?.toLowerCase()] || 'pending',
  }));

  const selectedId = req.query.id ? parseInt(req.query.id, 10) : (applications[0]?.id ?? null);
  const selectedApplication = selectedId ? await getApplicationDetail(selectedId) : null;

  const [scholarshipOptions] = await connection.query(
    `SELECT Scholarship_ID AS id, Scholarship_Name AS name FROM Scholarships ORDER BY Scholarship_Name`
  );

  const [collegeOptions] = await connection.query(
    `SELECT College_ID AS id, College_Name AS name FROM Colleges ORDER BY College_Name`
  );

  const pagination = {
    from: totalCount === 0 ? 0 : offset + 1,
    to: Math.min(offset + pageSize, totalCount),
    totalCount,
    currentPage: page,
    totalPages,
  };

  res.render('application-management', {
    admin,
    tabs,
    activeTab,
    kpis,
    applications,
    selectedApplication,
    pagination,
    query: searchQuery,
    scholarshipOptions,
    collegeOptions,
    selectedScholarship,
    selectedCollege,
  });
});

app.get('/applications/api/:id', requireAuthApi, async (req, res) => {
  const applicationId = parseInt(req.params.id, 10);

  if (!Number.isInteger(applicationId)) {
    return res.status(400).json({ error: 'Invalid application id' });
  }

  try {
    const detail = await getApplicationDetail(applicationId);
    if (!detail) {
      return res.status(404).json({ error: 'Application not found' });
    }
    res.json(detail);
  } catch (err) {
    console.error('Failed to fetch application detail:', err);
    res.status(500).json({ error: 'Could not load application detail' });
  }
});

app.post('/applications/:id/:action(approve|reject)', requireAuthApi, async (req, res) => {
  const applicationId = parseInt(req.params.id, 10);
  const action = req.params.action;
  const newStatus = action === 'approve' ? 'Approved' : 'Rejected';

  if (!Number.isInteger(applicationId)) {
    return res.status(400).json({ error: 'Invalid application id' });
  }

  try {
    const [result] = await connection.query(
      `UPDATE Applications SET Status = ? WHERE Application_ID = ?`,
      [newStatus, applicationId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({ success: true, status: newStatus });
  } catch (err) {
    console.error('Failed to update application status:', err);
    res.status(500).json({ error: 'Could not update application status' });
  }
});

app.get('/applications/export', requireAuth, async (req, res) => {
  const activeTab = req.query.tab || 'Pending';
  const searchQuery = (req.query.q || '').trim();
  const selectedScholarship = req.query.scholarship || '';
  const selectedCollege = req.query.college || '';

  const whereClauses = ['a.Status = ?'];
  const whereParams = [activeTab];

  if (searchQuery) {
    whereClauses.push('(CONCAT(s.First_Name, " ", s.Last_Name) LIKE ? OR sch.Scholarship_Name LIKE ?)');
    whereParams.push(`%${searchQuery}%`, `%${searchQuery}%`);
  }
  if (selectedScholarship) {
    whereClauses.push('sch.Scholarship_ID = ?');
    whereParams.push(selectedScholarship);
  }
  if (selectedCollege) {
    whereClauses.push('s.College_ID = ?');
    whereParams.push(selectedCollege);
  }

  const whereSql = whereClauses.join(' AND ');

  try {
    const [rows] = await connection.query(
      `
      SELECT
        a.Application_ID AS applicationId,
        CONCAT(s.First_Name, ' ', s.Last_Name) AS studentName,
        sch.Scholarship_Name AS scholarshipName,
        sch.Scholarship_Amount AS amount,
        a.Status AS status,
        s.CGPA AS cgpa,
        s.Category AS category,
        s.Annual_Income AS familyIncome
      FROM Applications a
      JOIN Students s ON s.Student_ID = a.Student_ID
      JOIN Scholarships sch ON sch.Scholarship_ID = a.Scholarship_ID
      WHERE ${whereSql}
      ORDER BY a.Application_Date DESC
      `,
      whereParams
    );

    const header = ['Application ID', 'Student Name', 'Scholarship', 'Amount', 'Status', 'CGPA', 'Category', 'Family Income'];
    const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const lines = [header.join(',')];
    rows.forEach(r => {
      lines.push([
        `APP-${String(r.applicationId).padStart(6, '0')}`,
        escapeCsv(r.studentName),
        escapeCsv(r.scholarshipName),
        r.amount,
        escapeCsv(r.status),
        r.cgpa,
        escapeCsv(r.category),
        r.familyIncome,
      ].join(','));
    });

    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="applications-${activeTab}-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Export failed:', err);
    res.status(500).send('Export failed');
  }
});

// =======================================================================
// SCHOLARSHIP MANAGEMENT  —  GET /scholarships
// =======================================================================
app.get('/scholarships',requireAuth, async (req, res) => {
  const admin = req.admin;
  const activeTab = req.query.tab || 'Pending';
 
  // ---- read filters/pagination from query string ----
  const search   = (req.query.search || '').trim();
  const category = req.query.category || '';       // '', General, OBC, SC, ST, EWS, All
  const status   = req.query.status || '';          // '', Open, Closed
  const sort     = req.query.sort === 'desc' ? 'DESC' : 'ASC'; // deadline direction
  const page     = Math.max(parseInt(req.query.page) || 1, 1);
  const perPage  = 6;
  const offset   = (page - 1) * perPage;
 
  // ---- build WHERE clause dynamically ----
  const whereClauses = [];
  const params = [];
 
  if (search) {
    whereClauses.push('Scholarship_Name LIKE ?');
    params.push(`%${search}%`);
  }
  if (category) {
    whereClauses.push('Category = ?');
    params.push(category);
  }
  if (status) {
    whereClauses.push('Status = ?');
    params.push(status);
  }
 
  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
 
  // ---- total count for pagination ----
  const [countRows] = await connection.query(
    `SELECT COUNT(*) AS cnt FROM Scholarships ${whereSql}`,
    params
  );
  const totalCount = countRows[0].cnt;
  const totalPages = Math.max(Math.ceil(totalCount / perPage), 1);
 
  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
 
  const initialsOf = (name) => (name || '')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '—';
 
  // ---- page of results ----
  const [rows] = await connection.query(
    `SELECT * FROM Scholarships ${whereSql} ORDER BY Deadline ${sort} LIMIT ? OFFSET ?`,
    [...params, perPage, offset]
  );
 
  const scholarships = rows.map(row => ({
    id: row.Scholarship_ID,
    name: row.Scholarship_Name || '',
    category: row.Category || '',
    amountPerStudent: Number(row.Scholarship_Amount || 0),
    seatsTotal: Number(row.Total_Seats || 0),
    deadline: formatDate(row.Deadline),
    statusLabel: row.Status || '',
    statusClass: (row.Status || '').toLowerCase() === 'open' ? 'active' : 'closed',
    initials: initialsOf(row.Scholarship_Name),
  }));
 
  // ---- KPI cards (matching exactly what this .ejs reads) ----
  const [[{ totalAll }]] = await connection.query('SELECT COUNT(*) AS totalAll FROM Scholarships');
  const [[{ openCount }]] = await connection.query(
    "SELECT COUNT(*) AS openCount FROM Scholarships WHERE Status = 'Open'"
  );
  const [[{ seatSum }]] = await connection.query(
    'SELECT COALESCE(SUM(Total_Seats),0) AS seatSum FROM Scholarships'
  );
  const [[{ avgAmount }]] = await connection.query(
    'SELECT COALESCE(AVG(Scholarship_Amount),0) AS avgAmount FROM Scholarships'
  );
 
  const kpis = {
    total: totalAll,
    openCount,
    totalSeats: seatSum,
    avgAmount: Math.round(avgAmount),
  };
 
  // ---- selected scholarship (row clicked, or first row of the current page by default) ----
  const selectedId = req.query.selected
    ? Number(req.query.selected)
    : (scholarships[0] ? scholarships[0].id : null);
 
  let selectedScholarship = null;
 
  if (selectedId) {
    const [selRows] = await connection.query(
      'SELECT * FROM Scholarships WHERE Scholarship_ID = ?',
      [selectedId]
    );
    if (selRows.length) {
      const row = selRows[0];
      selectedScholarship = {
        id: row.Scholarship_ID,
        initials: initialsOf(row.Scholarship_Name),
        name: row.Scholarship_Name || '',
        code: `SCH-${String(row.Scholarship_ID).padStart(4, '0')}`,
        category: row.Category || '',
        provider: row.Provider || '—',
        statusLabel: row.Status || '',
        statusClass: (row.Status || '').toLowerCase() === 'open' ? 'active' : 'closed',
        amountPerStudent: Number(row.Scholarship_Amount || 0),
        minCgpa: row.Minimum_CGPA,
        incomeCeiling: row.Maximum_Income,
        seatsTotal: Number(row.Total_Seats || 0),
        deadline: formatDate(row.Deadline),
      };
    }
  }
 
  const pagination = {
    from: totalCount === 0 ? 0 : offset + 1,
    to: Math.min(offset + perPage, totalCount),
    totalCount,
    currentPage: page,
    totalPages,
  };
 
  res.render('scholarship-management', {
    admin,
    kpis,
    scholarships,
    selectedScholarship,
    pagination,
    filters: { search, category, status, sort },
  });
});


// =======================================================================
// ELIGIBILITY & VERIFICATION  —  GET /eligibility
// =======================================================================
const DOCUMENT_TYPES = [
  { key: 'Aadhaar_Status', name: 'Aadhaar Card' },
  { key: 'Income_Certificate_Status', name: 'Income Certificate' },
  { key: 'Caste_Certificate_Status', name: 'Caste Certificate' },
  { key: 'Bonafide_Status', name: 'Bonafide Certificate' },
  { key: 'Marksheet_Status', name: 'Marksheet' }
];

function parseCompositeId(compositeId) {
  const firstDash = compositeId.indexOf('-');
  if (firstDash === -1) return [null, null];
  return [compositeId.slice(0, firstDash), compositeId.slice(firstDash + 1)];
}

app.get('/eligibility', requireAuth, async (req, res) => {
  try {
    const admin = req.admin;
    const activeTab = req.query.tab || 'missing-documents';

    const tabs = [
      { key: 'missing-documents', label: 'Missing Documents' },
      { key: 'pending-verification', label: 'Pending Verification' },
      { key: 'verified', label: 'Verified' },
      { key: 'rejected-docs', label: 'Rejected Docs' },
    ];

    const kpis = {
      eligible: 38940,
      eligiblePct: 80.6,
      missingDocs: 2148,
      pendingVerification: 958,
      pendingAvgWaitDays: 5,
      rejectedDocs: 214,
    };

    const [colleges] = await connection.query("SELECT College_Name FROM Colleges");

    const { verifications, pagination } = await fetchVerifications({ tab: activeTab, page: 1 });

    const selectedVerification = verifications.length
      ? await fetchVerificationDetail(verifications[0].id)
      : null;

    res.render('eligibility-verification', {
      admin, tabs, activeTab, kpis, colleges,
      verifications, selectedVerification, pagination
    });
  } catch (err) {
    console.error('Error loading eligibility page:', err);
    res.status(500).send('Failed to load page');
  }
});

app.get('/eligibility/list', requireAuthApi, async (req, res) => {
  try {
    const { tab, page, documentType, college, search } = req.query;
    const result = await fetchVerifications({
      tab: tab || 'missing-documents',
      page: parseInt(page, 10) || 1,
      documentType,
      college,
      search
    });
    res.json(result);
  } catch (err) {
    console.error('Error fetching verification list:', err);
    res.status(500).json({ error: 'Failed to load list' });
  }
});

app.get('/eligibility/verification/:id', requireAuthApi, async (req, res) => {
  try {
    const detail = await fetchVerificationDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: 'Not found' });
    res.json(detail);
  } catch (err) {
    console.error('Error fetching verification detail:', err);
    res.status(500).json({ error: 'Failed to load detail' });
  }
});

app.patch('/eligibility/verification/:id/status', requireAuthApi, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Verified', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const [documentId, statusColumn] = parseCompositeId(req.params.id);
    const docTypeInfo = DOCUMENT_TYPES.find(d => d.key === statusColumn);
    if (!documentId || !docTypeInfo) {
      return res.status(400).json({ error: 'Invalid document reference' });
    }

    await connection.query(
      `UPDATE Documents SET ${statusColumn} = ? WHERE Document_ID = ?`,
      [status, documentId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

app.get('/eligibility/export', requireAuth, async (req, res) => {
  try {
    const { tab, documentType, college, search } = req.query;
    const { verifications } = await fetchVerifications({
      tab: tab || 'missing-documents',
      page: 1,
      pageSize: 1000000,
      documentType, college, search
    });

    const csvHeader = 'Student,College,Document Type,Status\n';
    const csvRows = verifications.map(v =>
      `"${v.studentName}","${v.college}","${v.documentType}","${v.statusLabel}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="verifications.csv"');
    res.send(csvHeader + csvRows);
  } catch (err) {
    console.error('Error exporting:', err);
    res.status(500).send('Export failed');
  }
});

async function fetchVerifications({ tab, page = 1, pageSize = 5, documentType, college, search }) {
  const tabStatusMap = {
    'pending-verification': 'Pending',
    'verified': 'Verified',
    'rejected-docs': 'Rejected'
  };
  const status = tabStatusMap[tab];

  let sql = `
    SELECT
      d.Document_ID,
      d.Student_ID,
      d.Aadhaar_Status,
      d.Income_Certificate_Status,
      d.Caste_Certificate_Status,
      d.Bonafide_Status,
      d.Marksheet_Status,
      CONCAT(s.First_Name,' ',s.Last_Name) AS studentName,
      s.Student_ID AS studentCode,
      c.College_Name AS college
    FROM Documents d
    JOIN Students s ON d.Student_ID = s.Student_ID
    JOIN Colleges c ON s.College_ID = c.College_ID
    WHERE 1=1
  `;
  const params = [];

  if (college) { sql += ` AND c.College_Name = ?`; params.push(college); }
  if (search) {
    sql += ` AND (s.First_Name LIKE ? OR s.Last_Name LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  const [rows] = await connection.query(sql, params);

  let virtualRows = [];
  rows.forEach(r => {
    DOCUMENT_TYPES.forEach(({ key, name }) => {
      const docStatus = r[key];

      virtualRows.push({
        id: `${r.Document_ID}-${key}`,
        documentId: r.Document_ID,
        studentId: r.Student_ID,
        studentCode: r.studentCode,
        statusColumn: key,
        studentName: r.studentName,
        college: r.college,
        documentType: name,
        statusLabel: docStatus || 'Missing',
        statusClass: docStatus === 'Verified' ? 'eligible'
          : docStatus === 'Rejected' ? 'rejected'
            : docStatus === 'Pending' ? 'review'
              : 'missing'
      });
    });
  });

  if (tab === 'missing-documents') {
    virtualRows = virtualRows.filter(v => v.statusLabel === 'Missing');
  } else if (status) {
    virtualRows = virtualRows.filter(v => v.statusLabel === status);
  }

  if (documentType) virtualRows = virtualRows.filter(v => v.documentType === documentType);

  const totalCount = virtualRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const offset = (page - 1) * pageSize;
  const pageRows = virtualRows.slice(offset, offset + pageSize);

  const verifications = pageRows.map(v => ({
    id: v.id,
    initials: v.studentName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
    studentName: v.studentName,
    college: v.college,
    documentType: v.documentType,
    statusLabel: v.statusLabel,
    statusClass: v.statusClass
  }));

  return {
    verifications,
    pagination: {
      from: totalCount ? offset + 1 : 0,
      to: Math.min(offset + pageSize, totalCount),
      totalCount,
      currentPage: page,
      totalPages
    }
  };
}

async function fetchVerificationDetail(compositeId) {
  const [documentId, statusColumn] = parseCompositeId(compositeId);
  const docTypeInfo = DOCUMENT_TYPES.find(d => d.key === statusColumn);
  if (!documentId || !docTypeInfo) return null;

  const [rows] = await connection.query(`
    SELECT
      d.Document_ID,
      d.${statusColumn} AS statusLabel,
      s.Student_ID AS studentCode,
      CONCAT(s.First_Name,' ',s.Last_Name) AS studentName
    FROM Documents d
    JOIN Students s ON d.Student_ID = s.Student_ID
    WHERE d.Document_ID = ?
  `, [documentId]);

  if (!rows.length) return null;
  const v = rows[0];
  const statusLabel = v.statusLabel || 'Missing';

  const checklist = [
    {
      label: 'Legible & unaltered',
      icon: statusLabel === 'Verified' || statusLabel === 'Rejected' ? '✓' : '?',
      iconClass: statusLabel === 'Verified' || statusLabel === 'Rejected' ? 'ok' : (statusLabel === 'Missing' ? 'missing' : 'wait')
    },
    {
      label: 'Issued by competent authority',
      icon: statusLabel === 'Verified' ? '✓' : '?',
      iconClass: statusLabel === 'Verified' ? 'ok' : (statusLabel === 'Missing' ? 'missing' : 'wait')
    },
  ];

  return {
    id: compositeId,
    documentId: v.Document_ID,
    statusColumn,
    fileName: statusLabel === 'Missing'
      ? 'Not yet uploaded'
      : `${docTypeInfo.name.toLowerCase().replace(/\s+/g, '_')}_${v.studentCode}.pdf`,
    studentName: v.studentName,
    studentCode: v.studentCode,
    documentType: docTypeInfo.name,
    statusLabel,
    checklist
  };
}

// =======================================================================
// REPORTS & ANALYTICS  —  GET /reports
// =======================================================================
function formatCr(amount) {
  const cr = Number(amount || 0) / 10000000;
  return `₹${cr.toFixed(1)}Cr`;
}

app.get('/reports', requireAuth, async (req, res) => {
  try {
    const admin = req.admin;
    const activeReport = req.query.report || 'college-wise';

    const reportCards = [
      {
        key: 'college-wise',
        name: 'College-wise Report',
        subtitle: 'Applications & approvals by college',
        iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M6 21V9m6 12V3m6 18v-6"/></svg>'
      },
      {
        key: 'state-wise',
        name: 'State-wise Report',
        subtitle: 'Regional distribution',
        iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>'
      },
      {
        key: 'category-wise',
        name: 'Category-wise Report',
        subtitle: 'By reservation category',
        iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 3"/></svg>'
      },
      {
        key: 'utilization',
        name: 'Scholarship Utilization',
        subtitle: 'Seats filled vs available',
        iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15l-5.5 3 1.5-6L3 8l6-.5L12 2l3 5.5 6 .5-5 4 1.5 6z"/></svg>'
      }
    ];

    const [amountRows] = await connection.query(`
      SELECT COALESCE(
        SUM(s.Scholarship_Amount), 0
      ) AS totalAmount
      FROM applications a
      JOIN scholarships s
        ON a.Scholarship_ID = s.Scholarship_ID
      WHERE a.Status = 'Approved'
    `);

    const [multiRows] = await connection.query(`
      SELECT COUNT(*) AS multiApplicantCount
      FROM (
        SELECT Student_ID
        FROM applications
        WHERE Student_ID IS NOT NULL
        GROUP BY Student_ID
        HAVING COUNT(*) > 1
      ) AS multiple_students
    `);

    const [highestRows] = await connection.query(`
      SELECT
        s.Scholarship_Name,
        COUNT(a.Application_ID) AS applicationCount
      FROM scholarships s
      LEFT JOIN applications a
        ON s.Scholarship_ID = a.Scholarship_ID
      GROUP BY
        s.Scholarship_ID,
        s.Scholarship_Name
      ORDER BY applicationCount DESC
      LIMIT 1
    `);

    const [lowestRows] = await connection.query(`
      SELECT
        s.Scholarship_Name,
        COUNT(a.Application_ID) AS applicationCount
      FROM scholarships s
      LEFT JOIN applications a
        ON s.Scholarship_ID = a.Scholarship_ID
      GROUP BY
        s.Scholarship_ID,
        s.Scholarship_Name
      ORDER BY applicationCount ASC
      LIMIT 1
    `);

    const [avgRows] = await connection.query(`
      SELECT COALESCE(
        AVG(application_count), 0
      ) AS avgApplications
      FROM (
        SELECT
          Student_ID,
          COUNT(*) AS application_count
        FROM applications
        WHERE Student_ID IS NOT NULL
        GROUP BY Student_ID
        HAVING COUNT(*) > 1
      ) AS student_applications
    `);

    const totalAmount = Number(amountRows[0]?.totalAmount || 0);
    const multiApplicantCount = Number(multiRows[0]?.multiApplicantCount || 0);
    const avgApplications = Number(avgRows[0]?.avgApplications || 0);
    const highestApplicationsCount = Number(highestRows[0]?.applicationCount || 0);
    const highestApplicationsScholarship = highestRows[0]?.Scholarship_Name || 'N/A';
    const lowestApplicationsCount = Number(lowestRows[0]?.applicationCount || 0);
    const lowestApplicationsScholarship = lowestRows[0]?.Scholarship_Name || 'N/A';

    const kpis = {
      totalAmountDistributed: '₹' + (totalAmount / 10000000).toFixed(2) + 'Cr',
      amountGrowthPct: 0,
      multiApplicantCount: multiApplicantCount,
      avgApplicationsPerMultiApplicant: avgApplications.toFixed(1),
      highestApplicationsCount: highestApplicationsCount,
      highestApplicationsScholarship: highestApplicationsScholarship,
      lowestApplicationsCount: lowestApplicationsCount,
      lowestApplicationsScholarship: lowestApplicationsScholarship
    };

    const [utilization] = await connection.query(`
      SELECT
        s.Scholarship_Name AS name,
        s.Total_Seats AS totalSeats,
        COUNT(
          CASE
            WHEN a.Status = 'Approved'
            THEN 1
          END
        ) AS seatsFilled,
        CASE
          WHEN s.Total_Seats > 0
          THEN ROUND(
            COUNT(
              CASE
                WHEN a.Status = 'Approved'
                THEN 1
              END
            ) * 100.0 / s.Total_Seats,
            1
          )
          ELSE 0
        END AS utilizationPct
      FROM scholarships s
      LEFT JOIN applications a
        ON s.Scholarship_ID = a.Scholarship_ID
      GROUP BY
        s.Scholarship_ID,
        s.Scholarship_Name,
        s.Total_Seats
      ORDER BY s.Scholarship_Name
    `);

    const [collegeRows] = await connection.query(`
      SELECT
        c.College_Name AS college,
        COUNT(a.Application_ID) AS applications,
        COUNT(
          CASE
            WHEN a.Status = 'Approved' THEN 1
          END
        ) AS approved
      FROM applications a
      JOIN students st
        ON a.Student_ID = st.Student_ID
      JOIN colleges c
        ON st.College_ID = c.College_ID
      GROUP BY c.College_ID, c.College_Name
      ORDER BY applications DESC
      LIMIT 8
    `);

    const collegeReport = {
      labels: collegeRows.map(row => row.college),
      applications: collegeRows.map(row => Number(row.applications)),
      approved: collegeRows.map(row => Number(row.approved))
    };

    const [categoryRows] = await connection.query(`
      SELECT
        st.Category AS category,
        COUNT(a.Application_ID) AS applications
      FROM applications a
      JOIN students st
        ON a.Student_ID = st.Student_ID
      GROUP BY st.Category
      ORDER BY applications DESC
    `);

    const categoryDistribution = {
      labels: categoryRows.map(row => row.category),
      data: categoryRows.map(row => Number(row.applications))
    };

    const [categorySummaryRows] = await connection.query(`
      SELECT
        st.Category AS category,
        COUNT(a.Application_ID) AS applications,
        COUNT(
          CASE
            WHEN a.Status = 'Approved' THEN 1
          END
        ) AS approved,
        COALESCE(
          SUM(
            CASE
              WHEN a.Status = 'Approved'
              THEN s.Scholarship_Amount
              ELSE 0
            END
          ),
          0
        ) AS amountDistributed
      FROM applications a
      JOIN students st
        ON a.Student_ID = st.Student_ID
      JOIN scholarships s
        ON a.Scholarship_ID = s.Scholarship_ID
      GROUP BY st.Category
      ORDER BY applications DESC
    `);

    const categorySummary = categorySummaryRows.map(row => {
      const applications = Number(row.applications);
      const approved = Number(row.approved);
      const amount = Number(row.amountDistributed);

      return {
        category: row.category,
        applications: applications,
        approved: approved,
        approvalRatePct: applications > 0 ? Number(((approved / applications) * 100).toFixed(1)) : 0,
        amountDistributed: formatCr(amount)
      };
    });

    const [stateRows] = await connection.query(`
      SELECT
        st.State_Name AS state,
        COUNT(a.Application_ID) AS applications,
        COUNT(
          CASE
            WHEN a.Status = 'Approved' THEN 1
          END
        ) AS approved,
        COALESCE(
          SUM(
            CASE
              WHEN a.Status = 'Approved'
              THEN s.Scholarship_Amount
              ELSE 0
            END
          ),
          0
        ) AS amountDistributed
      FROM applications a
      JOIN students stu
        ON a.Student_ID = stu.Student_ID
      JOIN states st
        ON stu.State_ID = st.State_ID
      JOIN scholarships s
        ON a.Scholarship_ID = s.Scholarship_ID
      GROUP BY st.State_ID, st.State_Name
      ORDER BY applications DESC
    `);

    const stateSummaryAll = stateRows.map(row => {
      const applications = Number(row.applications);
      const approved = Number(row.approved);
      const amount = Number(row.amountDistributed);

      return {
        state: row.state,
        applications: applications,
        approved: approved,
        approvalRatePct: applications > 0 ? Number(((approved / applications) * 100).toFixed(1)) : 0,
        amountDistributed: formatCr(amount)
      };
    });

    const stateSummary = stateSummaryAll.slice(0, 5);

    const stateChart = {
      labels: stateSummaryAll.map(row => row.state),
      applications: stateSummaryAll.map(row => Number(row.applications)),
      approved: stateSummaryAll.map(row => Number(row.approved))
    };

    res.render('reports-analytics', {
      admin,
      reportCards,
      activeReport,
      kpis,
      collegeReport,
      categoryDistribution,
      categorySummary,
      stateSummary,
      stateSummaryAll,
      stateChart,
      utilization
    });

  } catch (err) {
    console.error('❌ Error loading /reports:', err);

    const admin = req.admin;

    res.status(500).render('error', {
      admin,
      message: 'Failed to load reports',
      error: err
    });
  }
});

app.listen(PORT, () => {
  console.log(`Vidya Sethu Admin running at http://localhost:${PORT}`);
});
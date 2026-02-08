const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
// Use /tmp for database because Cloud Run filesystem is read-only
const DB_PATH = process.env.NODE_ENV === 'production' ? '/tmp/students.db' : 'students.db';

// Initialize Database (sqlite3 is async/callback based)
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log(`Connected to SQLite database at ${DB_PATH}`);
        initDb();
    }
});

function initDb() {
    db.run(`
      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        admission_number TEXT NOT NULL UNIQUE,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(cors());
app.use(bodyParser.json());

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: false,
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

app.use(express.static(path.join(__dirname, '../client')));

// Register Endpoint
app.post('/api/register', (req, res) => {
    const { name, phone, admission_number } = req.body;

    if (!name || !phone || !admission_number) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const admNoRegex = /^[A-Z]{2}\d{3}$/;
    const upperAdmNo = admission_number.toUpperCase();

    const sql = 'INSERT INTO students (name, phone, admission_number) VALUES (?, ?, ?)';

    db.run(sql, [name, phone, upperAdmNo], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'Admission number already registered.' });
            }
            console.error('Error registering student:', err);
            return res.status(500).json({ error: 'Internal server error.' });
        }

        console.log(`Registered: ${name} (${upperAdmNo})`);
        res.json({ success: true, message: 'Registration successful!', id: this.lastID });
    });
});

// Get All Students Endpoint
app.get('/api/students', (req, res) => {
    const adminKey = req.headers['admin-key'];
    if (adminKey !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized: Invalid Admin Password' });
    }

    const sql = 'SELECT * FROM students ORDER BY timestamp DESC';
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error fetching students:', err);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        res.json(rows);
    });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    console.log(`Database location: ${DB_PATH}`);
});

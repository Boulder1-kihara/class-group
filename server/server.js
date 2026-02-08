const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
// Use /tmp for database because Cloud Run filesystem is read-only
const DB_PATH = process.env.NODE_ENV === 'production' ? '/tmp/students.db' : 'students.db';
const db = new Database(DB_PATH);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client')));

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    admission_number TEXT NOT NULL UNIQUE,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Register Endpoint
app.post('/api/register', (req, res) => {
    const { name, phone, admission_number } = req.body;

    if (!name || !phone || !admission_number) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    // Admission Number Validation (e.g., CT100 - Capital letters)
    const admNoRegex = /^[A-Z]{2}\d{3}$/; // Example: CT100
    // Note: User prompt asked for "CT100 which should be in capital letes". 
    // I will enforce uppercase storing and a basic regex, but user input might vary slightly so I'll trust the prompt's example.
    // actually let's just uppercase it.

    const upperAdmNo = admission_number.toUpperCase();

    try {
        const insert = db.prepare('INSERT INTO students (name, phone, admission_number) VALUES (?, ?, ?)');
        insert.run(name, phone, upperAdmNo);
        console.log(`Registered: ${name} (${upperAdmNo})`);
        res.json({ success: true, message: 'Registration successful!' });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            res.status(409).json({ error: 'Admission number already registered.' });
        } else {
            console.error('Error registering student:', error);
            res.status(500).json({ error: 'Internal server error.' });
        }
    }
});

// Get All Students Endpoint
app.get('/api/students', (req, res) => {
    const adminKey = req.headers['admin-key'];
    if (adminKey !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized: Invalid Admin Password' });
    }

    try {
        const stmt = db.prepare('SELECT * FROM students ORDER BY timestamp DESC');
        const students = stmt.all();
        res.json(students);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    console.log(`Database location: ${DB_PATH}`);
});

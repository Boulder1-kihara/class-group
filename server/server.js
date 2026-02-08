const express = require('express');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Use /tmp for database because Cloud Run filesystem is read-only
const DATA_FILE = process.env.NODE_ENV === 'production' ? '/tmp/students.json' : 'students.json';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Helper to read data
function readData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            // Initialize with an empty array if file doesn't exist
            fs.writeFileSync(DATA_FILE, JSON.stringify([]), 'utf8');
            return [];
        }
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading data:', err);
        return [];
    }
}

// Helper to write data
function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error writing data:', err);
    }
}

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

    if (!admNoRegex.test(upperAdmNo)) {
        return res.status(400).json({ error: 'Admission number must be in the format AA123.' });
    }

    const students = readData();

    // Duplicate Check
    if (students.some(s => s.admission_number === upperAdmNo)) {
        return res.status(409).json({ error: 'Admission number already registered.' });
    }

    const newStudent = {
        id: students.length > 0 ? Math.max(...students.map(s => s.id)) + 1 : 1, // Simple ID generation
        name,
        phone,
        admission_number: upperAdmNo,
        timestamp: new Date().toISOString()
    };

    students.push(newStudent);
    writeData(students);

    console.log(`Registered: ${name} (${upperAdmNo})`);
    res.json({ success: true, message: 'Registration successful!', id: newStudent.id });
});

// Get All Students Endpoint
app.get('/api/students', (req, res) => {
    const adminKey = req.headers['admin-key'];
    if (adminKey !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized: Invalid Admin Password' });
    }

    const students = readData();
    // Sort by timestamp desc
    students.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(students);
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    console.log(`Data file location: ${DATA_FILE}`);
});

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
// On Cloud Run, this automatically uses the service account credentials.
// Locally, it looks for GOOGLE_APPLICATION_CREDENTIALS or can be mocked.
initializeApp({
    credential: applicationDefault()
});

const db = getFirestore();

const app = express();
const PORT = process.env.PORT || 3000;
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
app.post('/api/register', async (req, res) => {
    const { name, phone, admission_number } = req.body;

    if (!name || !phone || !admission_number) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const admNoRegex = /^[A-Z]{2}\d{3}$/;
    const upperAdmNo = admission_number.toUpperCase();

    if (!admNoRegex.test(upperAdmNo)) {
        return res.status(400).json({ error: 'Admission number must be in the format AA123.' });
    }

    try {
        // Duplicate Check using Firestore Query
        const studentsRef = db.collection('students');
        const snapshot = await studentsRef.where('admission_number', '==', upperAdmNo).get();

        if (!snapshot.empty) {
            return res.status(409).json({ error: 'Admission number already registered.' });
        }

        const newStudent = {
            name,
            phone,
            admission_number: upperAdmNo,
            timestamp: new Date().toISOString()
        };

        const docRef = await studentsRef.add(newStudent);
        console.log(`Registered: ${name} (${upperAdmNo}) with ID: ${docRef.id}`);
        res.json({ success: true, message: 'Registration successful!', id: docRef.id });

    } catch (error) {
        console.error('Error registering student:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get All Students Endpoint
app.get('/api/students', async (req, res) => {
    const adminKey = req.headers['admin-key'];
    if (adminKey !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized: Invalid Admin Password' });
    }

    try {
        const studentsRef = db.collection('students');
        const snapshot = await studentsRef.orderBy('timestamp', 'desc').get();

        const students = [];
        snapshot.forEach(doc => {
            students.push({ id: doc.id, ...doc.data() });
        });

        res.json(students);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    console.log(`Database connected: Google Cloud Firestore`);
});

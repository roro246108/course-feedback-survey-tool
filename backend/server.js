
const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');
const surveyRoutes = require('./survey-management/routes/surveyRoutes');
const dashboardRoutes = require('./survey-management/routes/dashboardRoutes');

dotenv.config({
    path: path.resolve(__dirname, '.env')
});

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

app.use(cors({
    origin: 'http://localhost:5173'
}));

// Dashboard Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/surveys', surveyRoutes);
// Test route
app.get('/', (req, res) => {
    res.json({
        message: 'Course Feedback Survey Tool API is running!'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

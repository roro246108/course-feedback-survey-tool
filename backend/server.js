
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({
    path: path.resolve(__dirname, '.env')
});

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Import Analytics Routes
const analyticsRoutes = require('./analytics-reporting/routes/analyticsRoutes');
const semesterComparisonRoutes = require('./analytics-reporting/routes/semesterComparisonRoutes');
app.use('/api/analytics', analyticsRoutes);
app.use('/api/semester-comparison', semesterComparisonRoutes);
// Test route
app.get('/', (req, res) => {
    res.json({
        message: 'Course Feedback Survey Tool API is running!'
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

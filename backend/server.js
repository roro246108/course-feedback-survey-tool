

const path = require("path");
const dotenv = require("dotenv");

// Load environment variables before importing application modules.
dotenv.config({
  path: path.resolve(__dirname, ".env"),
});

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

// Anonymous Feedback Routes
const dashboardRoutes = require("./anonymous-feedback/routes/dashboardRoutes");
const feedbackRoutes = require("./anonymous-feedback/routes/feedbackRoutes");
const studentSurveyRoutes = require("./anonymous-feedback/routes/studentSurveyRoutes");

// Authentication Routes
const authRoutes = require("./authentication/routes/authRoutes");
const adminUserRoutes = require("./authentication/routes/adminUserRoutes");

// Survey Management Routes
const surveyRoutes = require("./survey-management/routes/surveyRoutes");
const surveyDashboardRoutes = require("./survey-management/routes/dashboardRoutes");
const analyticsRoutes = require("./analytics-reporting/routes/analyticsRoutes");
const semesterComparisonRoutes = require("./analytics-reporting/routes/semesterComparisonRoutes");

const app = express();

const PORT = process.env.PORT || 5000;

const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:5173";

// Security Middleware
app.use(helmet());

// CORS Configuration
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

// Request Parsing
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use("/api/auth", authRoutes);

// Anonymous Feedback Routes


app.use("/api/admin", adminUserRoutes);
app.use("/api/feedback/dashboard", dashboardRoutes);
app.use("/api/student", studentSurveyRoutes);
app.use("/api", feedbackRoutes);
app.use("/api/dashboard", surveyDashboardRoutes);
app.use("/api/surveys", surveyRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/semester-comparison", semesterComparisonRoutes);
app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Course Feedback Survey Tool API is running.",
  });
});
app.use((error, req, res, next) => {
  console.error("API Error:", error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
    success: false,
    message: "An unexpected server error occurred.",
  });
});
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

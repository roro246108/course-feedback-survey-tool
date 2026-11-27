
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

// Routes
const dashboardRoutes = require("./anonymous-feedback/routes/dashboardRoutes");
const feedbackRoutes = require("./anonymous-feedback/routes/feedbackRoutes");
const studentSurveyRoutes = require("./anonymous-feedback/routes/studentSurveyRoutes");
const authRoutes = require("./authentication/routes/authRoutes");

const app = express();

const PORT = process.env.PORT || 5000;

const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:5173";

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

// Request parsing
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

// Authentication routes
app.use("/api/auth", authRoutes);

// Existing student dashboard
app.use("/api/feedback/dashboard", dashboardRoutes);

// Student survey reads
app.use("/api/student", studentSurveyRoutes);

// Anonymous feedback submission
app.use("/api", feedbackRoutes);

// Health check
app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Course Feedback Survey Tool API is running.",
  });
});

// Central error handler
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

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

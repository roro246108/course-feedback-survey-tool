
const dashboardModel = require("./anonymous-feedback/models/dashboardModel");

async function testDashboard() {
  try {
    const studentId = 12; // Replace with your actual Student ID

    console.log("Testing available surveys...");

    const surveys = await dashboardModel.getAvailableSurveys(studentId);

    console.log("Available Surveys:");
    console.log(surveys);

    if (surveys.length > 0) {
      const surveyId = surveys[0].survey_id;

      console.log("\nTesting survey details...");

      const survey = await dashboardModel.getSurveyById(
        surveyId,
        studentId
      );

      console.log("Survey Details:");
      console.log(JSON.stringify(survey, null, 2));
    } else {
      console.log("No available surveys found for this student.");
    }
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    process.exit();
  }
}

testDashboard();

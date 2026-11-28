// Base URL for the Survey Management API only (surveys, questions, lifecycle
// and the admin Survey Management dashboard).
//
// VITE_SURVEY_MANAGEMENT_API_URL is the API Gateway HTTP API origin that
// routes to SurveyManagementLambda, for example
//   https://<api-id>.execute-api.<region>.amazonaws.com
// When it is not set, each service keeps its existing Express URL, so local
// development and other modules are unaffected.

const trimTrailingSlashes = (value) => value.replace(/\/+$/, '');

const configuredOrigin = import.meta.env?.VITE_SURVEY_MANAGEMENT_API_URL;

export const resolveSurveyManagementApiBase = (
  legacyApiBaseUrl,
  origin = configuredOrigin
) =>
  origin && String(origin).trim()
    ? `${trimTrailingSlashes(String(origin).trim())}/api`
    : trimTrailingSlashes(legacyApiBaseUrl);

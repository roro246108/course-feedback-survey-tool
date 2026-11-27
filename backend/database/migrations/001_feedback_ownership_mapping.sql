-- Additive migration for authenticated student access to anonymous submissions.
-- feedback_submissions already has status, updated_at, and withdrawn_at plus
-- their existing CHECK constraints; this migration intentionally does not
-- alter those fields or constraints. participation.status is the durable
-- withdrawal marker because withdrawal deletes the feedback_submissions row.
-- Historical ownership mappings are intentionally not backfilled: the current
-- schema has no safe relationship from participation to an anonymous response.
-- REVOKE from PUBLIC is only the default privilege boundary. After applying,
-- provision required privileges for the current shared DATABASE_URL runtime role.
-- Apply this migration as the non-runtime schema owner, or SET ROLE to it
-- before execution so the SECURITY DEFINER function is owned by that role.
BEGIN;

ALTER TABLE public.participation
  ADD COLUMN status character varying(20) NOT NULL DEFAULT 'Submitted';

ALTER TABLE public.participation
  ADD CONSTRAINT participation_status_check
  CHECK (status IN ('Submitted', 'Withdrawn'));

-- The existing PK on submission_id guarantees this pair is logically unique,
-- but PostgreSQL requires a matching UNIQUE key for the composite FK below.
ALTER TABLE public.feedback_submissions
  ADD CONSTRAINT feedback_submissions_submission_survey_unique
  UNIQUE (submission_id, survey_id);

CREATE TABLE public.feedback_ownership_mapping (
  owner_key character varying(64) PRIMARY KEY,
  survey_id integer NOT NULL,
  submission_id integer NOT NULL UNIQUE,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT feedback_ownership_mapping_submission_survey_fkey
    FOREIGN KEY (submission_id, survey_id)
    REFERENCES public.feedback_submissions (submission_id, survey_id)
    ON DELETE CASCADE
);

REVOKE ALL ON TABLE public.feedback_ownership_mapping FROM PUBLIC;

-- The runtime role must not receive UPDATE on surveys solely to acquire a row
-- lock. This SECURITY DEFINER helper must be owned by the separate schema owner;
-- its owner must have SELECT and UPDATE privileges on public.surveys.
CREATE FUNCTION public.lock_survey_for_feedback(p_survey_id integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $lock_survey$
BEGIN
  PERFORM 1
  FROM public.surveys
  WHERE survey_id = p_survey_id
  FOR UPDATE;

  RETURN FOUND;
END;
$lock_survey$;

REVOKE ALL ON FUNCTION public.lock_survey_for_feedback(integer) FROM PUBLIC;

COMMIT;

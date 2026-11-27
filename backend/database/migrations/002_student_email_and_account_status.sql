BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS personal_email character varying(255);

ALTER TABLE public.account_invitations
  ADD COLUMN IF NOT EXISTS academic_email character varying(255);

DO $migration$
DECLARE
  status_attnum smallint;
  status_check record;
  status_values text[];
BEGIN
  SELECT attnum
  INTO status_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.users'::regclass
    AND attname = 'account_status'
    AND NOT attisdropped;

  IF status_attnum IS NULL THEN
    RAISE EXCEPTION 'users.account_status is missing; migration stopped without changing status constraints.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.users
    WHERE account_status IS NOT NULL
      AND account_status NOT IN ('Pending', 'Active', 'Disabled', 'Inactive')
  ) THEN
    RAISE EXCEPTION 'Unexpected users.account_status values exist; review them before applying this migration.';
  END IF;

  FOR status_check IN
    SELECT conname, conkey, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%account_status%'
  LOOP
    IF status_check.conkey IS DISTINCT FROM
       ARRAY[status_attnum]::smallint[] THEN
      RAISE EXCEPTION 'A composite users account_status check needs manual review; migration stopped.';
    END IF;

    SELECT array_agg((captured.parts)[1] ORDER BY (captured.parts)[1])
    INTO status_values
    FROM regexp_matches(
      status_check.definition,
      $$'([^']*)'$$,
      'g'
    ) AS captured(parts);

    IF status_values IS DISTINCT FROM
         ARRAY['Active', 'Disabled', 'Pending']::text[]
       AND status_values IS DISTINCT FROM
         ARRAY['Active', 'Inactive', 'Pending']::text[] THEN
      RAISE EXCEPTION 'Unrecognized users.account_status CHECK constraint; migration stopped for manual review.';
    END IF;

    IF status_check.definition ~* '\m(AND|OR|NOT)\M'
       OR status_check.definition ~* '<>|!='
       OR NOT (
         status_check.definition ~* '\mIN\M'
         OR status_check.definition ~* '=\s*ANY\s*\('
       ) THEN
      RAISE EXCEPTION 'Complex users.account_status CHECK constraint needs manual review; migration stopped.';
    END IF;

    EXECUTE format(
      'ALTER TABLE public.users DROP CONSTRAINT %I',
      status_check.conname
    );
  END LOOP;

  UPDATE public.users
  SET account_status = 'Inactive'
  WHERE account_status = 'Disabled';

  IF EXISTS (
    SELECT 1
    FROM public.users
    WHERE account_status IS NOT NULL
      AND account_status NOT IN ('Pending', 'Active', 'Inactive')
  ) THEN
    RAISE EXCEPTION 'Unexpected users.account_status values remain; migration stopped.';
  END IF;

  IF EXISTS (
    SELECT LOWER(BTRIM(personal_email))
    FROM public.users
    WHERE role IN ('Student', 'Instructor')
      AND personal_email IS NOT NULL
      AND BTRIM(personal_email) <> ''
    GROUP BY LOWER(BTRIM(personal_email))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate Student or Instructor personal_email values exist; resolve them before applying this migration.';
  END IF;
END
$migration$;

ALTER TABLE public.users
  ADD CONSTRAINT users_account_status_supported_values
  CHECK (account_status IN ('Pending', 'Active', 'Inactive'));

DROP INDEX IF EXISTS public.users_personal_email_normalized_unique;
DROP INDEX IF EXISTS public.users_personal_email_student_normalized_unique;

CREATE UNIQUE INDEX IF NOT EXISTS users_personal_email_invited_roles_normalized_unique
  ON public.users (LOWER(BTRIM(personal_email)))
  WHERE role IN ('Student', 'Instructor')
    AND personal_email IS NOT NULL
    AND BTRIM(personal_email) <> '';

COMMIT;

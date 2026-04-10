-- Remove legacy subjects BIO (Sinh học) and ENG (Tiếng Anh).
-- Project scope: MATH, PHY, CHEM only.
-- Deletion order respects FK: exams → questions → classes → subjects (chapters/topics cascade on subject delete).
-- Idempotent: if BIO/ENG rows are absent, statements are no-ops.

DELETE FROM "exams"
WHERE "subject_id" IN (SELECT "id" FROM "subjects" WHERE "code" IN ('BIO', 'ENG'));

DELETE FROM "questions"
WHERE "subject_id" IN (SELECT "id" FROM "subjects" WHERE "code" IN ('BIO', 'ENG'));

DELETE FROM "classes"
WHERE "subject_id" IN (SELECT "id" FROM "subjects" WHERE "code" IN ('BIO', 'ENG'));

DELETE FROM "subjects"
WHERE "code" IN ('BIO', 'ENG');

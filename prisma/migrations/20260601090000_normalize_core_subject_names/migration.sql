INSERT INTO "subjects" ("name", "code", "description", "status")
VALUES
  ('Mathematics', 'MATH', 'High school mathematics - Algebra, Geometry, Calculus', 1),
  ('Physics', 'PHY', 'High school physics - Mechanics, Electricity, Optics, Thermodynamics', 1),
  ('Chemistry', 'CHEM', 'High school chemistry - Inorganic, Organic', 1)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "status" = EXCLUDED."status";

UPDATE "subjects"
SET "status" = 0
WHERE "code" NOT IN ('MATH', 'PHY', 'CHEM');

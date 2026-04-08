-- WebQuiz Database Initialization Script
-- This runs automatically when the PostgreSQL container starts for the first time

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE webquiz TO webquiz;

-- Log successful initialization
DO $$
BEGIN
  RAISE NOTICE 'WebQuiz database initialized successfully!';
END
$$;

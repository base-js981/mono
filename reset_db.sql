-- Drop old tables if exist
DROP TABLE IF EXISTS "role_permissions" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TYPE IF EXISTS "UserRole" CASCADE;

-- Create new schema

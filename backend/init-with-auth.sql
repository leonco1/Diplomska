-- Create the streamapp role with password using SCRAM-SHA-256 (secure)
-- The password is: streamapp (matches DB_PASSWORD in .env)
CREATE ROLE streamapp WITH LOGIN PASSWORD 'streamapp';

-- Create the streamapp database owned by the streamapp role
CREATE DATABASE streamapp OWNER streamapp;

-- Grant all privileges on the database
GRANT ALL PRIVILEGES ON DATABASE streamapp TO streamapp;

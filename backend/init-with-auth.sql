CREATE ROLE streamapp WITH LOGIN PASSWORD 'streamapp';

CREATE DATABASE streamapp OWNER streamapp;

GRANT ALL PRIVILEGES ON DATABASE streamapp TO streamapp;

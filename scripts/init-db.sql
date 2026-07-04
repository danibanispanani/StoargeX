-- App-Rolle: bewusst KEIN Superuser (Row Level Security!), aber CREATEDB
-- für die Prisma-Shadow-Database bei "prisma migrate dev".
CREATE ROLE storagex LOGIN PASSWORD 'storagex' NOSUPERUSER CREATEDB;
CREATE DATABASE storagex OWNER storagex;

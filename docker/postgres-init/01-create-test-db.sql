-- Runs once, on first cluster initialisation only.
-- The test database inherits the cluster's ICU ar-SA default from template1,
-- so integration tests exercise the same collation behaviour as development.
CREATE DATABASE new_era_test OWNER newera;

-- Exécuté uniquement à la première création du volume Postgres.
-- Crée une base séparée pour les tests d'intégration (NODE_ENV=test),
-- afin de ne jamais toucher aux données de développement.
CREATE DATABASE wasel_test;

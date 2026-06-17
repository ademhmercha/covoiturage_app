# Wasel (واصل) — Plateforme de covoiturage inter-villes

Plateforme de covoiturage sécurisée — React (Vite) côté client, Node.js/Express
côté API, PostgreSQL 16 + Redis 7, Socket.IO pour le temps réel, déploiement
cible Azure. Interface bilingue **français / arabe (RTL)**.

> **Zéro tolérance pour les failles de sécurité** : chaque fichier source
> documente les protections appliquées et les risques OWASP couverts. Voir la
> [checklist sécurité](#checklist-sécurité-15-catégories-du-cahier-des-charges)
> ci-dessous pour le détail par catégorie et par fichier.

## Arborescence

```
wasel/
├── .github/workflows/ci.yml   # CI : migrations, tests, npm audit, lint, build
├── docker-compose.yml         # Postgres 16 + Redis 7 pour le développement local
├── package.json               # Workspaces npm (backend, shared, frontend)
├── shared/                     # Schémas Zod partagés (validation front + back)
├── backend/                    # API Express (REST + Socket.IO)
│   ├── src/
│   │   ├── config/              # env, sécurité (CORS/CSP/Helmet), redis, clés JWT
│   │   ├── middleware/           # auth, RBAC, rate limiting, validation, erreurs
│   │   ├── routes/               # auth, users, trips, bookings, messages, notifications, geocode
│   │   ├── realtime/              # Socket.IO (auth par cookie, rate limiting, chat)
│   │   ├── services/              # logique métier (notifications, etc.)
│   │   ├── queues/                # Bull : rappel de départ (1h avant)
│   │   ├── db/                    # Prisma client + extension chiffrement téléphone
│   │   └── utils/                  # jwt, cookies, logger, encryption, serializers
│   ├── prisma/                   # Schéma + migrations PostgreSQL
│   └── tests/                    # Jest + Supertest (58 tests)
└── frontend/                    # App React 19 (Vite, React Router, React Query)
    └── src/
        ├── api/                   # Client axios (refresh automatique, cookies httpOnly)
        ├── store/                  # Zustand (état d'authentification)
        ├── context/                # SocketContext (Socket.IO authentifié)
        ├── components/             # Layout, carte Leaflet, cartes de trajet, icônes
        ├── pages/                   # Auth, recherche, trajets, réservations, profil
        └── i18n/                    # Traductions FR/AR + support RTL
```

## Démarrage rapide

### 1. Infrastructure locale (Postgres + Redis)

```bash
docker compose up -d
docker compose ps   # les deux services doivent être "healthy"
```

### 2. Backend

```bash
cd backend
cp .env.example .env          # adapter les valeurs locales si besoin
npm install                    # installe aussi shared/ et frontend/ (workspaces)
npm run generate:keys          # génère les clés JWT RS256 dans backend/keys/ (jamais commitées)
npm run prisma:migrate          # applique le schéma à la base "wasel"
npm run dev                    # démarre l'API sur http://localhost:4000
```

Avant `npm test`, créez la base de test dédiée (`wasel_test`) :

```bash
docker exec -it wasel-postgres-1 psql -U wasel -c "CREATE DATABASE wasel_test;"
DATABASE_URL="postgresql://wasel:wasel_dev_only@localhost:5432/wasel_test?schema=public" \
  npx prisma migrate deploy --schema prisma/schema.prisma
npm test                       # 58 tests (sécurité + intégration)
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env          # VITE_API_URL=http://localhost:4000
npm run dev                    # démarre Vite sur http://localhost:5173
```

### Scripts racine (workspaces)

```bash
npm run dev:backend     # = npm run dev -w backend
npm run dev:frontend    # = npm run dev -w frontend
npm run test:backend    # = npm test -w backend
npm run build:frontend  # = npm run build -w frontend
```

## Roadmap (10 étapes) — ✅ projet complet

| # | Étape | Statut |
|---|-------|--------|
| 1 | Configuration sécurité globale (helmet, CORS, rate limiting, CSP, logs) | ✅ |
| 2 | Authentification JWT (RS256, refresh token rotation, cookies httpOnly, verrouillage de compte) | ✅ |
| 3 | Middleware d'autorisation RBAC + ownership | ✅ |
| 4 | Schémas de validation Zod partagés (frontend + backend, `.strict()`) | ✅ |
| 5 | Modèles Prisma (UUID v4, chiffrement AES-256-GCM du téléphone) | ✅ |
| 6 | Routes API (utilisateurs, trajets, réservations, messages) | ✅ |
| 7 | Socket.IO sécurisé (auth par cookie, rate limiting, validation, chat) | ✅ |
| 8 | Notifications (Bull + Redis + Socket.IO) : 4 types d'événements | ✅ |
| 9 | Frontend React (i18n FR/AR RTL, carte Leaflet, pages, design system) | ✅ |
| 10 | Suite de tests de sécurité complète (58 tests Jest + Supertest) | ✅ |

## Checklist sécurité (15 catégories du cahier des charges)

| # | Catégorie | Statut | Implémentation |
|---|-----------|--------|-----------------|
| 1 | Authentification & sessions (JWT RS256, refresh rotation, cookies httpOnly `SameSite=Strict`) | ✅ | `src/utils/jwt.js`, `src/routes/auth.js`, `src/utils/cookies.js` |
| 2 | Mots de passe (bcrypt coût 12, règles de complexité, rate limiting login 5/15min, verrouillage de compte après 5 échecs) | ✅ | `src/routes/auth.js`, `shared/schemas/common.js` (`passwordSchema`) — testé dans `tests/security-extra.test.js` |
| 3 | Validation & sanitisation des entrées (Zod `.strict()`, suppression des caractères de contrôle) | ✅ | `shared/schemas/*.js`, `src/middleware/validate.js` |
| 4 | Injection & XSS (Prisma = pas de SQL concaténé, CSP stricte, aucun `dangerouslySetInnerHTML`) | ✅ | `src/config/security.js` (CSP), `backend/prisma/` |
| 5 | Autorisation RBAC, ownership, identifiants UUID v4 (jamais d'auto-increment exposé) | ✅ | `src/middleware/authenticate.js`, `src/middleware/rbac.js`, `prisma/schema.prisma` — testé dans `tests/trips-bookings.test.js`, `tests/security-extra.test.js` |
| 6 | Données sensibles (chiffrement AES-256-GCM du téléphone en base, GPS arrondi à ~111m, logs sans PII) | ✅ | `src/db/prisma.js`, `src/utils/encryption.js`, `shared/schemas/common.js` (`roundCoordinate`), `src/utils/logger.js` |
| 7 | Rate limiting & anti-DDoS (global 100/min, login/register 5/15min, Socket.IO 10 msg/min) | ✅ | `src/middleware/rateLimiters.js`, `src/sockets/` |
| 8 | WebSocket (Socket.IO authentifié par cookie httpOnly, validation Zod, rate limiting, payload ≤1KB) | ✅ | `src/sockets/` — testé dans `tests/socket.test.js` |
| 9 | Géolocalisation (précision réduite à 3 décimales ≈ 111m, jamais de coordonnées exactes stockées ; géocodage inverse proxifié côté serveur, jamais d'appel tiers depuis le navigateur) | ✅ | `shared/schemas/common.js` (`coordinatesSchema`), `src/routes/geocode.js` — testé dans `tests/security-extra.test.js` |
| 10 | CORS (liste blanche stricte, jamais `origin: '*'` avec `credentials: true`) | ✅ | `src/config/security.js` — testé dans `tests/security.test.js` |
| 11 | Base de données (Prisma, identifiants via variables d'environnement, UUID v4, schéma versionné) | ✅ | `backend/prisma/schema.prisma`, `backend/prisma/migrations/` |
| 12 | Dépendances (npm audit en CI, échec si vulnérabilité haute/critique) | ✅ (CI) | `.github/workflows/ci.yml` — voir [Vulnérabilités connues](#vulnérabilités-connues) |
| 13 | Logs & monitoring (winston, redaction automatique des champs sensibles, pas de stack trace en prod) | ✅ | `src/utils/logger.js`, `src/middleware/errorHandler.js` — testé dans `tests/security-extra.test.js` |
| 14 | Upload de fichiers / avatars | ⏳ Hors périmètre (pas de stockage de fichiers dans cette itération — `avatarUrl` est un champ texte optionnel, aucun endpoint d'upload n'est exposé) |
| 15 | CI/CD (lint, tests, audit automatisés ; déploiement Azure non configuré dans ce dépôt) | ✅ (CI) / ⏳ (CD) | `.github/workflows/ci.yml` — CD vers Azure App Service / Static Web Apps + Key Vault à configurer avec les identifiants du tenant cible |

### Vulnérabilités connues

- `npm audit` signale 2 vulnérabilités **modérées** (`uuid` < 11.1.1, dépendance
  transitive de `bull`). Le correctif (`npm audit fix --force`) imposerait un
  retour à `bull@1.x` (changement majeur incompatible avec l'API utilisée dans
  `src/queues/`). Risque jugé non exploitable ici : `uuid` n'est jamais appelé
  avec un buffer fourni par l'utilisateur. À ré-évaluer lors de la prochaine
  montée de version majeure de `bull`. La CI échoue uniquement à partir du
  niveau `high`, donc cette entrée n'empêche pas le pipeline de passer.

## Tests

```bash
cd backend
npm test
```

58 tests couvrent :

- **`tests/security.test.js`** — headers Helmet/CSP, CORS whitelist, limite de
  payload 10kb (413), rate limiting global (429), 404 générique, pas de fuite
  de stack trace en production.
- **`tests/auth.test.js`** — inscription (mot de passe faible rejeté, cookies
  httpOnly `SameSite=Strict`, email dupliqué), connexion, `/api/auth/me`,
  rotation du refresh token + détection de réutilisation, déconnexion (liste
  noire du token d'accès).
- **`tests/trips-bookings.test.js`** — RBAC/ownership complet sur trajets,
  réservations et messages (création, recherche, mise à jour, acceptation,
  recalcul des places disponibles, accès restreint aux participants).
- **`tests/notifications.test.js`** — déclenchement des 4 types de
  notifications (nouvelle réservation, réservation acceptée, nouveau message,
  rappel de départ) et leur portée (propriétaire uniquement).
- **`tests/socket.test.js`** — authentification Socket.IO par cookie,
  validation des messages, limite de payload 1KB, rate limiting 10 msg/min.
- **`tests/security-extra.test.js`** — rate limiting du login (429 après 5
  tentatives), verrouillage de compte après 5 mots de passe invalides
  (`ACCOUNT_LOCKED`), rejet des champs inconnus par les schémas `.strict()`
  (anti mass-assignment), format UUID v4 des identifiants créés, arrondi des
  coordonnées GPS dans les réponses API, chiffrement AES-256-GCM du téléphone
  (aller-retour + vérification en base brute), redaction des champs sensibles
  par le logger.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) exécute à chaque push /
pull request sur `main` :

- **backend** : services Postgres 16 + Redis 7 éphémères, migrations Prisma,
  `npm audit --audit-level=high`, puis la suite Jest/Supertest complète ;
- **frontend** : lint ESLint puis build de production Vite.

Aucun secret réel n'est utilisé : les valeurs `FIELD_ENCRYPTION_KEY`/clés JWT
du workflow sont générées ou fixées pour la durée du job CI uniquement. En
production, ces valeurs proviennent d'Azure Key Vault.

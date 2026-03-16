# User Service

This directory contains the local Keycloak setup for MaaSAI authentication.

## What This Service Does

Keycloak is the identity provider for the project.

- Realm: `massai`
- Admin console: `http://localhost:8080/admin`
- Default admin login:
  - Username: `admin`
  - Password: `admin`

The local setup imports the MaaSAI realm automatically and then runs a one-shot setup container to seed development users.

## How To Start It

From the repository root, run:

```sh
docker compose -f docker-compose.dev.yml up -d keycloak keycloak-setup
```

To watch logs:

```sh
docker compose -f docker-compose.dev.yml logs -f keycloak keycloak-setup
```

To stop it:

```sh
docker compose -f docker-compose.dev.yml down -v
```

## Startup Flow

1. `keycloak` starts on port `8080`
2. Keycloak imports [realm-export.json](/Users/abodiatrash/projects/massai/user-service/realm-export.json)
3. `keycloak-setup` waits until the `massai` realm is ready
4. `keycloak-setup` applies the user profile config for custom `contract_ids`
5. `keycloak-setup` creates or updates the seeded development users from [seed-users.json](/Users/abodiatrash/projects/massai/user-service/seed-users.json)

## Realm

The project uses one Keycloak realm:

- Realm name: `massai`

This realm contains:

- Application clients for backend and frontend auth
- Realm roles used for authorization
- Seed users for local development
- A custom `contract_ids` claim used to scope users to contracts

## Clients

### `massai-backend`

Used by backend services when they need a confidential Keycloak client.

- Type: confidential client
- Service accounts enabled: yes
- Intended use: backend-to-Keycloak operations and protected API integration

### `massai-frontend`

Used by the web app for user login.

- Type: public client
- Login flow: authorization code + PKCE
- Direct access grants: enabled for local/dev token testing
- Redirect URI: `http://localhost:3000/*`

## Roles

The realm defines these roles:

- `consumer`: can read contracts they own
- `provider`: can push ingest data for contracts they are linked to
- `admin`: can manage everything

## Seed Users

These development users are created automatically:

| User | Password | Role | Contract IDs |
| --- | --- | --- | --- |
| `consumer-factor@test.com` | `password` | `consumer` | `contract-factor-001` |
| `provider-factor@test.com` | `password` | `provider` | `contract-factor-001` |
| `consumer-e4m@test.com` | `password` | `consumer` | `contract-e4m-001` |
| `provider-tasowheel@test.com` | `password` | `provider` | `contract-tasowheel-001` |
| `admin@test.com` | `password` | `admin` | none |

## Important Files

- [realm-export.json](/Users/abodiatrash/projects/massai/user-service/realm-export.json): realm, clients, roles, and token mapper config
- [seed-users.json](/Users/abodiatrash/projects/massai/user-service/seed-users.json): development users and their contract mappings
- [setup.sh](/Users/abodiatrash/projects/massai/user-service/setup.sh): waits for Keycloak, applies user profile config, and seeds users

## Quick Verification

After startup:

1. Open `http://localhost:8080/admin`
2. Log in with `admin` / `admin`
3. Switch to the `massai` realm
4. Confirm the clients `massai-backend` and `massai-frontend` exist
5. Confirm the roles `consumer`, `provider`, and `admin` exist
6. Confirm the seeded users exist

You can also request a dev token with:

```sh
curl -X POST http://localhost:8080/realms/massai/protocol/openid-connect/token \
  -d "client_id=massai-frontend" \
  -d "grant_type=password" \
  -d "username=consumer-factor@test.com" \
  -d "password=password"
```

# 📋 SaaS Task Management API

<div align="center">

![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![Swagger](https://img.shields.io/badge/Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)

A **production-grade, multi-tenant SaaS Task Management REST API** — standard architecture — built with NestJS, TypeScript, PostgreSQL, and Prisma. Designed to demonstrate real-world backend engineering practices including clean architecture, RBAC, JWT authentication with refresh token rotation, rich query filtering, and comprehensive testing.

[Features](#-features) • [Architecture](#-architecture) • [Tech Stack](#-tech-stack) • [Getting Started](#-getting-started) • [API Reference](#-api-reference) • [Testing](#-testing) • [Docker](#-docker-deployment)

</div>

---

## 📌 Table of Contents

- [Project Overview](#-project-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Database Schema](#-database-schema)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Authentication Flow](#-authentication-flow)
- [Role-Based Access Control](#-role-based-access-control)
- [Query Filtering & Pagination](#-query-filtering--pagination)
- [Testing](#-testing)
- [Docker Deployment](#-docker-deployment)
- [Security Practices](#-security-practices)
- [Design Decisions](#-design-decisions)
- [Interview Talking Points](#-interview-talking-points)

---

## 🎯 Project Overview

This is a full-featured **SaaS Task Management API** that implements the core backend architecture of modern project management tools. It is built step-by-step following industry-standard patterns.

### What Makes This Production-Grade?

| Concern | Implementation |
|---|---|
| **Authentication** | JWT access tokens (15min) + DB-stored refresh tokens (7d) with rotation |
| **Authorization** | Role-based guard that resolves org membership in a single DB query |
| **Multi-tenancy** | Every resource is scoped to an Organization — the SaaS boundary |
| **Data integrity** | Prisma transactions for atomic operations, soft deletes, cascade rules |
| **Performance** | Parallel queries with `Promise.all`, indexed columns, selective includes |
| **Validation** | Global `ValidationPipe` with whitelist — strips and rejects unknown fields |
| **Error handling** | Global exception filter — structured JSON errors, no stack traces in prod |
| **Logging** | Winston logger — JSON in production, pretty-printed in development |
| **Documentation** | Swagger/OpenAPI with full schema, auth, and example values |
| **Testing** | Unit tests (Jest mocks) + integration tests (real DB, real HTTP) |
| **Containerization** | Multi-stage Dockerfile, docker-compose for dev + test databases |

---

## ✨ Features

### Authentication & Security
- ✅ User registration with strong password validation (regex enforced)
- ✅ Login with email/password — bcrypt password hashing (configurable rounds)
- ✅ JWT access tokens (short-lived, 15 minutes by default)
- ✅ Refresh token rotation — revoke-and-reissue on every refresh
- ✅ Refresh tokens stored in PostgreSQL — can be revoked on demand
- ✅ Logout from current session (revoke single token)
- ✅ Logout from all devices (revoke all tokens for user)
- ✅ Email enumeration prevention — identical error for wrong password & missing user
- ✅ Inactive account detection on login
- ✅ Global JWT guard — all routes protected by default
- ✅ `@Public()` decorator to opt specific routes out of auth

### Organizations (Multi-Tenancy)
- ✅ Create organizations with unique URL slug
- ✅ List all organizations the authenticated user belongs to
- ✅ Get organization details including member count
- ✅ Update organization (name, description, logo)
- ✅ Soft-delete organization (preserves data for billing/audit)
- ✅ Invite users by email with a specific role
- ✅ List members with search and pagination
- ✅ Change a member's role (OWNER only)
- ✅ Remove members (ADMIN+)
- ✅ Protection against removing the last owner
- ✅ Protection against self-role-change

### Projects
- ✅ Create projects scoped to an organization
- ✅ List projects with filtering by status, creator, and search
- ✅ Sorting by name, created date, updated date, start/end date
- ✅ Pagination with `hasNextPage` / `hasPreviousPage` meta
- ✅ Get project details with per-status task counts
- ✅ Update project fields (supports partial PATCH)
- ✅ Soft-delete projects (archived status preserved)
- ✅ Project statistics: completion rate, tasks by status/priority, overdue count
- ✅ Date range validation (endDate must be after startDate)

### Tasks
- ✅ Create tasks within a project with optional assignees
- ✅ Rich filtering: status (multi-value), priority (multi-value), assignee, creator, search, due date range
- ✅ Overdue filter — tasks past due date that are not done/cancelled
- ✅ Sorting by title, created date, updated date, due date, priority, status, position
- ✅ Position-based ordering (1000-increment gaps for insertion-free reordering)
- ✅ Get task detail with assignees and comment count
- ✅ Update any task field — assignees replaced atomically in transaction
- ✅ Soft-delete tasks
- ✅ Assign/replace assignees — validates all assignees are org members
- ✅ Unassign a single member from a task
- ✅ Dedicated status update endpoint — auto-positions task at end of new column
- ✅ Bulk update up to 50 tasks (status or priority) — returns updated and skipped IDs
- ✅ `isOverdue` computed field on every task response

### Comments
- ✅ Add comments to tasks (any organization member)
- ✅ List comments in chronological order (oldest-first by default)
- ✅ Edit comments — author only, marks `isEdited: true`
- ✅ Delete comments — author can delete own; ADMIN/OWNER can moderate any
- ✅ `isOwn` computed field — frontend knows whether to show edit/delete controls
- ✅ Pagination support

### Developer Experience
- ✅ Swagger/OpenAPI documentation at `/docs` (dev only)
- ✅ Interactive API explorer with JWT authorization persistence
- ✅ Consistent response envelope: `{ success, data, timestamp }`
- ✅ Consistent error envelope: `{ statusCode, message, error, path, timestamp }`
- ✅ Database seed with realistic test data (3 users, 1 org, 1 project, tasks, comments)
- ✅ Prisma Studio support for visual database browsing

---

## 🏗 Architecture

### Clean Architecture Layers

```
HTTP Request
     │
     ▼
┌─────────────────────────────────┐
│         GUARDS (Security)       │  JwtAuthGuard → OrganizationRoleGuard
│   Resolve identity + permissions│  Attach user, org, role to request
└─────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────┐
│       CONTROLLERS (HTTP)        │  Parse params, call service, return DTO
│   Thin — no business logic      │  @Param, @Body, @Query, @CurrentUser
└─────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────┐
│        SERVICES (Business)      │  Validation, transactions, orchestration
│   All domain rules live here    │  Calls Prisma, throws domain exceptions
└─────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────┐
│     PRISMA SERVICE (Database)   │  Type-safe queries, migrations, relations
│   Injected globally via @Global │  Connection lifecycle managed by NestJS
└─────────────────────────────────┘
     │
     ▼
  PostgreSQL
```

### Module Dependency Graph

```
AppModule
├── DatabaseModule (@Global — PrismaService available everywhere)
├── ConfigModule (@Global — ConfigService available everywhere)
├── AuthModule
│   └── UsersModule
├── UsersModule
├── OrganizationsModule
├── ProjectsModule
├── TasksModule
│   └── ProjectsModule (scope validation)
└── CommentsModule
    ├── ProjectsModule (scope validation)
    └── TasksModule (scope validation)
```

### Request Lifecycle for a Protected Route

```
PATCH /organizations/acme-corp/projects/proj-id/tasks/task-id

1. JwtAuthGuard         → Verify JWT signature and expiry
                        → Load user from DB, check isActive
                        → Attach UserResponseDto to request.user

2. OrganizationRoleGuard → Read :slug param ("acme-corp")
                         → Query: SELECT membership WHERE userId + orgSlug
                         → Check org isActive
                         → Attach { id, slug, name } to request.organization
                         → Attach { role } to request.membership
                         → Check role against @OrganizationRoles() decorator

3. ValidationPipe       → Validate request body against DTO
                        → Strip unknown fields (whitelist: true)
                        → Transform types (string → number, etc.)

4. Controller           → Extract params via decorators
                        → Delegate to TasksService

5. TasksService         → Verify project belongs to org (scope check)
                        → Verify task belongs to project (scope check)
                        → Execute business logic
                        → Return DTO

6. TransformInterceptor → Wrap in { success: true, data: ..., timestamp }

7. Response             → 200 OK with JSON envelope
```

---

## 🛠 Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Framework** | NestJS 10 | Opinionated, DI container, decorators, modular, enterprise-grade |
| **Language** | TypeScript 5 | Strict typing, path aliases, decorator metadata |
| **Database** | PostgreSQL 15 | ACID compliance, JSON support, powerful indexes |
| **ORM** | Prisma 5 | Type-safe queries, auto-generated client, migration system |
| **Auth** | Passport.js + JWT | Industry-standard, pluggable strategies |
| **Validation** | class-validator + class-transformer | Decorator-based, integrates with NestJS pipes |
| **Documentation** | Swagger/OpenAPI | Auto-generated from decorators via `@nestjs/swagger` |
| **Logging** | Winston | Structured JSON in prod, human-readable in dev |
| **Hashing** | bcryptjs | Industry-standard password hashing with configurable rounds |
| **Testing** | Jest + Supertest | Unit tests with mocks, integration tests with real HTTP |
| **Containerization** | Docker + docker-compose | Reproducible environments, multi-stage builds |

---

## 📁 Project Structure

```
task-management-api/
├── src/
│   ├── main.ts                          # App bootstrap, Swagger, global config
│   ├── app.module.ts                    # Root module — wires everything together
│   │
│   ├── config/                          # Typed, namespaced config
│   │   ├── app.config.ts                # Port, env, API prefix
│   │   ├── database.config.ts           # Database URL
│   │   ├── jwt.config.ts                # JWT secrets and expiry
│   │   └── index.ts                     # Barrel export
│   │
│   ├── database/                        # Prisma integration
│   │   ├── database.module.ts           # @Global module
│   │   └── prisma.service.ts            # PrismaClient + lifecycle hooks
│   │
│   ├── common/                          # Shared cross-cutting concerns
│   │   ├── decorators/
│   │   │   ├── organization-roles.decorator.ts   # @OrganizationRoles(OWNER, ADMIN)
│   │   │   └── current-organization.decorator.ts # @CurrentOrganization(), @CurrentMemberRole()
│   │   ├── dto/
│   │   │   └── pagination.dto.ts        # Reusable page/limit/sortOrder
│   │   ├── exceptions/
│   │   │   └── custom.exceptions.ts     # ResourceNotFound, Conflict, Forbidden, etc.
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts # Global error handler — structured JSON errors
│   │   ├── guards/
│   │   │   └── organization-role.guard.ts # RBAC guard — resolves membership + role
│   │   ├── interceptors/
│   │   │   └── transform.interceptor.ts # Wraps all responses in { success, data, timestamp }
│   │   └── logger/
│   │       └── logger.service.ts        # Winston logger (JSON prod, pretty dev)
│   │
│   └── modules/
│       ├── auth/
│       │   ├── decorators/
│       │   │   ├── current-user.decorator.ts    # @CurrentUser() param decorator
│       │   │   └── public.decorator.ts          # @Public() — skip JWT guard
│       │   ├── dto/
│       │   │   ├── register.dto.ts
│       │   │   ├── login.dto.ts
│       │   │   ├── refresh-token.dto.ts
│       │   │   └── auth-response.dto.ts
│       │   ├── guards/
│       │   │   ├── jwt-auth.guard.ts            # Global guard (registered in AppModule)
│       │   │   └── refresh-token.guard.ts
│       │   ├── interfaces/
│       │   │   └── jwt-payload.interface.ts
│       │   ├── strategies/
│       │   │   ├── jwt.strategy.ts              # Access token validation
│       │   │   └── refresh-token.strategy.ts   # Refresh token validation
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   └── auth.module.ts
│       │
│       ├── users/
│       │   ├── dto/
│       │   │   └── user-response.dto.ts         # Safe user DTO (no password)
│       │   ├── users.service.ts
│       │   └── users.module.ts
│       │
│       ├── organizations/
│       │   ├── dto/
│       │   │   ├── create-organization.dto.ts
│       │   │   ├── update-organization.dto.ts
│       │   │   ├── invite-member.dto.ts
│       │   │   ├── update-member-role.dto.ts
│       │   │   └── organization-response.dto.ts
│       │   ├── organizations.controller.ts
│       │   ├── organizations.service.ts
│       │   └── organizations.module.ts
│       │
│       ├── projects/
│       │   ├── dto/
│       │   │   ├── create-project.dto.ts
│       │   │   ├── update-project.dto.ts
│       │   │   ├── project-query.dto.ts         # Rich filtering + sorting DTO
│       │   │   └── project-response.dto.ts
│       │   ├── projects.controller.ts
│       │   ├── projects.service.ts
│       │   └── projects.module.ts
│       │
│       ├── tasks/
│       │   ├── dto/
│       │   │   ├── create-task.dto.ts
│       │   │   ├── update-task.dto.ts
│       │   │   ├── task-query.dto.ts            # Richest query DTO — multi-value enums
│       │   │   ├── assign-members.dto.ts
│       │   │   ├── update-task-status.dto.ts
│       │   │   ├── bulk-update-tasks.dto.ts     # Max 50 tasks per bulk operation
│       │   │   └── task-response.dto.ts
│       │   ├── tasks.controller.ts
│       │   ├── tasks.service.ts
│       │   └── tasks.module.ts
│       │
│       └── comments/
│           ├── dto/
│           │   ├── create-comment.dto.ts
│           │   ├── update-comment.dto.ts
│           │   ├── comment-query.dto.ts
│           │   └── comment-response.dto.ts
│           ├── comments.controller.ts
│           ├── comments.service.ts
│           └── comments.module.ts
│
├── prisma/
│   ├── schema.prisma                    # 9 models, 4 enums, indexes, relations
│   ├── migrations/                      # Auto-generated migration history
│   └── seed.ts                          # Realistic seed data (3 users, org, project, tasks)
│
├── test/
│   ├── jest-e2e.json                    # Integration test Jest config
│   ├── helpers/
│   │   ├── test-app.helper.ts           # Boot real NestJS app for integration tests
│   │   └── test-data.helper.ts          # Factory functions (registerUser, createOrg, etc.)
│   └── integration/
│       ├── auth.integration.spec.ts     # 15 auth integration tests
│       ├── organizations.integration.spec.ts
│       └── tasks.integration.spec.ts
│
├── .env                                 # Local environment (never committed)
├── .env.example                         # Template — commit this
├── .gitignore
├── docker-compose.yml                   # Dev DB + test DB
├── Dockerfile                           # Multi-stage production build
├── nest-cli.json                        # NestJS CLI + Swagger plugin config
├── package.json
└── tsconfig.json                        # Strict TypeScript + path aliases
```

---

## 🗄 Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐          ┌──────────────────────┐          ┌──────────────────┐
│      User       │          │  OrganizationMember   │          │   Organization   │
├─────────────────┤          ├──────────────────────┤          ├──────────────────┤
│ id (PK, UUID)   │◄────────►│ userId (FK)           │◄────────►│ id (PK, UUID)    │
│ email (UNIQUE)  │          │ organizationId (FK)   │          │ name             │
│ password        │          │ role (OWNER/ADMIN/    │          │ slug (UNIQUE)    │
│ firstName       │          │       MEMBER)         │          │ description      │
│ lastName        │          │ joinedAt              │          │ logoUrl          │
│ avatarUrl       │          └──────────────────────┘          │ isActive         │
│ isActive        │                                            └──────────────────┘
│ isEmailVerified │                                                      │
└─────────────────┘                                                      │ 1:N
         │                                                               ▼
         │ 1:N                                                 ┌──────────────────┐
         ▼                                                     │     Project      │
┌─────────────────┐                                            ├──────────────────┤
│  RefreshToken   │                                            │ id (PK, UUID)    │
├─────────────────┤                                            │ name             │
│ id (PK, UUID)   │                                            │ description      │
│ token (UNIQUE)  │                                            │ status           │
│ userId (FK)     │                                            │ organizationId   │
│ expiresAt       │                                            │ createdById      │
│ isRevoked       │                                            │ startDate        │
└─────────────────┘                                            │ endDate          │
                                                               │ isDeleted        │
         ┌─────────────────────────────────────────────────────┘
         │ 1:N
         ▼
┌─────────────────┐          ┌──────────────────────┐
│      Task       │          │    TaskAssignee       │
├─────────────────┤          ├──────────────────────┤
│ id (PK, UUID)   │◄────────►│ taskId (FK)           │
│ title           │          │ userId (FK)           │
│ description     │          │ assignedAt            │
│ status          │          └──────────────────────┘
│ priority        │
│ projectId (FK)  │          ┌──────────────────────┐
│ createdById (FK)│          │       TaskTag         │
│ dueDate         │◄────────►├──────────────────────┤
│ position        │          │ taskId (FK)           │
│ isDeleted       │          │ tagId (FK)            │
└─────────────────┘          └──────────────────────┘
         │ 1:N                         ▲
         ▼                             │ N:M
┌─────────────────┐          ┌──────────────────────┐
│    Comment      │          │         Tag           │
├─────────────────┤          ├──────────────────────┤
│ id (PK, UUID)   │          │ id (PK, UUID)         │
│ content         │          │ name (UNIQUE)         │
│ taskId (FK)     │          │ color (hex)           │
│ authorId (FK)   │          └──────────────────────┘
│ isEdited        │
└─────────────────┘
```

### Models Summary

| Model | Purpose | Key Fields |
|---|---|---|
| `User` | Application users | email (unique), bcrypt password, isActive |
| `RefreshToken` | Session management | token (unique), isRevoked, expiresAt |
| `Organization` | SaaS tenant boundary | slug (unique), isActive |
| `OrganizationMember` | User ↔ Org junction | role (OWNER/ADMIN/MEMBER) — unique (userId, orgId) |
| `Project` | Work container | status, isDeleted (soft delete), date range |
| `Task` | Core work item | status, priority, position, dueDate, isDeleted |
| `TaskAssignee` | Task ↔ User junction | unique (taskId, userId) |
| `Comment` | Collaboration | isEdited flag, soft delete via cascade |
| `Tag` | Task labelling | name (unique), hex color |

### Enums

```prisma
enum OrganizationRole { OWNER, ADMIN, MEMBER }
enum ProjectStatus    { ACTIVE, ARCHIVED, COMPLETED }
enum TaskStatus       { TODO, IN_PROGRESS, IN_REVIEW, DONE, CANCELLED }
enum TaskPriority     { LOW, MEDIUM, HIGH, URGENT }
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+
- **npm** 9+
- **Docker** and **Docker Compose**
- **Git**

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/task-management-api.git
cd task-management-api
npm install
```

### 2. Start the Database

```bash
docker-compose up -d postgres
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values (defaults work for local dev)
```

### 4. Run Migrations & Seed

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed with test data
npm run prisma:seed
```

### 5. Start the API

```bash
# Development (watch mode)
npm run start:dev

# Production build
npm run build && npm run start:prod
```

### 6. Explore the API

| URL | Description |
|---|---|
| `http://localhost:3000/docs` | Swagger UI — interactive API docs |
| `http://localhost:5555` | Prisma Studio — visual DB browser |

**Seeded test accounts (all password: `Password123!`):**

| Email | Role in Acme Corp |
|---|---|
| `alice@example.com` | OWNER |
| `bob@example.com` | ADMIN |
| `carol@example.com` | MEMBER |

---

## ⚙️ Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | `development` or `production` |
| `PORT` | No | `3000` | HTTP port |
| `API_PREFIX` | No | `api/v1` | Global route prefix |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string |
| `DATABASE_TEST_URL` | For tests | — | Separate test database |
| `JWT_SECRET` | **Yes** | — | Access token signing secret |
| `JWT_EXPIRES_IN` | No | `15m` | Access token TTL |
| `JWT_REFRESH_SECRET` | **Yes** | — | Refresh token signing secret |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token TTL |
| `BCRYPT_ROUNDS` | No | `10` | Password hashing cost factor |
| `FRONTEND_URL` | Prod only | — | Allowed CORS origin in production |

```env
# .env.example
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

DATABASE_URL=postgresql://postgres:password@localhost:5432/task_management_db
DATABASE_TEST_URL=postgresql://postgres:password@localhost:5433/task_management_test

JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production-min-32-chars
JWT_REFRESH_EXPIRES_IN=7d

BCRYPT_ROUNDS=10
```

---

## 📡 API Reference

### Base URL
```
http://localhost:3000/api/v1
```

### Response Envelope

Every successful response:
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

Every error response:
```json
{
  "statusCode": 404,
  "message": "Project with identifier 'abc' not found",
  "error": "Not Found",
  "path": "/api/v1/organizations/acme-corp/projects/abc",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### 🔐 Auth Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register new user account |
| `POST` | `/auth/login` | Public | Login, receive access + refresh tokens |
| `POST` | `/auth/refresh` | Refresh Token | Rotate refresh token, get new access token |
| `POST` | `/auth/logout` | JWT | Revoke current session refresh token |
| `POST` | `/auth/logout-all` | JWT | Revoke all sessions for this user |
| `GET` | `/auth/me` | JWT | Get current authenticated user profile |

**Register:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "Password123!",
    "firstName": "Alice",
    "lastName": "Johnson"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "Password123!"}'
```

**Refresh:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<your-refresh-token>"}'
```

---

### 🏢 Organization Endpoints

| Method | Endpoint | Min Role | Description |
|---|---|---|---|
| `POST` | `/organizations` | Authenticated | Create organization (creator becomes OWNER) |
| `GET` | `/organizations` | Authenticated | List my organizations (paginated) |
| `GET` | `/organizations/:slug` | MEMBER | Get organization details |
| `PATCH` | `/organizations/:slug` | ADMIN | Update organization settings |
| `DELETE` | `/organizations/:slug` | OWNER | Soft-delete organization |
| `POST` | `/organizations/:slug/members` | ADMIN | Invite user by email |
| `GET` | `/organizations/:slug/members` | MEMBER | List all members (paginated) |
| `PATCH` | `/organizations/:slug/members/:userId` | OWNER | Change member's role |
| `DELETE` | `/organizations/:slug/members/:userId` | ADMIN | Remove a member |

**Create Organization:**
```bash
curl -X POST http://localhost:3000/api/v1/organizations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "slug": "acme-corp", "description": "Building great products"}'
```

**Invite Member:**
```bash
curl -X POST http://localhost:3000/api/v1/organizations/acme-corp/members \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "bob@example.com", "role": "ADMIN"}'
```

---

### 📁 Project Endpoints

| Method | Endpoint | Min Role | Description |
|---|---|---|---|
| `POST` | `/organizations/:slug/projects` | ADMIN | Create a project |
| `GET` | `/organizations/:slug/projects` | MEMBER | List projects (filtering + pagination) |
| `GET` | `/organizations/:slug/projects/:projectId` | MEMBER | Get project + task counts |
| `PATCH` | `/organizations/:slug/projects/:projectId` | ADMIN | Update project |
| `DELETE` | `/organizations/:slug/projects/:projectId` | ADMIN | Soft-delete project |
| `GET` | `/organizations/:slug/projects/:projectId/stats` | MEMBER | Project statistics |

**List Projects with Filters:**
```bash
curl "http://localhost:3000/api/v1/organizations/acme-corp/projects?status=ACTIVE&sortBy=name&sortOrder=asc&page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Project Stats:**
```bash
curl "http://localhost:3000/api/v1/organizations/acme-corp/projects/$PROJECT_ID/stats" \
  -H "Authorization: Bearer $TOKEN"
```

Response:
```json
{
  "success": true,
  "data": {
    "totalTasks": 24,
    "completedTasks": 18,
    "completionRate": 75,
    "tasksByStatus": { "TODO": 3, "IN_PROGRESS": 2, "IN_REVIEW": 1, "DONE": 18 },
    "tasksByPriority": { "LOW": 4, "MEDIUM": 10, "HIGH": 8, "URGENT": 2 },
    "totalMembers": 5,
    "overdueTasksCount": 2
  }
}
```

---

### ✅ Task Endpoints

| Method | Endpoint | Min Role | Description |
|---|---|---|---|
| `POST` | `…/tasks` | MEMBER | Create a task |
| `GET` | `…/tasks` | MEMBER | List tasks (rich filtering) |
| `GET` | `…/tasks/:taskId` | MEMBER | Get task + comment count |
| `PATCH` | `…/tasks/:taskId` | MEMBER | Update task fields |
| `DELETE` | `…/tasks/:taskId` | MEMBER | Soft-delete task |
| `POST` | `…/tasks/:taskId/assign` | MEMBER | Set assignees (replaces current) |
| `DELETE` | `…/tasks/:taskId/assign/:userId` | MEMBER | Unassign a specific user |
| `PATCH` | `…/tasks/:taskId/status` | MEMBER | Update status (auto-positions) |
| `PATCH` | `…/tasks/bulk` | ADMIN | Bulk update up to 50 tasks |

**Create Task with Assignees:**
```bash
curl -X POST "http://localhost:3000/api/v1/organizations/acme-corp/projects/$PROJECT_ID/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement login page",
    "description": "Build the login form with email/password validation",
    "priority": "HIGH",
    "dueDate": "2024-03-15",
    "assigneeIds": ["user-uuid-1", "user-uuid-2"]
  }'
```

**Rich Filtering Examples:**
```bash
# Filter by multiple statuses (comma-separated)
?status=TODO,IN_PROGRESS

# Filter by multiple priorities
?priority=HIGH,URGENT

# Filter by assignee
?assigneeId=user-uuid-1

# Overdue tasks only
?overdue=true

# Date range
?dueAfter=2024-01-01&dueBefore=2024-03-31

# Combined filters
?status=TODO&priority=HIGH,URGENT&search=login&sortBy=dueDate&sortOrder=asc&page=1&limit=20
```

**Bulk Update:**
```bash
curl -X PATCH "…/tasks/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taskIds": ["uuid-1", "uuid-2", "uuid-3"],
    "status": "IN_PROGRESS",
    "priority": "HIGH"
  }'
```
Response includes `updatedCount`, `updatedIds`, and `skippedIds` (tasks not found in project).

---

### 💬 Comment Endpoints

| Method | Endpoint | Min Role | Description |
|---|---|---|---|
| `POST` | `…/comments` | MEMBER | Add a comment to a task |
| `GET` | `…/comments` | MEMBER | List comments (chronological, paginated) |
| `PATCH` | `…/comments/:commentId` | Author only | Edit own comment |
| `DELETE` | `…/comments/:commentId` | Author or ADMIN | Delete comment |

**Comment Response includes `isOwn` flag:**
```json
{
  "id": "uuid",
  "content": "Looks great! Ready for review.",
  "taskId": "task-uuid",
  "isEdited": false,
  "isOwn": true,
  "author": { "id": "user-uuid", "firstName": "Alice", "lastName": "Johnson" },
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

---

## 🔐 Authentication Flow

### Access Token Flow (per-request)
```
Client                          API Server                      Database
  │                                 │                               │
  │── POST /auth/login ────────────►│                               │
  │   { email, password }           │── SELECT user WHERE email ───►│
  │                                 │◄── User record ───────────────│
  │                                 │── bcrypt.compare() ──────────►│ (CPU, not DB)
  │                                 │── signAsync(payload) ─────────│ (JWT library)
  │                                 │── INSERT refresh_token ───────►│
  │◄── { accessToken, refreshToken }│                               │
  │                                 │                               │
  │── GET /auth/me ────────────────►│                               │
  │   Authorization: Bearer <token> │── verify JWT signature ───────│ (no DB query)
  │                                 │── SELECT user WHERE id ───────►│
  │◄── { user } ───────────────────│                               │
```

### Refresh Token Rotation
```
  │── POST /auth/refresh ──────────►│
  │   { refreshToken }              │── SELECT token WHERE token = ? ►│
  │                                 │   Check: !isRevoked, !expired    │
  │                                 │   Check: userId matches JWT      │
  │                                 │── UPDATE SET isRevoked=true ────►│ (old token invalidated)
  │                                 │── INSERT new refresh_token ─────►│ (new token created)
  │◄── { newAccessToken,           │                                  │
  │      newRefreshToken }          │                                  │
```

---

## 🛡 Role-Based Access Control

### Role Hierarchy

```
OWNER (level 3)  ──►  Can do everything including delete org
    │
ADMIN (level 2)  ──►  Can manage members, settings, projects
    │
MEMBER (level 1) ──►  Can view, create tasks, comment
```

The `OrganizationRoleGuard` implements hierarchical checks:

```typescript
// OWNER satisfies ADMIN requirements, ADMIN satisfies MEMBER requirements
private hasRequiredRole(userRole, requiredRoles): boolean {
  const hierarchy = { OWNER: 3, ADMIN: 2, MEMBER: 1 };
  const userLevel = hierarchy[userRole];
  return requiredRoles.some(role => userLevel >= hierarchy[role]);
}
```

### Permission Matrix

| Action | MEMBER | ADMIN | OWNER |
|---|:---:|:---:|:---:|
| View organization | ✅ | ✅ | ✅ |
| Update organization | ❌ | ✅ | ✅ |
| Delete organization | ❌ | ❌ | ✅ |
| Invite members | ❌ | ✅ | ✅ |
| Assign OWNER role | ❌ | ❌ | ✅ |
| Remove members | ❌ | ✅ | ✅ |
| Create projects | ❌ | ✅ | ✅ |
| View projects | ✅ | ✅ | ✅ |
| Update projects | ❌ | ✅ | ✅ |
| Delete projects | ❌ | ✅ | ✅ |
| Create tasks | ✅ | ✅ | ✅ |
| Bulk update tasks | ❌ | ✅ | ✅ |
| Add comments | ✅ | ✅ | ✅ |
| Edit own comment | ✅ (own) | ✅ (own) | ✅ (own) |
| Delete any comment | ❌ | ✅ | ✅ |

### Guard Implementation Highlights

The guard resolves membership **in a single query** and attaches the result to the request:

```typescript
// Guard finds org + membership in ONE query
const membership = await prisma.organizationMember.findFirst({
  where: { userId: user.id, organization: { slug } },
  include: { organization: { select: { id, slug, name, isActive } } },
});

// Attach to request — controllers/services use this without re-querying
request.organization = { id, slug, name };
request.membership = { role };
```

---

## 🔍 Query Filtering & Pagination

### Pagination Response Shape

```json
{
  "data": [ ...items ],
  "meta": {
    "total": 47,
    "page": 2,
    "limit": 10,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": true
  }
}
```

### Task Query Parameters

| Parameter | Type | Example | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number (min: 1) |
| `limit` | integer | `20` | Items per page (max: 100) |
| `status` | enum[] | `TODO,IN_PROGRESS` | Comma-separated statuses |
| `priority` | enum[] | `HIGH,URGENT` | Comma-separated priorities |
| `assigneeId` | UUID | `uuid-here` | Filter by assigned user |
| `createdById` | UUID | `uuid-here` | Filter by creator |
| `search` | string | `login` | Search title + description |
| `dueBefore` | date | `2024-03-31` | Due date upper bound |
| `dueAfter` | date | `2024-01-01` | Due date lower bound |
| `overdue` | boolean | `true` | Only past-due, non-complete |
| `sortBy` | enum | `dueDate` | Field to sort by |
| `sortOrder` | `asc\|desc` | `asc` | Sort direction |

### Project Query Parameters

| Parameter | Type | Description |
|---|---|---|
| `status` | `ACTIVE\|ARCHIVED\|COMPLETED` | Filter by status |
| `search` | string | Search name + description |
| `createdById` | UUID | Filter by creator |
| `sortBy` | `name\|createdAt\|updatedAt\|startDate\|endDate` | Sort field |
| `sortOrder` | `asc\|desc` | Sort direction |

---

## 🧪 Testing

### Test Architecture

```
Unit Tests (Jest + Mocks)
  └── Test business logic in isolation
  └── Mock PrismaService, ConfigService, JwtService
  └── Fast — no database, no HTTP
  └── Located: src/**/*.spec.ts

Integration Tests (Jest + Supertest + Real DB)
  └── Test full request lifecycle
  └── Real NestJS app, real PostgreSQL (test database)
  └── Real HTTP requests via Supertest
  └── Located: test/integration/*.spec.ts
```

### Running Tests

```bash
# Unit tests (fast)
npm run test

# Unit tests with watch mode
npm run test:watch

# Unit tests with coverage report
npm run test:cov

# Integration tests (requires test DB)
docker-compose up -d postgres-test
npm run test:integration

# All tests
npm run test:all
```

### Coverage Areas

**Unit Tests:**
- `AuthService` — register, login, refresh, logout, token generation
- `OrganizationsService` — create, invite, RBAC enforcement, last-owner protection
- `ProjectsService` — CRUD, date validation, stats calculation, scope isolation
- `TasksService` — create, filter, bulk update, assignment validation, overdue detection

**Integration Tests:**
- Complete auth lifecycle (register → login → use token → refresh → logout)
- Refresh token rotation (old token rejected after rotation)
- RBAC enforcement across all role boundaries
- Information leakage prevention (non-members get 404, not 403)
- Pagination metadata correctness
- Multi-filter task queries
- Scope isolation (cross-org access returns 404)
- Bulk update with skipped ID reporting

### Integration Test Pattern

```typescript
// Each test starts with a clean database
beforeEach(async () => {
  await prisma.cleanDatabase();
  // Re-create only what this test needs
  owner = await registerUser(app);
  org = await createOrg(app, owner.tokens.accessToken);
});

// Factory helpers abstract setup noise
const task = await createTask(app, ownerToken, orgSlug, projectId);

// Real HTTP assertions
await request(app.getHttpServer())
  .patch(`/api/v1/.../tasks/bulk`)
  .set('Authorization', `Bearer ${ownerToken}`)
  .send({ taskIds: [task.id], status: 'DONE' })
  .expect(200);
```

---

## 🐳 Docker Deployment

### Development

```bash
# Start only the database (run API locally with hot-reload)
docker-compose up -d postgres

# Start everything including the API
docker-compose up
```

### Production Build

```bash
# Build the production image
docker build -t task-management-api .

# Run the container
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="..." \
  -e JWT_REFRESH_SECRET="..." \
  -e NODE_ENV="production" \
  task-management-api
```

### Multi-Stage Dockerfile Explained

```dockerfile
# Stage 1: Builder — TypeScript compilation
FROM node:20-alpine AS builder
# Install all deps (including devDeps for build)
# Run nest build → compiles to /dist

# Stage 2: Production — minimal image
FROM node:20-alpine AS production
# Copy only: /dist, /node_modules (prod only), /prisma
# Non-root user (security)
# Final image: ~180MB vs ~800MB for full node image
```

### `docker-compose.yml` Services

| Service | Port | Purpose |
|---|---|---|
| `postgres` | `5432` | Development database |
| `postgres-test` | `5433` | Integration test database (isolated) |

---

## 🔒 Security Practices

| Practice | Implementation |
|---|---|
| **Password hashing** | bcryptjs with configurable rounds (default: 10) |
| **JWT security** | Short-lived access tokens (15min), refresh rotation |
| **No token reuse** | Refresh tokens are single-use — rotation on every refresh |
| **Session revocation** | Refresh tokens stored in DB — can be invalidated immediately |
| **Mass assignment protection** | `whitelist: true` on global `ValidationPipe` |
| **Input validation** | class-validator on all DTOs — type coercion and format checks |
| **Scope isolation** | Every query includes `organizationId` — cross-tenant access impossible |
| **Information leakage** | Non-members get 404 (not 403) — org existence is not revealed |
| **Email enumeration** | Login returns identical error for wrong password and missing user |
| **SQL injection** | Impossible — all queries go through Prisma's parameterized query builder |
| **Non-root Docker** | Production container runs as `nestjs` user (uid 1001) |
| **CORS** | Restricted to `FRONTEND_URL` in production, wildcard in development |
| **Secrets in env** | No hardcoded credentials — all sensitive config in environment variables |
| **No stack traces** | Production error responses never include internal stack information |

---

## 💡 Design Decisions

### Why NestJS over Express?
NestJS enforces clean architecture by design — modules, dependency injection, and decorators are built-in rather than bolted on. This results in code that scales with team size and is immediately familiar to engineers from Spring Boot or Angular backgrounds.

### Why Prisma over TypeORM?
Prisma generates a fully type-safe client from the schema — you get auto-complete on all queries and compile-time errors on shape mismatches. TypeORM's decorator-based approach results in more boilerplate and weaker type inference.

### Why store Refresh Tokens in the database?
A purely stateless JWT system cannot revoke tokens before expiry. Storing refresh tokens allows immediate revocation on logout, password change, or account compromise. The access token remains stateless (no DB query to validate it) — only the refresh endpoint touches the database.

### Why soft delete over hard delete?
Production SaaS applications almost never hard-delete business data because: billing records reference it, audit logs reference it, users may request data exports, and mistakes need to be recoverable. Soft delete (`isDeleted: true`) with filtered queries preserves data integrity.

### Why position increments by 1000?
Inserting a task between position 5 and 6 would require renumbering all subsequent tasks if positions were sequential integers. With 1000-unit gaps, you have 999 insertion slots between any two items — no renumbering needed. This is the approach used by Linear, Notion, and Jira.

### Why attach org/membership to `request` in the guard?
The guard already queries the database for org membership. If the service re-queried the same data, that's a wasted round-trip per request. Attaching to `request` shares the resolved context for the entire request lifecycle — the "resolve once, use everywhere" pattern.

### Why `Promise.all` for count + findMany?
These two queries are independent — `count` doesn't need `findMany`'s result and vice versa. Running them in parallel with `Promise.all` cuts the response time for paginated endpoints roughly in half under real database latency.

---

## 📋 npm Scripts Reference

```bash
npm run start:dev          # Start with hot-reload (development)
npm run start:prod         # Start compiled production build
npm run build              # Compile TypeScript to /dist
npm run lint               # ESLint with auto-fix

npm run test               # Run all unit tests
npm run test:watch         # Unit tests in watch mode
npm run test:cov           # Unit tests with coverage report
npm run test:integration   # Integration tests (requires test DB)
npm run test:all           # Unit + integration tests

npm run prisma:generate    # Regenerate Prisma client after schema changes
npm run prisma:migrate     # Create and run new migration (dev)
npm run prisma:migrate:prod # Run pending migrations (production)
npm run prisma:seed        # Seed database with test data
npm run prisma:reset       # Drop all tables and re-migrate (dev only)
npm run prisma:studio      # Open Prisma Studio at localhost:5555
```

---

## 🗺 Roadmap / Future Enhancements

- [ ] **Email verification** — send confirmation email on register
- [ ] **Password reset** — email-based reset flow
- [ ] **File attachments** — S3 integration for task attachments
- [ ] **Real-time updates** — WebSocket gateway for live task updates
- [ ] **Rate limiting** — `@nestjs/throttler` on auth endpoints
- [ ] **Redis caching** — Cache refresh token lookups
- [ ] **Notifications** — In-app notification system for mentions and assignments
- [ ] **Audit log** — Track all changes with timestamp and actor
- [ ] **Webhooks** — Notify external services on task status changes
- [ ] **CSV export** — Export tasks to spreadsheet
- [ ] **CI/CD Pipeline** — GitHub Actions with automated test + deploy

---

## 👨‍💻 Interview Talking Points

> *"I built a multi-tenant SaaS Task Management API similar in architecture to Trello or Linear. It uses NestJS with TypeScript, PostgreSQL with Prisma, and implements JWT authentication with refresh token rotation. The multi-tenancy model uses Organizations as the tenant boundary — every project and task is scoped to an org, and access is controlled by a hierarchical RBAC system. I built a custom guard that resolves org membership in a single database query and attaches the result to the request context so downstream handlers don't re-query. The API includes rich query support — multi-value enum filtering, full-text search, date range queries, overdue detection — plus bulk operations and soft deletes. I covered it with both unit tests using Jest mocks and integration tests using a real test database and HTTP assertions."*

**Key concepts to discuss:**

- **Multi-tenancy** via Organization scoping — every query filters by `organizationId`
- **JWT + refresh token rotation** — why two tokens, why store refresh tokens in DB
- **Guard pattern** — resolve-once-attach-to-request vs re-querying in services
- **Transaction usage** — atomic operations for create-org + add-member, replace-assignees
- **Soft delete** — preserves data integrity, audit trail, billing records
- **Position indexing** — 1000-increment gaps for insertion-free reordering
- **Parallel queries** — `Promise.all` for count + findMany on paginated endpoints
- **Information leakage prevention** — non-members get 404 not 403

---

## 📄 License

MIT © 2024

---

<div align="center">

Built as a portfolio project demonstrating production-grade backend engineering practices.

**[⭐ Star this repo](https://github.com/yourusername/task-management-api)** if it helped you learn something!

</div>
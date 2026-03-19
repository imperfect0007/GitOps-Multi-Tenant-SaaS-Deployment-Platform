# Day 7 — Frontend Dashboard (React UI)

## Goal

Build the user-facing dashboard so the platform is a real SaaS product people can use.

```
User → Login → Create Tenant → Create Project → Trigger Deployment
```

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| **Vite** | Build tool and dev server |
| **React 19** | UI library |
| **React Router 7** | Client-side routing |
| **Tailwind CSS 4** | Styling |
| **Axios** | HTTP client with interceptors |

---

## Project Setup

```bash
cd "GitOps Multi-Tenant SaaS Deployment Platform"
# Dashboard was created with: npm create vite@latest dashboard -- --template react
cd dashboard
npm install
npm install axios react-router-dom
npm install -D tailwindcss postcss autoprefixer @vitejs/plugin-react
```

---

## Folder Structure

```
dashboard/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css           # Tailwind entry
    ├── components/
    │   ├── Layout.jsx      # Sidebar + outlet
    │   └── ProtectedRoute.jsx
    ├── pages/
    │   ├── Login.jsx
    │   ├── Register.jsx
    │   ├── Dashboard.jsx
    │   ├── TenantList.jsx
    │   ├── TenantDetail.jsx
    │   ├── CreateTenant.jsx
    │   └── CreateProject.jsx
    └── services/
        └── api.js         # Axios instance + auth/tenants/projects
```

---

## API Integration

### Base URL

- Default: `http://localhost:8000`
- Override: set `VITE_API_URL` in `.env` (e.g. for production or `/api` proxy)

### Auth

- **Request interceptor**: adds `Authorization: Bearer <token>` from `localStorage.token` to every request.
- **Response interceptor**: on 401, clears token and redirects to `/login` only when not already on `/login` or `/register` (avoids redirect on wrong password).

### Endpoints used

| Action | Method | URL | Body |
|--------|--------|-----|------|
| Register | POST | `/auth/register` | `{ email, username, password }` |
| Login | POST | `/auth/login` | `{ username, password }` |
| Me | GET | `/auth/me` | — |
| List tenants | GET | `/tenants/?skip=0&limit=20` | — |
| Create tenant | POST | `/tenants/` | `{ name }` |
| Get tenant | GET | `/tenants/:id` | — |
| List projects | GET | `/tenants/:id/projects?skip=0&limit=20` | — |
| Create project | POST | `/tenants/:id/projects` | `{ name, image?, replicas?, port? }` |

---

## Routes

| Path | Auth | Page |
|------|------|------|
| `/login` | No | Login |
| `/register` | No | Register |
| `/` | Yes | Redirect to `/dashboard` |
| `/dashboard` | Yes | Dashboard (overview + quick links) |
| `/tenants` | Yes | Tenant list (table) |
| `/tenants/new` | Yes | Create tenant form |
| `/tenants/:id` | Yes | Tenant detail + projects list |
| `/projects/new` | Yes | Create project form (tenant selector) |
| `*` | — | Redirect to `/dashboard` |

Protected routes are wrapped in `ProtectedRoute`; missing token sends the user to `/login`.

---

## UI Overview

### Layout (authenticated)

- **Sidebar**: Logo, Dashboard, Tenants, New Tenant, New Project, Sign out.
- **Main**: `<Outlet />` for the current page.

### Login / Register

- Centered card, dark theme (slate-900/800).
- Username + password (login); email + username + password (register).
- Errors from API shown inline; success: store token and redirect (login → `/dashboard`, register → `/login`).

### Dashboard

- Welcome message (from `/auth/me`).
- List of user’s tenants (names + namespaces) with links to tenant detail.
- Quick actions: Create tenant, Deploy project.

### Tenants

- **List**: Table (name, namespace, created); “New tenant” button; empty state with link to create.
- **Detail**: Tenant name and namespace; list of projects with status (deployed / failed / other); link to “Deploy project”.
- **Create**: Single field “Tenant name”; submit → create tenant → redirect to `/tenants`.

### Projects

- **Create**: Dropdown to select tenant (from `/tenants`), then project name, image, replicas, port; submit → create project → redirect to that tenant’s detail.

---

## Running the Dashboard

```bash
# Backend must be running first (e.g. port 8000)
cd backend && uvicorn app.main:app --reload

# Frontend (from repo root)
cd dashboard
npm run dev
# → http://localhost:3000 (or next free port)
```

For production, build and serve the `dist` folder:

```bash
npm run build
npm run preview   # optional: local preview of dist
```

---

## User Flow

1. User opens app → if no token, redirect to `/login`.
2. Register (or login) → token stored in `localStorage`.
3. Dashboard shows tenants and quick actions.
4. Create tenant → POST `/tenants/` → backend creates namespace; redirect to tenant list.
5. Create project → choose tenant, fill form → POST `/tenants/:id/projects` → backend generates manifests, pushes to GitOps repo, ArgoCD deploys; redirect to tenant detail.
6. Tenant detail shows projects and status (deployed / failed).

---

## What Was Achieved

- Login and signup UI with error handling.
- Dashboard with sidebar and overview.
- Create tenant form and tenant list/detail.
- Create project form with tenant selector and API integration.
- Protected routes and auth redirect.
- Axios interceptors for token and 401.
- Dark UI with Tailwind (slate/emerald).
- Full flow: Login → Create Tenant → Create Project → Trigger Deployment.

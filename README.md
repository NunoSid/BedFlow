<div align="center">
  <img
    src="https://github.com/user-attachments/assets/fe8a16bc-0ffb-4bc0-a64f-72467c2e7ed9"
    width="672"
    height="448"
    alt="BedFlow logo"
  />
</div>


**Clinical Handover & Bed Management Platform**

> ⚠️ **Disclaimer**
>
> BedFlow is a **conceptual / demonstration project**.
> It must **not** be used with real identifiable patient data (PHI) without proper security, compliance, and governance review.

---

## Overview

**BedFlow** is a clinical operations support platform designed **from a nurse’s perspective** to improve:

- Bed management and visibility
- Structured clinical handover
- Coordination across ambulatory and multi-service environments
- Operational auditability and traceability

The focus is operational clarity, continuity of care, and governance — not clinical decision-making.

---

## Who is this for?

BedFlow is intended for:

- Nurses and nurse coordinators  
- Clinical operations and bed management teams  
- Health IT professionals  
- Developers exploring clinical workflow platforms  

It is **not intended for direct clinical use** without validation and regulatory compliance.

---

## Key Features

- **Bed management** – allocation, visibility, patient flow support  
- **Shift handover** – structured updates and continuity between teams  
- **Procedure / surgical planning** – operational alignment with capacity  
- **Role-based access control (RBAC)** – Nurse / Coordinator / Admin  
- **Audit & exports** – governance, traceability, and reporting  

---

## Architecture Overview

```
Frontend (React + Vite)
        ↓ REST API
Backend (NestJS)
        ↓ Prisma ORM
Database (SQLite / PostgreSQL)
```

---

## Technology Stack

- **Frontend:** React (Vite)
- **Backend:** NestJS
- **ORM:** Prisma
- **Database (default):** SQLite
- **Optional DB:** PostgreSQL (via Docker Compose)

---

## Quick Start (Local Development)

### Requirements

- Node.js (LTS recommended)
- npm
- (Optional) Docker + Docker Compose (for PostgreSQL)

### Run everything with one command

```bash
chmod +x start.sh
./start.sh
```

This script:

- Installs dependencies in `server/` and `client/`
- Runs `prisma:push` and `prisma:seed`
- Starts backend at `http://localhost:1893`
- Starts frontend (Vite dev server)

---

## Configuration

### Backend Environment Variables

Typical variables:

```env
DATABASE_URL=
JWT_SECRET=
JWT_EXPIRES=2h
CORS_ORIGIN=
PORT=1893
```

#### Database URLs

- **SQLite (default):**
  ```
  file:./prisma/bedflow.db
  ```

- **PostgreSQL:**
  ```
  postgresql://user:password@host:5432/db?schema=public
  ```

---

## Optional: PostgreSQL via Docker

```bash
export POSTGRES_USER=bedflow_admin
export POSTGRES_PASSWORD='CHANGE_ME'
export POSTGRES_DB=bedflow_prod

docker compose up -d
```

Then update `DATABASE_URL` accordingly.

---

## Demo

The demo showcases:

- Bed allocation and distribution
- Structured shift handover
- Operational audit logging

🎥 

https://github.com/user-attachments/assets/874bae59-3add-41b2-8ee1-4f0f579df0b1



---

## Security Notes (Minimum)

- Never expose database ports publicly
- Use a strong `JWT_SECRET`:
  ```bash
  openssl rand -hex 32
  ```
- Restrict CORS to trusted frontend domains
- Remove demo credentials in any real deployment
- RBAC enforced server-side
- Audit logs for critical operations

---

## License

MIT License.

Free to use, modify, and learn from.
Not intended for production clinical use without proper validation.

# Enterprise Leave Management System

A production-grade, full-stack Enterprise Leave Management platform built with a robust Node.js/Express REST API backend and a responsive, highly polished vanilla JavaScript/CSS enterprise frontend.

---

## 🌟 Executive Summary & How This Project Stands Out

In modern enterprise environments, time-off management is more than just tracking dates—it is a critical workflow requiring strict concurrency control, accurate accrual mathematics, and clear accountability across employees and management. 

This system was engineered from the ground up to solve real-world enterprise ERP challenges:
- **Zero Framework Bloat on Frontend**: Crafted with pristine, high-performance vanilla HTML5, CSS3, and modern ES6+ JavaScript, demonstrating deep mastery of the DOM, event bubbling, asynchronous JavaScript (`async`/`await`, `Promise.all`), and local persistence without heavy framework overhead.
- **Robust Relational Integrity**: Powered by PostgreSQL with strict ACID transactions (`BEGIN`, `COMMIT`, `ROLLBACK`), row-level locking (`FOR UPDATE`), and foreign key constraints to guarantee that concurrent leave requests or approvals never corrupt user balances or cause double-booking.
- **Enterprise Security Model**: Implements stateless JWT authentication, secure password hashing via `bcrypt` (with strict 12-round salt cost and 12–72 character complexity requirements), role-based middleware isolation (`employee` vs `manager`), and deactivation guards preventing the accidental removal of the last active administrator/manager.
- **Intelligent Balance & Overlap Enforcement**: Server-side validation rules prevent retroactive leave dates, negative balances, and overlapping requests across pending and approved states.

---

## 🛠️ Tech Stack & Architecture

### **Backend**
- **Runtime**: Node.js (CommonJS)
- **Framework**: Express.js
- **Database**: PostgreSQL (`pg` connection pool with custom type parser for ISO dates)
- **Security & Auth**: `jsonwebtoken` (JWT), `bcrypt`, `dotenv`, `cors`

### **Frontend**
- **Markup**: Semantic HTML5 with accessibility attributes (`aria-label`, `role="status"`, focus trapping)
- **Styling**: Custom CSS3 design system featuring CSS Grid, Flexbox, glass-morphism header accents, responsive layouts, and a dedicated cohesive color palette (annual blue, casual amber, sick red, personal purple)
- **Scripting**: Modular ES6+ with real-time DOM updates, localStorage caching for instantaneous UX rendering, and live form validations

---

## 🏛️ System Architecture & Flow Control

The application follows a rigorous **Route → Middleware → Controller → Service → Database** pattern:

```
[ Browser Frontend ] 
       │ (Fetch + Bearer Token)
       ▼
[ Express Server (port 3000) ]
       ├── Auth Middleware (JWT Verify & Active User Check)
       ├── Role Authorization Middleware (Employee / Manager)
       └── Input Validation Middleware (Sanitization & Date Parsing)
               │
               ▼
[ Controllers & Business Services ]
       ├── Leave Balance Service (Annual 10, Sick 5, Casual 3, Personal 2)
       ├── Overlap Detection Engine
       └── ACID Transaction Manager (PostgreSQL Pool & Client Connections)
```

### **Core Workflows**

1. **Authentication & Session Lifecycle**:
   - Users authenticate via `/api/login` selecting their role (`employee` or `manager`).
   - The backend validates password hashes against `users.password_hash` and checks `is_active = TRUE`.
   - A 1-hour signed JWT containing user `id`, `username`, and `role` is issued and stored securely in `localStorage`.
   - All protected endpoints require `Authorization: Bearer <token>`. Expired or inactive sessions trigger automatic logout and redirection.

2. **Leave Application & Balance Check**:
   - Employees submit leave requests (`POST /api/leaves`).
   - The backend calculates duration in business days (`end_date - start_date + 1`), checks against current-year approved usage via `getLeaveBalance()`, and verifies absence of active/pending overlaps (`findOverlappingActiveLeave()`).
   - If sufficient balance exists within the annual allocation pool, an ACID insert commits the record as `pending`.

3. **Manager Review & Concurrency Control**:
   - Managers access pending applications and cancellations.
   - The manager review modal queries employee balances and approved leave history in real-time (`GET /api/leaves/:id/review`).
   - Approvals execute inside a transaction with `FOR UPDATE` row locks to prevent race conditions when two managers review simultaneously.

4. **Cancellation Requests & Status Transparency**:
   - Approved leaves can have cancellation requests submitted by employees.
   - The UI intelligently freezes duplicate cancellation requests (`has_pending_cancellation`) to prevent spamming.
   - Review metadata (`reviewed_at`, `reviewed_by`, `reviewer_name`) provides complete audit transparency for employees.

---

## 🚀 Getting Started & Installation

### **Prerequisites**
- Node.js (v18+ recommended)
- PostgreSQL database instance

### **1. Clone the Repository**
```bash
git clone https://github.com/Danish-Adnaan/Enterprise-Leave-Management.git
cd Enterprise-Leave-Management
```

### **2. Install Dependencies**
```bash
npm install
```

### **3. Configure Environment Variables**
Create a `.env` file in the root directory matching your PostgreSQL setup:
```env
DB_HOST = localhost
DB_PORT = 5432
DB_NAME = enterprise_leave_management
DB_USER = postgres
DB_PASSWORD = your_secure_password
JWT_SECRET = your_jwt_secret_key
```

### **4. Initialize Database Schema**
Run your PostgreSQL client and execute the necessary table definitions (`users`, `leaves`, `leave_cancellation_requests`), followed by the migration script:
```bash
psql -h localhost -U postgres -d enterprise_leave_management -f backend/migrations/001_leave_review_metadata.sql
```

### **5. Run the Application**
Start the backend API server:
```bash
node backend/server.js
```

Serve the frontend using any static file server (such as Live Server in VS Code or `npx serve frontend`):
```bash
npx live-server frontend
```
Open `http://127.0.0.1:5500/index.html` in your browser.

---

## 🔒 Security & Best Practices
- **No Hardcoded Secrets**: All credentials are kept strictly in `.env` and excluded via `.gitignore`.
- **Prepared Statements**: All database queries use parameterized SQL placeholders (`$1`, `$2`, ...) to prevent SQL injection.
- **Bcrypt Hashing**: Passwords are cryptographically hashed using 12 salt rounds.
- **Role Enforcement**: Middleware checks prevent employees from accessing manager-only endpoints (such as user deactivation or pending approvals).

---

## 🛡️ License
Distributed under the ISC License.

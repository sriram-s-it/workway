# WORKWAY - Professional Service Booking Platform

WORKWAY is a production-style, enterprise-grade service booking web platform connecting customers with certified department service workers through dedicated Department Heads and central Administration.

## Email verification setup

Real verification codes are sent only through a configured SMTP provider; the application never exposes the code in the browser or API response. Copy `.env.example` to `.env`, then provide the SMTP details for an email account or transactional email service you control. For Gmail, use a Gmail App Password (not your normal Gmail password) after enabling two-step verification. Restart the server after saving `.env`.

If email delivery is not configured or the provider rejects a message, registration is stopped and no unverified account is created. Users can request a new six-digit code from the verification page; each code expires in 15 minutes and permits five attempts.

---

## 1. System Architecture

```
WORKWAY/
├── frontend/                     # React + Vite frontend application
│   ├── src/
│   │   ├── components/           # Reusable UI & Layout components
│   │   ├── pages/                # Multi-role view routing
│   │   │   ├── public/           # Home, Services, Auth, Email Verification
│   │   │   ├── customer/         # Bookings, Live Status, Confirm & Pay, Reviews
│   │   │   ├── head/             # Incoming requests, Worker assign/manage
│   │   │   ├── worker/           # Assignment accept/decline, Start/Complete job
│   │   │   └── admin/            # Department CRUD, Head assignment, Analytics, Audit
│   │   ├── context/              # AuthContext, NotificationContext, SocketContext
│   │   ├── services/             # Axios API service clients
│   │   ├── hooks/                # Custom React hooks
│   │   └── utils/                # Formatting, date helpers, status maps
├── backend/                      # Node.js + Express.js REST API + Socket.IO
│   ├── controllers/              # Auth, Dept, Service, Worker, Booking, Payment, Head
│   ├── routes/                   # Route handlers per module
│   ├── models/                   # Data access layer & query builders
│   ├── middleware/               # Auth (JWT), Role-check, Validation, Error handler
│   ├── services/                 # Mailer (Nodemailer), Cashfree, Socket manager
│   ├── utils/                    # Password hashing, code generators, error classes
│   ├── config/                   # Database pool, Environment loaders
│   └── database/                 # Connection abstraction & schema migrations
├── database/
│   ├── schema.sql                # Complete 14-table MySQL 8.0+ schema
│   ├── migrations/               # Ordered schema migration scripts
│   └── seed/                     # Seed data (Admin, default depts, service catalog)
├── .env.example                  # Environment configuration template
└── README.md
```

---

## 2. Database Architecture & Schema Design (MySQL)

The database schema is strictly normalized and enforces all business constraints at the relational layer with foreign keys, indexes, cascades, and check constraints:

| Table | Description | Primary Key | Key Foreign Keys & Unique Constraints |
|---|---|---|---|
| `users` | All system users (Admin, Head, Worker, User) | `id` (BIGINT) | `email` (UNIQUE), index on `role`, `phone` |
| `departments` | Operational service divisions | `id` (INT) | `name` (UNIQUE), `head_user_id` (UNIQUE FK -> users) |
| `services` | Fixed-price service catalog | `id` (INT) | FK `department_id` -> departments |
| `workers` | Worker profiles & real-time availability | `id` (BIGINT) | `user_id` (UNIQUE FK -> users), FK `department_id` -> departments |
| `worker_profiles` | Extended bio, photo, contact info | `id` (BIGINT) | `worker_id` (UNIQUE FK -> workers) |
| `bookings` | Immediate service orders | `id` (VARCHAR 36 UUID) | `booking_number` (UNIQUE), FKs to `customer_id`, `department_id`, `service_id`, `assigned_worker_id` |
| `booking_assignments`| Worker assignments & 10-min countdown | `id` (BIGINT) | FKs to `booking_id`, `worker_id`, `assigned_by_head_id` |
| `booking_status_history`| Audit timeline of every state transition | `id` (BIGINT) | FKs to `booking_id`, `actor_user_id` |
| `cancellation_records`| Cancellation audit and 30-min window tracking | `id` (BIGINT) | `booking_id` (UNIQUE FK), FK to `cancelled_by_user_id` |
| `payments` | Cashfree transaction records & UPI sessions | `id` (BIGINT) | `payment_reference` (UNIQUE), `cashfree_order_id` (UNIQUE), FKs to `booking_id`, `user_id` |
| `feedback` | Verified star ratings (1-5) and reviews | `id` (BIGINT) | `booking_id` (UNIQUE FK), FKs to `customer_id`, `worker_id` |
| `notifications` | In-app alerts for all four roles | `id` (BIGINT) | FKs to `user_id`, `booking_id` |
| `email_verifications`| Hashed OTPs with TTL and retry limits | `id` (BIGINT) | FK to `user_id`, index on `email`, `expires_at` |
| `audit_logs` | Immutable audit trail for Admin operations | `id` (BIGINT) | FK to `admin_user_id` |

---

## 3. Core Business Workflow & Rules

1. **Four Strict Roles**: `ADMIN`, `DEPARTMENT_HEAD`, `WORKER`, `USER`.
   - Customer registration strictly defaults to `role = USER`.
   - Admin assigns one Department Head per department (`uq_departments_head_user`).
   - Department Head registers and manages Workers in their assigned department.

2. **Immediate Booking & Availability Check**:
   - Customer books an available service with fixed price, address, phone, and up to 5 photos.
   - If no workers in the department are currently `AVAILABLE`, the system informs the user and rejects assignment without creating fake worker data.

3. **Head Approval & Assignment**:
   - Head reviews booking request and manually selects an `AVAILABLE` worker.
   - Worker receives assignment with a **10-minute timeout**.

4. **Worker Response & Job Execution**:
   - Worker must **Accept** (status becomes `ASSIGNED`, worker becomes `BUSY`) or **Decline** with a mandatory reason.
   - If declined or timed out (10 min), the assignment state becomes `DECLINED` or `EXPIRED`, worker remains `AVAILABLE`, and Head can assign another worker.
   - Worker clicks **Start Work** (`WORK_STARTED`), then **Complete Work** (`WORK_COMPLETED`).

5. **Customer Confirmation & Payment**:
   - Customer confirms completion (`CUSTOMER_CONFIRMED` -> `PAYMENT_PENDING`).
   - Payment processed via Cashfree PG with UPI support. Server verifies Cashfree webhook signature and order status before marking `PAID` and `COMPLETED`.
   - Worker's status returns to `AVAILABLE` and rating is updated based on feedback.

6. **Cancellation Policy**:
   - Free cancellation before Head approval and within 30 minutes of worker assignment.
   - After 30 minutes (before work started), cancellation incurs a ₹100 fee collected via Cashfree.
   - Once work has started (`WORK_STARTED`), cancellation is strictly prevented.

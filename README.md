# 📡 Content Broadcasting System

A backend system for educational content distribution — teachers upload subject content, principals approve it, and students access live content via public APIs.

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL
- **Auth**: JWT + bcrypt
- **File Upload**: Multer (local storage by default, S3 if configured)
- **Rate Limiting**: express-rate-limit

---

## ⚙️ Setup Instructions

### 1. Prerequisites
- Node.js v18+
- MYSQL running locally (on cleverCloud for remote)

### 2. Clone & Install
```bash
git clone <your-repo-url>
cd content-broadcasting-system
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env
```
Edit `.env` with your DB credentials:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=content_broadcasting
DB_USER=postgres
DB_PASSWORD=yourpassword
JWT_SECRET=your_secret_key
```

### 4. Create Database
```bash
createdb content_broadcasting
```
Or in psql:
```sql
CREATE DATABASE content_broadcasting;
```

### 5. Run Migrations
```bash
npm run db:migrate
```

### 6. Seed Demo Data (optional)
```bash
npm run db:seed
```
This creates:
- Principal: `principal@school.com` / `password123`
- Teacher 1: `teacher1@school.com` / `password123`
- Teacher 2: `teacher2@school.com` / `password123`

### 7. Start Server
```bash
npm run dev       # development (nodemon)
npm start         # production
```
Server runs on `http://localhost:3000`

---

## 📦 S3 Storage (Optional)

If you have AWS credentials, add to `.env`:
```env
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
```

If these are **not** set → system automatically uses **local storage** (`/uploads` folder). No code change needed.

---

## 🔌 API Reference

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | None | Register user |
| POST | `/auth/login` | None | Login |
| GET | `/auth/me` | JWT | Get current user |

**Register**
```json
POST /auth/register
{
  "name": "Mrs. Sharma",
  "email": "sharma@school.com",
  "password": "pass123",
  "role": "teacher"
}
```

**Login**
```json
POST /auth/login
{
  "email": "sharma@school.com",
  "password": "pass123"
}
```
Returns: `{ token: "eyJ..." }`

---

### Teacher Endpoints (Bearer Token Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/content/upload` | Upload content (multipart/form-data) |
| GET | `/content/my` | View my uploaded content |

**Upload Content** (multipart/form-data)
```
POST /content/upload
Headers: Authorization: Bearer <token>

Fields:
  title             (required)  string
  subject           (required)  string - e.g. "maths", "science"
  file              (required)  image file (jpg/png/gif, max 10MB)
  description       (optional)  string
  start_time        (optional)  ISO datetime - when content becomes visible
  end_time          (optional)  ISO datetime - when content stops being visible
  rotation_duration (optional)  number - minutes per rotation slot (default: 5)
```

**Get My Content**
```
GET /content/my?status=pending&subject=maths
```
Query params (all optional): `status`, `subject`

---

### Principal Endpoints (Bearer Token Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/content/all` | View all content |
| GET | `/content/pending` | View pending content |
| PATCH | `/content/:id/approve` | Approve content |
| PATCH | `/content/:id/reject` | Reject content |

**Approve Content**
```
PATCH /content/5/approve
Headers: Authorization: Bearer <token>
```

**Reject Content**
```json
PATCH /content/5/reject
Headers: Authorization: Bearer <token>

{
  "reason": "Content is outdated. Please upload latest syllabus."
}
```

---

### Public Broadcasting API (No Auth — Students)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/content/live/:teacherId` | Get active live content for teacher |
| GET | `/content/live/:teacherId/subjects` | Get all subjects for teacher |

**Get Live Content**
```
GET /content/live/1
GET /content/live/1?subject=maths
```

**Response — Content Available:**
```json
{
  "success": true,
  "message": "Live content fetched successfully.",
  "data": {
    "teacher": { "id": 1, "name": "Mrs. Sharma" },
    "content": [
      {
        "id": 3,
        "title": "Chapter 5 - Algebra",
        "subject": "maths",
        "file_url": "/uploads/abc123.jpg",
        "duration": 5,
        "rotation_order": 1
      }
    ],
    "fetched_at": "2024-01-15T09:07:00.000Z"
  }
}
```

**Response — No Content:**
```json
{
  "success": true,
  "message": "No content available",
  "data": null
}
```

---

## 🔄 Scheduling Logic

The system uses **stateless time-based rotation**:

1. All approved content for a teacher+subject within `start_time`→`end_time` is fetched
2. Items are sorted by `rotation_order`
3. `total_cycle = sum of all durations`
4. `position_in_cycle = (minutes since midnight) % total_cycle`
5. Walk through items to find which is active

**Example with 3 Maths items (5 min each):**
```
9:00–9:05 → Content A
9:05–9:10 → Content B
9:10–9:15 → Content C
9:15–9:20 → Content A (loops)
...
```

No cron jobs. No background workers. Deterministic & stateless.

---

## 🚨 Edge Cases Handled

| Case | Response |
|------|----------|
| No approved content for teacher | `"No content available"` |
| Content approved but no time window set | `"No content available"` |
| Time window hasn't started yet | `"No content available"` |
| Time window has passed | `"No content available"` |
| Invalid teacher ID | `"No content available"` |
| Invalid/unknown subject | `"No content available"` |
| Wrong file type | `400 - Invalid file type` |
| File too large | `400 - File too large` |
| Reject without reason | `400 - Rejection reason required` |

---

## 🔒 Security

- JWT required on all non-public routes
- RBAC: teachers cannot access principal routes and vice versa
- Passwords hashed with bcrypt (10 rounds)
- Rate limiting on public API (60 req/min per IP)
- File type validation by mimetype
- No sensitive data (password_hash) in responses

---

## 📁 Project Structure

```
src/
├── app.js                         # Entry point
├── config/
│   ├── db.js                      # PostgreSQL pool
│   └── storage.js                 # S3 or local multer config
├── controllers/
│   ├── auth.controller.js         # Register, login
│   ├── content.controller.js      # Upload, approve, reject
│   └── broadcast.controller.js    # Public live content
├── middlewares/
│   ├── auth.middleware.js         # JWT + RBAC
│   └── error.middleware.js        # Error handler
├── routes/
│   ├── auth.routes.js
│   ├── content.routes.js
│   └── broadcast.routes.js
├── services/
│   └── scheduling.service.js      # Rotation algorithm
└── utils/
    ├── migrate.js                  # DB table creation
    └── seed.js                     # Demo data
```

---

## 📝 Assumptions

- `start_time` and `end_time` must both be provided (or neither) — content without a time window is never shown
- Times are stored and compared in UTC
- The rotation clock resets daily at midnight UTC for simplicity
- Content can only go from `pending` → `approved` or `pending` → `rejected` (no re-approval)
- Subjects are stored in lowercase for consistent matching

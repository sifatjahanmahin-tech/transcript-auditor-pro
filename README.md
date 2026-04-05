# 🎓 Transcript Auditor Pro

## The Ultimate Degree Audit Suite for NSU Students

Transcript Auditor Pro is a production-ready, cloud-synced platform that empowers students to track their academic progress through automated transcript parsing (OCR), credit calculation, and deficiency analysis.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites

- **Python 3.12+**
- **Node.js 20+**
- **Docker & Docker Compose**
- **Tesseract OCR** (for local image processing)

### 2. Infrastructure Setup

Spin up the PostgreSQL database and backend processing services:

```bash
# Clone and navigate
cd "vibecode project 1"

# Set up environment
cp .env.example .env
# Fill in your GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env

# Launch services
docker-compose up -d
```

### 3. Backend & Database Seeding

Ensure the database is ready with program templates:

```bash
cd backend
pip install -r requirements.txt
python main.py
```

*The server will auto-seed `Computer Science & Engineering` and `Electrical & Computer Engineering` programs on first run.*

### 4. Frontend Dashboard

Run the Next.js web application:

```bash
cd frontend
npm install
npm run dev
```

*Access the dashboard at [http://localhost:3000](http://localhost:3000)*

### 5. CLI Usage

Authenticate and run audits from your terminal:

```bash
# Install CLI dependencies (REQUIRED)
pip install -r cli/requirements.txt

# Login
python audit_tool.py login

# Upload a scan or CSV
python audit_tool.py upload ./my_transcript.png --program-id <id>

# View history
python audit_tool.py history
```

---

## 🏗️ Architecture & Features

### 🔹 Unified Backend (FastAPI)

- **Async Processing**: Handles 20+ concurrent users with SQLAlchemy 2.0 (Async) and Uvicorn workers.
- **RESTful API**: Clean, paginated endpoints for history, audits, and authentication.
- **OCR Engine**: Sophisticated Tesseract + OpenCV pipeline to parse scanned transcripts.

### 🔹 Premium Frontend (Next.js)

- **Rich UI**: Modern, high-end dashboard with glassmorphism and framer-motion.
- **Auth Flow**: Secure Google OAuth2 integration.
- **Responsive**: Fully optimized for mobile and desktop usage.

### 🔹 Power CLI

- **Rich CLI**: Beautiful terminal output with tables and progress spinners.
- **Hybrid Mode**: Supports both local parsing and cloud-synced remote audits.

---

## 🧪 Testing & Quality

### Code Quality Pipeline

Run all linting and type checks:

```bash
python pipeline/code_review.py --fix
```

### Load Testing

Verify the 20-concurrent-user requirement:

```bash
locust -f tests/locustfile.py --host http://localhost:8000
```

---

## 🛠️ Configuration

All app settings are managed in `.env`. Key keys:

- `DATABASE_URL`: PostgreSQL connection string.
- `GOOGLE_CLIENT_ID`: OAuth2 credentials from Google Cloud Console.
- `SECRET_KEY`: Used for JWT session signing.

---

*Built for excellence by Antigravity AI.*

# WebQuiz — High School Learning Analytics Dashboard

Hệ thống kiểm tra trắc nghiệm trực tuyến và phân tích hiệu suất học tập cho trường THPT.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Chart.js, D3.js |
| **Backend** | Node.js 20, Express.js 4, TypeScript, Prisma ORM |
| **Database** | PostgreSQL 16, Redis 7, MinIO (S3) |
| **Real-time** | Socket.IO |
| **AI** | OpenAI GPT-4 |
| **DevOps** | Docker Compose, GitHub Actions |

## Prerequisites

- **Node.js** >= 20 LTS
- **Docker** & **Docker Compose**
- **Git**

## Quick Start

### 1. Clone & Setup

```bash
git clone <repo-url> webquiz
cd webquiz
cp .env.example .env
# Edit .env with your local credentials
```

### 2. Start Infrastructure Services

```bash
docker compose up -d
# PostgreSQL (5432), Redis (6379), MinIO (9000/9001) will start
```

### 3. Start Backend

```bash
cd server
npm install
npm run dev
# Server runs at http://localhost:3000
```

### 4. Start Frontend

```bash
cd client
npm install
npm run dev
# Client runs at http://localhost:5173
```

## Project Structure

```
webquiz/
├── client/              # React 18 + Vite + TypeScript
├── server/              # Node.js 20 + Express 4 + TypeScript
├── prisma/              # Prisma schema + migrations + seed
├── docker/              # Dockerfiles for each service
├── guideline/           # Design documents (HTML)
├── docker-compose.yml   # Dev infrastructure
├── .env.example         # Environment template
└── README.md
```

## Services & Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend | 5173 | http://localhost:5173 |
| Backend API | 3000 | http://localhost:3000 |
| PostgreSQL | 5432 | - |
| Redis | 6379 | - |
| MinIO API | 9000 | http://localhost:9000 |
| MinIO Console | 9001 | http://localhost:9001 |

## Available Scripts

### Server
- `npm run dev` — Start dev server with hot-reload
- `npm run build` — Build TypeScript
- `npm run lint` — Run ESLint

### Client
- `npm run dev` — Start Vite dev server
- `npm run build` — Build for production
- `npm run preview` — Preview production build

## License

Private — All rights reserved.

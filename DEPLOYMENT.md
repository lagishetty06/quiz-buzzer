# Quiz Buzzer Application — Deployment & User Privacy Guide

## 🔒 1. Participant Privacy Update (Hidden Team Names)
- **Host Announcement Model**: On participant screens, team names and winner identities are **completely hidden**.
- **Participant View**:
  - When a participant buzzes: Displays `BUZZER PRESSED! STANDBY FOR HOST`.
  - When another team buzzes first: Displays `BUZZER LOCKED — A TEAM HAS BUZZED IN!`.
- **Admin View**: The Admin Control Center on `/admin` remains the **only place** where team names, winner identity, and millisecond relative deltas (`+42.15ms`) are visible. The admin can look at the dashboard and announce who clicked first!

---

## 🔑 2. Admin Portal Security (Username & Password Lock)
Access to the **Admin Control Center** (`/admin`) is protected by a login authentication screen.

### Default Admin Credentials:
- **Admin Username**: `admin`
- **Admin Password**: `quizadmin123`

To customize credentials in production, set these environment variables in your deployment environment:
```env
NEXT_PUBLIC_ADMIN_USERNAME=your_custom_username
NEXT_PUBLIC_ADMIN_PASSWORD=your_custom_password
```

---

## 🚀 3. Deploying to Vercel & Cloud Host

### Step 1: Deploy Backend (Node.js + Socket.io Server)
Since Socket.io requires persistent WebSocket connections for 1,000+ real-time participants, deploy the `backend/` directory to a cloud provider like **Render**, **Railway**, or **Fly.io**:

#### Deploying on Render (Free & Fast):
1. Create a new **Web Service** on Render.com connected to your Git repository.
2. Set **Root Directory**: `backend`
3. Set **Build Command**: `npm install && npm run build`
4. Set **Start Command**: `npm run start`
5. Add Environment Variables (Optional):
   - `PORT`: `4000`
   - `REDIS_URL`: `redis://...` (Optional - fallback in-memory atomic engine is used if omitted)
6. Copy your deployed service URL (e.g. `https://quiz-buzzer-backend.onrender.com`).

---

### Step 2: Deploy Frontend to Vercel

#### Method A: Vercel Dashboard (Recommended)
1. Push your code to GitHub / GitLab.
2. Go to [Vercel Dashboard](https://vercel.com/new) and import the project repository.
3. Set **Root Directory** to `frontend`.
4. Add the following **Environment Variables**:
   - `NEXT_PUBLIC_SOCKET_URL` = `https://quiz-buzzer-backend.onrender.com` (Your backend URL)
   - `NEXT_PUBLIC_ADMIN_USERNAME` = `admin`
   - `NEXT_PUBLIC_ADMIN_PASSWORD` = `quizadmin123`
5. Click **Deploy**.

#### Method B: Vercel CLI
```bash
cd frontend
npx vercel
```
Follow the interactive prompt to complete deployment.

---

## 🧪 Local Testing Quick Commands

```bash
# Run backend server (Port 4000)
npm run dev:backend

# Run frontend server (Port 3000)
npm run dev:frontend
```

Open:
- Landing Page: `http://localhost:3000`
- Participant Portal: `http://localhost:3000/participant`
- Admin Control Dashboard: `http://localhost:3000/admin` (Username: `admin` | Password: `quizadmin123`)

# 🚀 Deployment Guide: Rashid Pharmacy — Clinic Memory OS

> **Two separate Vercel deployments:** one for the React frontend, one for the Node.js backend.  
> Total time: ~20 minutes.

## Architecture

```
Vercel (Frontend)          Vercel (Backend)          MongoDB Atlas
rashid-pharmacy            rashid-pharmacy-api        cluster: rashidpharmacy
.vercel.app          -->   .vercel.app          -->   .ntuskig.mongodb.net
(React PWA)                (Express API)              (clinic_memory_os db)
```

---

## 📋 Prerequisites

- A [Vercel](https://vercel.com) account (free tier is enough)
- Code pushed to GitHub (already done ✅)
- MongoDB Atlas cluster already running at `rashidpharmacy.ntuskig.mongodb.net`

**Your credentials (keep these secret):**
```
MONGODB_URI  = mongodb+srv://mdhaarishussain86_db_user:<password>@rashidpharmacy.ntuskig.mongodb.net/clinic_memory_os?appName=Rashidpharmacy
API_KEY      = clinic_secret_key_2026_RashidPharmacy_saood_medical
```

---

## Step 1 — Allow Vercel IPs in MongoDB Atlas

Vercel serverless functions use dynamic IPs. You need to whitelist all IPs.

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Select your project → **Network Access** (left sidebar)
3. Click **"Add IP Address"**
4. Click **"Allow Access from Anywhere"** → this sets `0.0.0.0/0`
5. Click **Confirm**

> ⚠️ This is safe for production — your API key still protects the backend.

---

## Step 2 — Deploy the Backend to Vercel

The backend is the Express API that connects to MongoDB Atlas.

### 2a. Go to Vercel and create a new project

1. Log in to [vercel.com](https://vercel.com)
2. Click **"Add New…"** → **"Project"**
3. Find and import your GitHub repo: **`Rashid-Pharmacy`**

### 2b. Configure the backend project settings

On the "Configure Project" screen:

| Setting | Value |
|---|---|
| **Project Name** | `rashid-pharmacy-api` |
| **Root Directory** | `clinic-memory-os/backend` ← click "Edit" to set this |
| **Framework Preset** | `Other` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

> **Root Directory is critical.** Click "Edit" next to Root Directory and type `clinic-memory-os/backend`.

### 2c. Add environment variables

Scroll down to **"Environment Variables"** and add these one by one:

| Name | Value |
|---|---|
| `MONGODB_URI` | `mongodb+srv://mdhaarishussain86_db_user:n2Y81F8qsIKnMmjZ@rashidpharmacy.ntuskig.mongodb.net/clinic_memory_os?appName=Rashidpharmacy` |
| `API_KEY` | `clinic_secret_key_2026_RashidPharmacy_saood_medical` |
| `CORS_ORIGIN` | `https://rashid-pharmacy.vercel.app` |
| `NODE_ENV` | `production` |

### 2d. Deploy

Click **"Deploy"**. Wait ~1 minute for it to build.

When done, you'll get a URL like:
```
https://rashid-pharmacy-api.vercel.app
```

### 2e. Verify the backend is working

Open this URL in your browser (replace with your actual URL):
```
https://rashid-pharmacy-api.vercel.app/api/health
```

You should see:
```json
{ "status": "ok", "timestamp": "2026-03-13T..." }
```

If you see this, the backend is live and MongoDB is connected. ✅

---

## Step 3 — Update Frontend with Backend URL

Now that you have the actual backend URL, update the frontend environment file.

Open `clinic-memory-os/.env.production` and update:
```env
VITE_API_URL=https://rashid-pharmacy-api.vercel.app/api
VITE_API_KEY=clinic_secret_key_2026_RashidPharmacy_saood_medical
```

> Replace `rashid-pharmacy-api` with your actual Vercel backend project name if different.

Commit and push:
```bash
cd "C:\Users\mdhaa\Desktop\Rashid Pharmacy\clinic-memory-os"
git add .env.production
git commit -m "Set production backend URL"
git push
```

---

## Step 4 — Deploy the Frontend to Vercel

### 4a. Create another new Vercel project

1. Click **"Add New…"** → **"Project"** again
2. Import the **same** GitHub repo: **`Rashid-Pharmacy`**

### 4b. Configure the frontend project settings

| Setting | Value |
|---|---|
| **Project Name** | `rashid-pharmacy` |
| **Root Directory** | `clinic-memory-os` ← click "Edit" to set this |
| **Framework Preset** | `Vite` (auto-detected) |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### 4c. Add environment variables

| Name | Value |
|---|---|
| `VITE_API_URL` | `https://rashid-pharmacy-api.vercel.app/api` |
| `VITE_API_KEY` | `clinic_secret_key_2026_RashidPharmacy_saood_medical` |

### 4d. Deploy

Click **"Deploy"**. When done, your frontend is live at:
```
https://rashid-pharmacy.vercel.app
```

---

## Step 5 — Update Backend CORS with Final Frontend URL

If your frontend URL is different from `rashid-pharmacy.vercel.app`:

1. Go to Vercel → your backend project (`rashid-pharmacy-api`)
2. **Settings** → **Environment Variables**
3. Edit `CORS_ORIGIN` to match your actual frontend URL
4. Click **Save**
5. Go to **Deployments** → click the three dots on latest → **"Redeploy"**

---

## ✅ Final Verification Checklist

Run these checks after deployment:

### 1. Backend health check
```
GET https://rashid-pharmacy-api.vercel.app/api/health
```
Expected: `{ "status": "ok" }`

### 2. Backend auth check (should be rejected without key)
```
GET https://rashid-pharmacy-api.vercel.app/api/patients
```
Expected: `{ "error": "API key is required" }` (401 status)

### 3. Patient list with auth (PowerShell)
```powershell
Invoke-RestMethod `
  -Uri "https://rashid-pharmacy-api.vercel.app/api/patients" `
  -Headers @{ "X-API-Key" = "clinic_secret_key_2026_RashidPharmacy_saood_medical"; "X-Device-ID" = "test-device-001" }
```
Expected: `[]` (empty array, or list of patients)

### 4. Frontend app
Visit `https://rashid-pharmacy.vercel.app` — app should load, show the clinic UI.

### 5. Multi-device sync test
1. Open app on laptop → add a new patient
2. Wait 30 seconds (background sync runs every 30s)
3. Open app on phone → the patient should appear

---

## 🔄 How Sync Works

```
Phone       ←──────────────────────────────→  MongoDB Atlas
Laptop      ←──→  Backend API (Vercel)  ←──→  (cloud database)
Tablet      ←──────────────────────────────→
```

- **Every 30 seconds** when online: frontend pushes changes, then pulls server changes
- **Conflict resolution**: last-write-wins (whoever saved last keeps their data)
- **Offline**: app works fully from local IndexedDB, syncs when back online
- **Device ID**: auto-generated per browser, stored in localStorage

---

## 🔁 Future Redeployments

After any code change:
```bash
git add .
git commit -m "Your change description"
git push
```

Vercel auto-deploys both projects on every push to `main`. No manual steps needed.

---

## 🚨 Troubleshooting

### "Build failed" on backend
- Check **Root Directory** is set to `clinic-memory-os/backend` (not `backend`)
- Check that `backend/vercel.json` exists in the repo

### "Application error" on backend URL
- Go to Vercel → backend project → **Functions** tab → click the function → view logs
- Most common cause: `MONGODB_URI` env variable missing or wrong

### "API key is invalid" (403)
- `VITE_API_KEY` in frontend does not match `API_KEY` in backend
- Both must be: `clinic_secret_key_2026_RashidPharmacy_saood_medical`

### Patients not syncing between devices
1. Open browser DevTools → **Console** tab
2. Look for sync errors (red messages)
3. Check `VITE_API_URL` points to the correct backend URL
4. Verify backend health endpoint responds

### MongoDB "connection refused" or timeout
- Go to MongoDB Atlas → **Network Access** → confirm `0.0.0.0/0` is listed
- Verify the `MONGODB_URI` is exactly as shown above (no typos)
- Make sure the database user password is correct in the URI

### CORS error in browser console
```
Access to fetch at 'https://...' from origin 'https://...' has been blocked by CORS
```
- Go to backend Vercel project → **Settings** → **Environment Variables**
- Update `CORS_ORIGIN` to your exact frontend URL
- Redeploy backend

---

## 📦 Files Reference

```
clinic-memory-os/
├── vercel.json               ← Frontend Vercel config
├── .env.production           ← Frontend production env vars
├── backend/
│   ├── vercel.json           ← Backend Vercel config (routes Express)
│   ├── .env                  ← Backend local dev env vars (not deployed)
│   ├── .env.example          ← Template for env vars
│   └── src/
│       ├── server.ts         ← Express entry point
│       ├── db/mongodb.ts     ← MongoDB connection
│       ├── middleware/auth.ts← API key validation
│       └── routes/
│           ├── patients.ts
│           ├── visits.ts
│           └── sync.ts       ← Push/pull sync endpoints
└── src/
    └── services/
        └── syncService.ts    ← Frontend sync logic
```


1. **MongoDB Atlas Account** — with a cluster created
2. **GitHub Account** — to push code
3. **Vercel Account** — free tier works fine
4. **Environment Variables**:
   - `MONGODB_URI`: Your MongoDB connection string
   - `API_KEY`: Clinic secret key
   - `CORS_ORIGIN`: Frontend URL (for local dev + production)

---

## 🛠️ Local Development

### Start Backend
```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:3000
```

### Start Frontend (in new terminal)
```bash
cd .
npm install
npm run dev
# Runs on http://localhost:5174
```

The frontend will auto-sync with MongoDB Atlas when online.

---

## 🌐 Deploy to Vercel

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Add MongoDB sync backend"
git push origin main
```

### Step 2: Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New" → "Project"**
3. Select your GitHub repo
4. **Root Directory**: Leave blank (monorepo at root)
5. **Framework**: Vite (auto-detected)
6. Click **"Environment Variables"** and add:
   ```
   MONGODB_URI = mongodb+srv://...
   API_KEY = clinic_secret_key_2026_RashidPharmacy_saood_medical
   CORS_ORIGIN = https://yourdomain.vercel.app
   NODE_ENV = production
   ```
7. Click **Deploy** ✅

### Step 3: Backend Deployment

The backend needs a separate Vercel deployment to handle Node.js:

1. In Vercel dashboard, click **"Add New" → "Project"**
2. Select the **same** GitHub repo
3. **Root Directory**: `backend`
4. **Framework**: Other
5. **Build Command**: `npm run build`
6. **Output Directory**: `dist`
7. Add same **Environment Variables**
8. Deploy ✅

**You'll get a backend URL like**: `https://clinic-memory-backend.vercel.app`

### Step 4: Update Frontend Env

Update `.env.production`:
```env
VITE_API_URL=https://clinic-memory-backend.vercel.app/api
VITE_API_KEY=clinic_secret_key_2026_RashidPharmacy_saood_medical
```

Push again:
```bash
git add .env.production
git commit -m "Update backend URL"
git push origin main
```

---

## ✅ Verify Deployment

### Backend Health Check
```bash
curl https://clinic-memory-backend.vercel.app/api/health
```
Should return:
```json
{ "status": "ok", "timestamp": "2026-03-13T..." }
```

### Frontend App
Visit the frontend Vercel URL. The app will:
1. Load locally from IndexedDB
2. Auto-sync with MongoDB Atlas every 30 seconds
3. Show "Syncing..." indicator when pushing/pulling

---

## 🔄 How Sync Works

```
Phone (IndexedDB) ←→ Node.js Backend (Vercel)  ←→ MongoDB Atlas
Laptop (IndexedDB) ←---────────────────────────────────────┘
Tablet (IndexedDB) ←---────────────────────────────────────┘
```

**Real-time sync**:
- **Pull**: Backend sends changed records (updated since last sync)
- **Push**: Frontend sends new/modified records from IndexedDB
- **Conflict resolution**: Last-write-wins (timestamp-based)

---

## 📦 Directory Structure

```
clinic-memory-os/
├── backend/                    # Node.js Express API
│   ├── src/
│   │   ├── server.ts          # Express app
│   │   ├── db/
│   │   │   └── mongodb.ts     # MongoDB connection
│   │   ├── routes/
│   │   │   ├── patients.ts
│   │   │   ├── visits.ts
│   │   │   └── sync.ts
│   │   └── middleware/
│   │       └── auth.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
├── src/                       # React frontend
│   ├── services/
│   │   └── syncService.ts     # MongoDB sync logic
│   ├── components/
│   ├── db/
│   └── ...
├── package.json
├── vite.config.ts
├── .env.production
└── vercel.json
```

---

## 🚨 Troubleshooting

### Sync isn't working
1. Check backend is running: `curl https://yourbackend.vercel.app/api/health`
2. Check API key in frontend `.env.production`
3. Check MongoDB URI in backend `.env`
4. Check browser console for errors

### "API key is invalid"
- Make sure `VITE_API_KEY` in frontend matches `API_KEY` in backend

### MongoDB connection fails
- Test in local: `npm run dev` in backend folder
- Verify MongoDB URI includes `appName=Rashidpharmacy`
- Add your IP to MongoDB Atlas whitelist (go to Network Access)

### Data not syncing
- Check if online: `navigator.onLine` in browser console
- Manual sync: Wait 30 seconds or refresh
- Check `X-Device-ID` header is being sent

---

## 🔒 Security Notes

- **API Key** is needed for all requests (passed in `X-API-Key` header)
- **Device ID** Generated per browser/device automatically
- **MongoDB** credentials never exposed to frontend
- **CORS** restricted to your Vercel domain

---

## 📝 First Time Setup Summary

1. Create MongoDB Atlas cluster
2. Get connection string
3. Push code to GitHub
4. Deploy frontend to Vercel (build auto-detects Vite)
5. Deploy backend to separate Vercel project
6. Update `.env.production` with backend URL
7. Test sync at https://yourfrontend.vercel.app

**That's it!** Your clinic app now syncs across all devices. 🎉


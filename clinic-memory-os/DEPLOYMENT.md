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

**Your credentials (keep these secret — never commit to git):**
```
MONGODB_URI  = mongodb+srv://<username>:<password>@rashidpharmacy.ntuskig.mongodb.net/clinic_memory_os?appName=Rashidpharmacy
API_KEY      = <your-secure-api-key>
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
| `MONGODB_URI` | Your MongoDB Atlas connection string (from Atlas → Connect → Drivers) |
| `API_KEY` | A strong random API key (e.g. generate with `openssl rand -hex 32`) |
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

Now that you have the actual backend URL, set the frontend environment variables in Vercel.

> ⚠️ **Never commit `.env.production` to git** — it contains secrets. Set these in Vercel Dashboard instead.

When configuring the frontend project in Step 4, add this environment variable in Vercel:
- `VITE_API_URL` = `https://rashid-pharmacy-api.vercel.app/api`

> 🔐 **Do not set `VITE_API_KEY`.** Every `VITE_*` value is compiled into the public JavaScript, so anyone could read it. Each device is paired with the key once instead (see Step 6).

> Replace `rashid-pharmacy-api` with your actual Vercel backend project name if different.

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
  -Headers @{ "X-API-Key" = "<your-api-key>"; "X-Device-ID" = "test-device-001" }
```
Expected: `[]` (empty array, or list of patients)

### 4. Frontend app
Visit `https://rashid-pharmacy.vercel.app` — app should load, show the clinic UI.

### 5. Multi-device sync test
1. Pair both devices (Step 6)
2. Open app on laptop → add a new patient
3. Wait 30 seconds (background sync runs every 30s)
4. Open app on phone → the patient should appear

---

## Step 6 — Pair each device

Do this once on every phone, tablet, or laptop that should sync:

- **Option A:** open `https://rashid-pharmacy.vercel.app/?pair=<API_KEY>`. The app stores the key and removes it from the address bar.
- **Option B:** open the app, tap **Connect cloud** in the header, and paste the key.

The header then shows "Synced just now". Unpaired devices keep working fully offline.

---

## ⬆️ Upgrading from sync v1 (before October 2026)

The old sync sent every record on every cycle and stopped working at about 5,000 visits. It also matched records by each device's local number, so two devices could overwrite each other, and the API key was readable inside the website code. Sync v2 fixes all three. Upgrade in this order:

1. **Deploy the backend first.** It adds `/api/v2/sync` and new `patients_v2` / `visits_v2` collections. The old `/api/sync` and the old collections are left untouched as an archive.
2. **Rotate the key.** The old `API_KEY` was public, so generate a new one (`openssl rand -hex 32`) and set it on the backend. Redeploy the backend.
3. **Remove `VITE_API_KEY`** from the frontend project's environment variables, then deploy the frontend.
4. **On each device, open the app once while online.** The local database upgrades itself (no data is lost), then pair the device (Step 6). Its full history uploads in batches of 200.
5. **Take a backup** from the header on the main clinic device as a safety copy.

Every device that holds records should be opened and paired once, so anything it has that never reached the cloud gets uploaded.

---

## 🔄 How Sync Works

```
Phone       ←──────────────────────────────→  MongoDB Atlas
Laptop      ←──→  Backend API (Vercel)  ←──→  (cloud database)
Tablet      ←──────────────────────────────→
```

- **Every 30 seconds** when online (and on reconnect): the device uploads only the records changed since the last sync, in batches of 200, then downloads what other devices changed. A server-side cursor means nothing is fetched twice.
- **Identity**: every record has a permanent `uid`, so devices never collide
- **Conflict resolution**: last-write-wins on the time the record was *edited* (device clock), not when it reached the server
- **Deletes**: synced as tombstones, so a deleted patient does not reappear
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

### "Sync key rejected — reconnect this device" (401/403)
- The key this device was paired with does not match `API_KEY` on the backend (for example, after rotating the key)
- Tap the sync status in the header and paste the current key

### Patients not syncing between devices
1. Open browser DevTools → **Console** tab
2. Look for sync errors (red messages)
3. Check `VITE_API_URL` points to the correct backend URL
4. Verify backend health endpoint responds

### MongoDB "connection refused" or timeout
- Go to MongoDB Atlas → **Network Access** → confirm `0.0.0.0/0` is listed
- Verify the `MONGODB_URI` is exactly as shown above (no typos)
- Make sure the database user password is correct in the URI

### Backend shows "This Serverless Function has crashed"
- This usually means the deployed backend was still using `app.listen()` instead of exporting the Express app for Vercel serverless
- Pull the latest code and redeploy the backend project
- Then re-check `/api/health`

### Health check works but API routes fail
- Confirm `API_KEY` exists in backend environment variables
- Confirm the frontend is sending both `X-API-Key` and `X-Device-ID`
- Test the route directly with PowerShell using the example above

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


# 🚀 Deployment Guide: Clinic Memory OS

This is a **monorepo** with:
- **Frontend**: React 18 + Vite (static, deployed to Vercel)
- **Backend**: Node.js + Express + MongoDB (serverless, deployed to Vercel)

---

## 📋 Prerequisites

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


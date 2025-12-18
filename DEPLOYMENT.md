# LatticeIQ Deployment Guide

## Architecture

```
latticeiq/
├── frontend/          → React + Vite (Vercel)
│   ├── src/
│   ├── package.json
│   └── .env.local
├── backend/           → FastAPI + Python (Render)
│   ├── main.py
│   ├── requirements.txt
│   └── .env
├── vercel.json        → Vercel config
└── render.yaml        → Render config
```

## Frontend (Vercel)

### Deploy
```bash
cd ~/projects/latticeiq
git add -A && git commit -m "your message"
git push origin main  # Auto-deploys to Vercel
```

### Local Development
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

### Environment Variables (Vercel Dashboard)
```
VITE_API_URL=https://latticeiq-backend.onrender.com
```

## Backend (Render)

### Deploy
1. Go to [render.com/dashboard](https://render.com/dashboard)
2. Click "New +" → "Web Service"
3. Connect GitHub repository `quatrorabes/latticeiq`
4. Configure:
   - **Name:** `latticeiq-backend`
   - **Environment:** Python 3
   - **Build Command:** `cd backend && pip install -r requirements.txt`
   - **Start Command:** `cd backend && python main.py`
   - **Root Directory:** Leave blank (Render auto-detects via render.yaml)
5. Add environment variables:
   - `DATABASE_URL` → Railway PostgreSQL connection string
   - `OPENAI_API_KEY` → Your OpenAI key
   - `PERPLEXITY_API_KEY` → Your Perplexity key
   - `PORT` → 10000

### Local Development
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # or: venv\Scripts\activate on Windows
pip install -r requirements.txt
python main.py
# Runs on http://localhost:10000
# API Docs: http://localhost:10000/docs
```

### Test Backend Health
```bash
curl http://localhost:10000/health
```

## Database (Railway)

Connection string format:
```
postgresql://user:password@host:port/dbname
```

Example in `backend/.env`:
```
DATABASE_URL=postgresql://postgres:mypassword@db.railway.internal:5432/latticeiq
```

## One-Button Deploy Workflow

```bash
# Make changes locally
cd ~/projects/latticeiq
git add -A
git commit -m "feat: add contacts endpoint"
git push origin main

# Frontend auto-deploys to Vercel
# Backend auto-deploys to Render (if using render.yaml + git auto-deploy)
```

## Monitoring

- **Frontend (Vercel):** https://latticeiq-jxzawn8l0-quatrorabes-projects.vercel.app
- **Backend (Render):** https://latticeiq-backend.onrender.com
- **Backend Health:** https://latticeiq-backend.onrender.com/health
- **API Docs:** https://latticeiq-backend.onrender.com/docs

## Troubleshooting

### Frontend not updating after push?
- Check Vercel dashboard: https://vercel.com/quatrorabes-projects/latticeiq
- Manually trigger redeploy if needed

### Backend returning 404?
- Check that render.yaml exists at repo root
- Verify environment variables in Render dashboard
- Check Render logs: Dashboard → latticeiq-backend → Logs

### Database connection failing?
- Verify DATABASE_URL is set in Render env vars
- Test connection: `psql <DATABASE_URL>`

---

Created: December 17, 2025

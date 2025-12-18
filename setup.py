#!/usr/bin/env python3
"""
LatticeIQ Monorepo Setup Script
Restructures frontend/backend, creates configs, commits to git
Run once: python3 setup.py
"""

import os
import sys
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).parent
FRONTEND = REPO_ROOT / "frontend"
BACKEND = REPO_ROOT / "backend"


def run_cmd(cmd, cwd=None, check=True):
    """Run shell command"""
    print(f"  → {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    if check and result.returncode != 0:
        print(f"❌ Error: {result.stderr}")
        sys.exit(1)
    return result.stdout.strip()


def ensure_dir(path):
    """Create directory if it doesn't exist"""
    path.mkdir(parents=True, exist_ok=True)
    return path


def write_file(path, content):
    """Write file"""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    print(f"✅ Created {path.relative_to(REPO_ROOT)}")


def main():
    print("\n" + "=" * 60)
    print("🚀 LatticeIQ MONOREPO SETUP")
    print("=" * 60 + "\n")

    # ===== STEP 1: Create backend structure =====
    print("📦 Step 1: Setting up backend/\n")
    ensure_dir(BACKEND)

    # Backend requirements.txt
    write_file(
        BACKEND / "requirements.txt",
        """fastapi==0.104.1
uvicorn==0.24.0
python-dotenv==1.0.0
sqlalchemy==2.0.23
psycopg2-binary==2.9.9
pydantic==2.5.0
requests==2.31.0
openai==1.3.0
perplexity-sdk==0.1.0
""",
    )

    # Backend main.py
    write_file(
        BACKEND / "main.py",
        """from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="LatticeIQ Backend", version="1.0.0")

# CORS - allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok", "service": "latticeiq-backend"}

@app.get("/api/v2/contacts")
async def get_contacts(limit: int = 20):
    # TODO: Connect to PostgreSQL
    return {"contacts": []}

@app.get("/api/v2/contacts/{contact_id}")
async def get_contact(contact_id: str):
    # TODO: Fetch from DB
    return {"contact": None}

@app.post("/api/contacts/{contact_id}/enrich")
async def enrich_contact(contact_id: str):
    # TODO: Trigger enrichment
    return {"status": "enriching"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)
""",
    )

    # Backend .env.example
    write_file(
        BACKEND / ".env.example",
        """DATABASE_URL=postgresql://user:password@localhost:5432/latticeiq
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...
PORT=10000
""",
    )

    # Backend .env (local, git-ignored)
    write_file(
        BACKEND / ".env",
        """DATABASE_URL=postgresql://localhost/latticeiq
OPENAI_API_KEY=
PERPLEXITY_API_KEY=
PORT=10000
""",
    )

    # Backend runtime.txt (Render)
    write_file(BACKEND / "runtime.txt", "python-3.11.7\n")

    # Backend Procfile (Render)
    write_file(BACKEND / "Procfile", "web: python main.py\n")

    # Backend .gitignore
    write_file(
        BACKEND / ".gitignore",
        """__pycache__/
*.py[cod]
*$py.class
*.so
.env
.venv
venv/
env/
.DS_Store
*.egg-info/
dist/
build/
""",
    )

    # ===== STEP 2: Update frontend =====
    print("\n📦 Step 2: Updating frontend/\n")

    # Frontend .env.local
    write_file(
        FRONTEND / ".env.local",
        """VITE_API_URL=https://latticeiq-backend.onrender.com
""",
    )

    # Update App.tsx to use env var
    app_tsx = FRONTEND / "src" / "App.tsx"
    if app_tsx.exists():
        content = app_tsx.read_text()
        # Replace API_URL constant
        content = content.replace(
            "const API_URL = 'https://arcmetric.onrender.com'",
            "const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000'",
        )
        app_tsx.write_text(content)
        print(f"✅ Updated {app_tsx.relative_to(REPO_ROOT)}")

    # ===== STEP 3: Create root-level deployment configs =====
    print("\n📦 Step 3: Creating deployment configs\n")

    # vercel.json (Vercel frontend deployment)
    write_file(
        REPO_ROOT / "vercel.json",
        """{
  "buildCommand": "cd frontend && npm run build",
  "installCommand": "cd frontend && npm install",
  "outputDirectory": "frontend/dist"
}
""",
    )

    # render.yaml (Render backend deployment)
    write_file(
        REPO_ROOT / "render.yaml",
        """services:
  - type: web
    name: latticeiq-backend
    env: python
    plan: free
    buildCommand: "cd backend && pip install -r requirements.txt"
    startCommand: "cd backend && python main.py"
    rootDir: backend
    envVars:
      - key: DATABASE_URL
        scope: build
      - key: OPENAI_API_KEY
        scope: build
      - key: PERPLEXITY_API_KEY
        scope: build
      - key: PORT
        value: 10000
""",
    )

    # .gitignore (root)
    gitignore_path = REPO_ROOT / ".gitignore"
    if gitignore_path.exists():
        content = gitignore_path.read_text()
        if ".env" not in content:
            content += "\n.env\nnode_modules/\n__pycache__/\n"
            gitignore_path.write_text(content)
    else:
        write_file(
            gitignore_path,
            """.env
.env.local
node_modules/
__pycache__/
*.pyc
.DS_Store
dist/
build/
""",
        )

    # ===== STEP 4: Create DEPLOYMENT.md guide =====
    print("\n📦 Step 4: Creating deployment guide\n")

    write_file(
        REPO_ROOT / "DEPLOYMENT.md",
        """# LatticeIQ Deployment Guide

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
source venv/bin/activate  # or: venv\\Scripts\\activate on Windows
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
""",
    )

    # ===== STEP 5: Git commit =====
    print("\n📦 Step 5: Git commit & push\n")

    os.chdir(REPO_ROOT)

    # Check git status
    status = run_cmd("git status --porcelain", check=False)
    if status:
        run_cmd("git add -A")
        run_cmd(
            'git commit -m "refactor: monorepo structure - frontend + backend subfolders"'
        )
        run_cmd("git push origin main")
        print(
            "✅ Committed and pushed to GitHub. Vercel auto-deploying frontend now...\n"
        )
    else:
        print("⏭️  No changes to commit\n")

    # ===== STEP 6: Summary =====
    print("=" * 60)
    print("✨ SETUP COMPLETE!")
    print("=" * 60 + "\n")

    print("📋 WHAT'S BEEN DONE:")
    print("  ✅ backend/ folder created with FastAPI skeleton")
    print("  ✅ frontend/ folder configured with env vars")
    print("  ✅ vercel.json created (Vercel auto-deploy frontend)")
    print("  ✅ render.yaml created (Render auto-deploy backend)")
    print("  ✅ .env files created (.gitignored)")
    print("  ✅ Git commit & push done")
    print("  ✅ DEPLOYMENT.md guide created\n")

    print("🚀 NEXT STEPS:")
    print("  1. Frontend auto-deploying now on Vercel")
    print("  2. Go to https://render.com/dashboard")
    print("  3. Create new Web Service from latticeiq repo")
    print("  4. Render will auto-detect render.yaml")
    print("  5. Add DATABASE_URL + API keys to Render env vars\n")

    print("🔗 URLS:")
    print("  Frontend: https://latticeiq-jxzawn8l0-quatrorabes-projects.vercel.app")
    print("  Backend:  https://latticeiq-backend.onrender.com (coming soon)")
    print("  API Docs: https://latticeiq-backend.onrender.com/docs\n")

    print("💡 LOCAL DEVELOPMENT:")
    print("  Frontend: cd frontend && npm run dev")
    print("  Backend:  cd backend && python main.py\n")

    print("=" * 60)
    print("Ready to ship! 🎉\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

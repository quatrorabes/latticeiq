# LATTICEIQ FRONTEND - VERCEL DEPLOYMENT GUIDE

## 🚀 DEPLOY TO VERCEL IN 5 MINUTES

As your lead engineer, here's the fastest path to production on Vercel.

---

## STEP 1: PREPARE YOUR REPOSITORY

### 1.1 Create GitHub Repository
```bash
# Initialize git in your latticeiq-frontend folder
cd latticeiq-frontend
git init
git add .
git commit -m "Initial commit: LatticeIQ frontend with React + Tailwind"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/latticeiq-frontend.git
git branch -M main
git push -u origin main
```

### 1.2 Add Vercel Configuration File

Create `vercel.json` in project root:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "env": {
    "VITE_API_BASE_URL": "@vite-api-base-url",
    "VITE_API_VERSION": "@vite-api-version"
  },
  "functions": {
    "api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 60
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "${VITE_API_BASE_URL}/api/$1"
    }
  ]
}
```

### 1.3 Update package.json Scripts

Ensure your package.json has these scripts:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "type-check": "tsc --noEmit",
    "lint": "eslint src --ext ts,tsx"
  }
}
```

---

## STEP 2: CONNECT VERCEL ACCOUNT

### 2.1 Sign Up / Login
- Go to [Vercel](https://vercel.com)
- Sign up with GitHub account (recommended for seamless integration)
- Click "Create Team" or use personal account

### 2.2 Install Vercel CLI (Optional but Recommended)
```bash
npm install -g vercel
```

---

## STEP 3: DEPLOY TO VERCEL

### Option A: Via Web Dashboard (Easiest)

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com/dashboard

2. **Click "Add New" → "Project"**

3. **Import GitHub Repository**
   - Select your `latticeiq-frontend` repository
   - Click "Import"

4. **Configure Project**
   - **Project Name**: `latticeiq-frontend` (or custom name)
   - **Framework Preset**: Vite (auto-detected)
   - **Root Directory**: `./` (if monorepo, specify subfolder)

5. **Environment Variables**
   - Click "Environment Variables"
   - Add these three sets of variables:
   
   **Development** (optional, for preview deployments):
   ```
   VITE_API_BASE_URL = https://api-dev.yourcompany.com
   VITE_API_VERSION = v2
   NODE_ENV = development
   ```
   
   **Preview** (staging/test deployments):
   ```
   VITE_API_BASE_URL = https://api-staging.yourcompany.com
   VITE_API_VERSION = v2
   NODE_ENV = preview
   ```
   
   **Production**:
   ```
   VITE_API_BASE_URL = https://api.yourcompany.com
   VITE_API_VERSION = v2
   NODE_ENV = production
   ```

6. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes for build to complete
   - Vercel shows live URL: `https://latticeiq-frontend.vercel.app`

---

### Option B: Via CLI (Fastest for Developers)

```bash
# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Or deploy to preview (for testing)
vercel
```

Answer prompts:
```
? Set up and deploy "~/latticeiq-frontend"? (Y/n) y
? Which scope do you want to deploy to? (select your account)
? Link to existing project? (y/N) n (first time only)
? What's your project's name? latticeiq-frontend
? In which directory is your code? ./ 
? Want to override the settings above? (y/N) n
? 🔗 Linked to your-username/latticeiq-frontend
? 🔨 Building…
? ✅ Production: https://latticeiq-frontend.vercel.app
```

---

## STEP 4: CONFIGURE ENVIRONMENT VARIABLES FOR EACH STAGE

### Via Vercel Dashboard:

1. **Settings tab** → **Environment Variables**

2. **Add variables for each environment:**

   | Variable | Development | Preview | Production |
   |----------|-------------|---------|------------|
   | `VITE_API_BASE_URL` | `http://localhost:8000` | `https://staging-api.yourcompany.com` | `https://api.yourcompany.com` |
   | `VITE_API_VERSION` | `v2` | `v2` | `v2` |

3. **Click "Save"** and redeploy

### Via CLI:

```bash
# Set production environment variable
vercel env add VITE_API_BASE_URL
# Paste: https://api.yourcompany.com

vercel env add VITE_API_VERSION
# Paste: v2

# Deploy production with new vars
vercel --prod
```

---

## STEP 5: SETUP AUTOMATIC DEPLOYMENTS

### GitHub Integration (Auto-Deploy on Push)

1. **Vercel → Project Settings → Git**

2. **Production Branch**
   - Set to `main` (auto-deploy when code pushed)
   - ✅ "Automatically deploy when code is pushed to production branch"

3. **Preview Deployments**
   - ✅ "Preview deployment for pull requests"
   - All PRs get preview URLs automatically

4. **Ignored Build Step**
   - If needed, add: `git diff --quiet HEAD^ HEAD -- packages/frontend/` (for monorepo)

### Result:
```
When you: git push origin main
↓
GitHub triggers Vercel webhook
↓
Vercel rebuilds & deploys to production
↓
✅ Live at https://latticeiq-frontend.vercel.app
```

---

## STEP 6: CONFIGURE CUSTOM DOMAIN (Optional)

### Add Your Domain

1. **Vercel → Project Settings → Domains**

2. **Add Domain**
   - Enter your domain: `latticeiq.yourcompany.com`
   - Click "Add"

3. **Update DNS Records** (at your registrar)
   - Vercel shows required DNS records
   - Add CNAME or A records as instructed

4. **Verify**
   - Wait 5-10 minutes for DNS propagation
   - Visit `https://latticeiq.yourcompany.com`

---

## STEP 7: SETUP MONITORING & ANALYTICS

### Enable Vercel Analytics

1. **Settings → Analytics**
   - ✅ "Enable Web Analytics"
   - View performance metrics in dashboard

### Add Error Tracking (Sentry)

Create `.env.local` (for local testing):
```
VITE_SENTRY_DSN=https://YOUR_SENTRY_KEY@sentry.io/YOUR_PROJECT_ID
```

In `src/main.tsx`, initialize Sentry:
```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

---

## STEP 8: VERIFY DEPLOYMENT

### Health Checks

```bash
# Check if site is live
curl https://latticeiq-frontend.vercel.app

# Should return HTML (not error)
```

### Functionality Testing

- [ ] Login page loads
- [ ] Can authenticate with backend
- [ ] Contact list loads
- [ ] Contact detail renders
- [ ] Enrichment triggers (check console for API calls)
- [ ] No TypeScript errors (check Vercel logs)

### Performance Check

- [ ] Vercel Analytics shows page load time
- [ ] Lighthouse score > 90
- [ ] No console errors
- [ ] Bundle size reasonable

---

## STEP 9: SETUP MONITORING & ROLLBACKS

### View Deployment Logs

```bash
vercel logs --tail
```

### Rollback to Previous Deployment

```bash
# List deployments
vercel list

# Rollback to previous version
vercel rollback
```

Or via dashboard:
1. **Vercel → Project → Deployments**
2. **Find previous successful deployment**
3. **Click → "Promote to Production"**

---

## STEP 10: CI/CD PIPELINE (GitHub Actions)

### Optional: Add GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Vercel

on:
  push:
    branches:
      - main
      - develop

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Type check
        run: npm run type-check
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Vercel
        uses: vercel/actions/deploy-production@main
        if: github.ref == 'refs/heads/main'
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

Setup secrets in GitHub:
1. **GitHub → Settings → Secrets and variables → Actions**
2. Add:
   - `VERCEL_TOKEN` (from Vercel Settings → Tokens)
   - `VERCEL_ORG_ID` (from Vercel Settings)
   - `VERCEL_PROJECT_ID` (from `.vercel/project.json`)

---

## TROUBLESHOOTING

### Build Fails: "npm ERR!"

**Solution**: Check Node version
```bash
# Vercel default is Node 18
# Ensure your package.json supports it:
{
  "engines": {
    "node": "18.x || 20.x"
  }
}
```

### Env Variables Not Loading

**Solution**: Restart deployment
1. **Vercel → Deployments**
2. Click "Redeploy"
3. Select "Redeploy" (forces fresh build with new vars)

### API Calls Return CORS Error

**Solution**: Check backend CORS configuration
```
Your backend must allow:
- Origin: https://latticeiq-frontend.vercel.app
- Methods: GET, POST, PUT, DELETE
- Headers: Content-Type, Authorization
```

### Site Shows 404 on Subpaths

**Solution**: Add `vercel.json` rewrite:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Environment Variables Not Updating

**Solution**: Redeploy after adding variables
```bash
vercel --prod --force
```

---

## QUICK REFERENCE: COMMANDS

```bash
# Login
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod

# View logs
vercel logs --tail

# Show project info
vercel projects

# Remove local Vercel config (fresh setup)
rm -rf .vercel/
```

---

## FINAL CHECKLIST

- [ ] Code pushed to GitHub
- [ ] GitHub repo connected to Vercel
- [ ] Environment variables configured for all 3 stages (dev, preview, prod)
- [ ] Auto-deploy enabled for `main` branch
- [ ] Custom domain configured (if applicable)
- [ ] Sentry/monitoring integrated
- [ ] Team members added to Vercel project (Settings → Team)
- [ ] Deployment preview shows correct API endpoint
- [ ] Production deployment tested end-to-end
- [ ] Rollback procedure documented

---

## YOUR PRODUCTION URL

After deployment, your LatticeIQ frontend is live at:

**Preview**: https://latticeiq-frontend.vercel.app
**Production**: https://latticeiq-frontend.vercel.app (or custom domain)
**Staging**: https://staging.latticeiq-frontend.vercel.app (if separate project)

---

## NEXT STEPS

1. **Share URL with team**: https://latticeiq-frontend.vercel.app
2. **Test login with backend**: Make sure VITE_API_BASE_URL points to correct backend
3. **Monitor performance**: Check Vercel Analytics dashboard
4. **Setup alerts**: Vercel → Settings → Integrations (add Slack/email alerts)
5. **Document for team**: Share this guide with your frontend team

---

**Congratulations! LatticeIQ is now live on Vercel! 🎉**

**All future pushes to `main` will auto-deploy. PRs get preview URLs. Simple as that.**

For questions: https://vercel.com/docs

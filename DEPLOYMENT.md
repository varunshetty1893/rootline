# Rootline deployment

## Run locally

```bash
cp .env.example .env
npm ci
npm run dev
```

Open <http://localhost:3000>. The development server uses the in-memory store
when `DATABASE_URL` is empty, so PostgreSQL is optional for a quick local
check. Data in memory is reset whenever the server restarts.

For persistent local data, set `DATABASE_URL` to a PostgreSQL connection
string. The server creates its tables on startup.

## Push to GitHub

Create an empty GitHub repository first, then run these commands from this
folder:

```bash
git add .
git commit -m "Prepare Rootline for deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Never commit `.env`. Only `.env.example` belongs in Git.

## Deploy the backend to Render

1. In Render (<https://dashboard.render.com>), click **New +** → **Blueprint** and connect your repository (Render automatically reads `render.yaml`), OR create a **Web Service** manually:
   - **Environment**: Node
   - **Build Command**: `npm install --include=dev && npm run build:server`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health` (or `/api/health`)
2. (Optional but recommended for persistence) Create a **PostgreSQL** database on Render or Neon/Supabase and copy the connection string to `DATABASE_URL`.
3. Configure the following environment variables in Render:
   - `NODE_ENV`: `production`
   - `SECRET_KEY`: A long random secret key (or click generate)
   - `FRONTEND_URL`: Your Vercel frontend URL (e.g. `https://your-app.vercel.app`)
   - `COOKIE_SAMESITE`: `none` (enables cross-origin session cookies)
   - `ALLOWED_ORIGINS`: Your Vercel URL (e.g. `https://your-app.vercel.app`)
   - `GEMINI_API_KEY`: (Optional) Your Google Gemini API key for AI assistant features
4. Copy your backend service URL (e.g., `https://rootline-backend.onrender.com`).

## Deploy the frontend to Vercel

1. In Vercel (<https://vercel.com/new>), import your GitHub repository.
2. The pre-configured `vercel.json` will automatically configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build:client`
   - **Output Directory**: `dist`
   - **Single Page App Routing**: Automatic rewrites for all React Router routes
3. In the **Environment Variables** section on Vercel, add:
   - `VITE_API_URL`: `https://rootline-backend.onrender.com` (your Render backend URL, without a trailing slash)
4. Click **Deploy**.
5. Once Vercel finishes deploying, copy your live Vercel URL (e.g., `https://your-app.vercel.app`) and ensure it matches the `FRONTEND_URL` in your Render service settings.

### Google OAuth Setup (Optional)
If using Google Sign-In:
- In Google Cloud Console Credentials:
  - Authorized JavaScript origins: `https://your-app.vercel.app`
  - Authorized redirect URIs: `https://rootline-backend.onrender.com/auth/google/callback`
- In Render environment variables:
  - `GOOGLE_CLIENT_ID`: Your Google OAuth client ID
  - `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret
  - `GOOGLE_REDIRECT_URI`: `https://rootline-backend.onrender.com/auth/google/callback`
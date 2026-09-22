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

## Deploy Full-Stack (Frontend + Backend) to Vercel

You can host both the frontend SPA and the backend API together on Vercel under a single domain.

1. Push your code to GitHub and import the repository in **Vercel** (<https://vercel.com/new>).
2. Vercel automatically detects the configuration from `vercel.json`:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build:client`
   - **Output Directory**: `dist`
   - **Serverless API**: Handled automatically by `/api/index.ts` for all `/api/*`, `/auth/*`, `/people/*`, and `/families/*` routes.
3. In **Project Settings** → **Environment Variables** on Vercel, add:
   - `SECRET_KEY`: A random 32+ character string for signing session cookies and OAuth state.
   - `RESEND_API_KEY`: *(Recommended for emails)* Free API key from <https://resend.com> for password reset and OTP emails (Vercel serverless environments block direct SMTP ports like 587/465).
   - `RESEND_FROM_EMAIL`: `onboarding@resend.dev` (or your verified domain email).
   - `DATABASE_URL`: *(Recommended for persistence)* A PostgreSQL connection string from Neon (<https://neon.tech>), Supabase (<https://supabase.com>), or Vercel Postgres.
   - `GEMINI_API_KEY`: *(Optional)* Your Google Gemini API key for AI assistant features.
4. **No `VITE_API_URL` is required**: Since both frontend and backend share the exact same Vercel domain, all API requests use relative paths and same-site session cookies seamlessly.

### Google OAuth Configuration for Vercel
1. Go to **Google Cloud Console** → **APIs & Services** → **Credentials**.
2. Under your OAuth 2.0 Client ID:
   - **Authorized JavaScript origins**: `https://your-app.vercel.app`
   - **Authorized redirect URIs**: `https://your-app.vercel.app/auth/google/callback`
3. In your Vercel Environment Variables, set:
   - `GOOGLE_CLIENT_ID`: Your Google OAuth client ID
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret
   - *(Optional)* `GOOGLE_REDIRECT_URI`: `https://your-app.vercel.app/auth/google/callback` (auto-detected if omitted)

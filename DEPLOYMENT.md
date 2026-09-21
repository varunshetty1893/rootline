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

1. In Render, create a **Blueprint** from the GitHub repository. Render will
   read `render.yaml`, or create a Web Service with the same commands:
   - Build: `npm ci && npm run build`
   - Start: `npm start`
   - Health check: `/health`
2. Attach a PostgreSQL database and set `DATABASE_URL` to its internal
   connection string.
3. Set these environment variables on the Render service:
   - `SECRET_KEY`: a long random value (the Blueprint can generate it).
   - `FRONTEND_URL`: the final Vercel URL, for example
     `https://rootline.vercel.app`.
   - `ALLOWED_ORIGINS`: the same Vercel URL. Add additional comma-separated
     origins only when they are genuinely needed.
   - `COOKIE_SAMESITE`: `none` for Vercel-to-Render cookies.
4. Copy the Render service URL, for example
   `https://rootline-api.onrender.com`. This is the API URL used by Vercel.

Optional services use the existing variables in `.env.example`: SMTP for
password resets and contact messages, Google OAuth, and Gemini/Groq for the
family assistant.

## Deploy the frontend to Vercel

1. Import the same GitHub repository into Vercel.
2. Keep the project root at the repository root. `vercel.json` already sets:
   - Build command: `npm run build:client`
   - Output directory: `dist`
   - SPA fallback for React Router routes
3. Add this Vercel environment variable for **Production**:

   `VITE_API_URL=https://rootline-api.onrender.com`

   Replace the value with the actual Render URL, without a trailing slash.
4. Deploy, then copy the Vercel URL back into Render's `FRONTEND_URL` and
   `ALLOWED_ORIGINS`. Redeploy Render after changing those values.

If Google OAuth is enabled, set `GOOGLE_REDIRECT_URI` on Render to
`https://rootline-api.onrender.com/auth/google/callback` and register that
exact URL in Google Cloud Console. The OAuth callback now returns users to
`FRONTEND_URL/dashboard`.
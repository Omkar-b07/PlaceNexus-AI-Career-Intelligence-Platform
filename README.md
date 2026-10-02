# PlaceNexus 

PlaceNexus compares an uploaded resume with a job description and returns an explainable career analysis, what-if projection, and 30-day roadmap.

## Project layout

- `frontend/` — React, Vite, TypeScript, and UI-only code.
- `backend/` — Express API, resume extraction/OCR, and analysis services.
- `docs/` — architecture and API documentation.

## Run locally

Install dependencies in each application, then run each service in its own terminal.

Terminal 1 — backend:

```powershell
cd backend
npm install
npm run server
```

Terminal 2 — frontend:

```powershell
cd frontend
npm install
npm run dev
```

The backend runs at `http://localhost:5000`. The Vite frontend runs at `http://localhost:5174` and calls that backend by default. Set `VITE_API_URL` in `frontend/.env` to change the API origin. Put backend-only secrets in `backend/.env`.

## Accounts

The app requires an account before its dashboard and career-analysis endpoints can be used. Use **Create account** on the login screen, then sign in with that email and password. Account records are stored in MongoDB; configure `MONGODB_URI` in `backend/.env` before starting the server. Passwords are salted and hashed; they are never stored as plain text.

Set a long, unique `AUTH_SECRET` in `backend/.env` before deploying the application. When it is unset locally, PlaceNexus creates a persistent development signing secret in MongoDB. Sessions last seven days by default; change this with `AUTH_TOKEN_TTL_SECONDS`.

### MongoDB and Gemini setup

Create a MongoDB Atlas free cluster or run MongoDB locally, then configure the backend:

```ini
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=placenexus
AUTH_SECRET=replace-with-a-long-random-secret
GEMINI_API_KEY=your-google-ai-studio-key
GEMINI_MODEL=gemini-3.5-flash-lite
```

MongoDB stores user accounts and automatically creates unique indexes for email and Google subject IDs. Gemini is used only to personalize recommendations; the explainable score, evidence, gaps, simulator, and roadmap still work when no Gemini key is supplied.

### Google Sign-In setup

Google Sign-In is enabled when both environment files contain the same OAuth **Web** Client ID:

```ini
# backend/.env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# frontend/.env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

In Google Cloud Console, create a Web OAuth client, configure the consent screen, and add `http://localhost:5174` as an Authorized JavaScript origin for local development. Add your deployed `https://` domain before production. The backend verifies every Google ID token before creating its PlaceNexus session.

### Google service readiness

The backend must be able to make outbound HTTPS requests to Google to verify ID tokens. It checks this at startup and exposes the result at `GET /auth/google/status`. The login page checks that endpoint before rendering the Google button, so a connectivity problem is reported as a temporary service problem rather than an invalid Google account. Allow outbound HTTPS access to Google from the backend host before deploying.

If either port is already in use, stop the correct existing development process or choose a different configured port before starting another instance. Do not run a second server on the same port.

Use `npm run build` from `frontend/` to create a production frontend build.

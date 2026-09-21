# Rootline 🌳

> A modern, elegant digital family tree management system built with React, TypeScript, Express, and Vite.

Rootline makes it simple to map, document, and explore multi-generational family trees. Built with an intelligent layered layout engine, Rootline automatically aligns complex family branches, in-laws, partners, and siblings while providing smooth pan-and-zoom exploration, kinship relationship discovery, branch collapsing, and searchable member archives.

---

## ✨ Key Features

- **Interactive Family Tree Visualizer**
  - **Dynamic Layered Layout Engine**: Automatically computes generations, prevents card collisions, places in-laws on outer flanks, and eliminates cross-line clutter.
  - **Pan, Zoom & Fit**: Smooth canvas controls with mouse wheel zoom, pan/drag, fit-to-screen, and person centering.
  - **"How Am I Related?" Kinship Discovery**: Highlights shortest lineage paths between any selected person and the root person (e.g., *Second Cousin Once Removed*).
  - **Branch Collapsing**: Collapse or expand distant branches on demand; includes smart auto-collapse for large trees to maintain clean readability.
  - **Live Branch Building**: Quick-add parents, siblings, partners, and children directly from the inspector panel without leaving the tree.
  - **Print Ready**: High-resolution print-friendly mode for exporting your tree.

- **People Directory & Archives**
  - **Searchable People Directory** (`/people`): Real-time search across names, birth places, occupations, and birth/death dates.
  - **Filter Chips**: Quick filters for *All*, *Living*, and *Has Photo*.
  - **Member Profile Details** (`/people/:id`): Dedicated read-only member page presenting full biographical vitals, birth place, occupation, contact details, notes, and family links.
  - **Full Record Management** (`/people/:id/edit`, `/people/new`): Comprehensive editing form supporting all genealogical fields and photo uploads with instant tree synchronization.

- **Genealogical Relational Data Model**
  - Normalized in-memory store and GEDCOM-aligned architecture (`Person`, `FamilyUnit`, and `FamilyChild` join relationships).
  - Cycle detection preventing circular genealogical ancestor-descendant loops.
  - Deduplicated family unit and family child links.
  - Partial-date validation preventing conflicting birth and death dates on PATCH/update requests.

- **Authentication & Security**
  - Email and password registration with salted `bcrypt` hashing.
  - Secure session cookies (`HttpOnly`, configurable `SameSite` and `Secure` attributes).
  - Google OAuth 2.0 integration with HMAC-SHA256 browser-cookie-bound state tokens preventing login-CSRF attacks.
  - Email verification requirement for Google OAuth to prevent account pre-hijacking.
  - Single-active atomic password reset tokens with automatic invalidation of prior tokens.
  - SMTP password whitespace sanitization for 16-character Google App Passwords.

- **Landing Page & Contact Form**
  - Public showcase landing page (`/`) with feature breakdown and functional contact form (`POST /api/contact`).

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v7
- **Icons**: Lucide React
- **HTTP Client**: Centralized API client with `AbortController` request timeouts and CORS preflight optimization
- **Testing**: `@testing-library/react` + Vitest in `jsdom`

### Backend
- **Runtime**: Node.js (TypeScript via `tsx` dev server and `esbuild` production bundler)
- **Framework**: Express
- **Session & Auth**: `cookie-parser`, `bcryptjs`, HMAC-SHA256 OAuth state validation
- **Mailing**: `nodemailer` with automatic Google App Password sanitization
- **Testing**: Vitest unit and regression test suite

---

## 📁 Repository Structure

```
rootline/
├── public/
│   └── favicon.svg             # Rootline tree favicon
├── server/
│   └── store.ts                # Genealogical relational store, models & validation
├── src/
│   ├── family/
│   │   ├── AppHeader.jsx       # Navigation bar & user menu
│   │   ├── FamilyContext.jsx   # Shared family state, mutations & caching
│   │   ├── PeopleList.jsx      # Searchable people directory with filter chips
│   │   ├── PersonDetail.jsx    # Read-only detailed member profile
│   │   ├── PersonForm.jsx      # Create & edit person form
│   │   ├── relationship.js     # Kinship pathfinding & title generation
│   │   ├── treeLayout.js       # Generational layered coordinate layout engine
│   │   └── TreeView.jsx        # Interactive family tree canvas & inspector
│   ├── App.jsx                 # Route declarations & navigation setup
│   ├── AuthContext.jsx         # User authentication state & session lifecycle
│   ├── ProtectedRoute.jsx      # Route guard for authenticated views
│   ├── RootlineDashboard.jsx   # Family metrics, generation counts & quick actions
│   ├── RootlineHome.jsx        # Landing page with contact submission form
│   ├── RootlineLogin.jsx       # Login view with demo pre-fill
│   ├── RootlineRegister.jsx    # Account registration view
│   ├── RootlineForgotPassword.jsx # Password recovery request view
│   ├── RootlineResetPassword.jsx  # Tokenized password reset form
│   ├── RootlineOAuthCallback.jsx  # Google OAuth return handler
│   ├── api.js                  # Resilient API client wrapper
│   ├── main.jsx                # React DOM root entry
│   └── index.css               # Tailwind CSS declarations
├── tests/
│   ├── server.test.ts          # Backend security, cycle prevention & API regression tests
│   └── frontend.test.jsx       # Frontend React component & interaction test suite
├── index.html                  # HTML entry point
├── package.json                # Project dependencies & npm scripts
├── server.ts                   # Express application entry point & API endpoints
├── tailwind.config.js          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
├── vite.config.js              # Vite & Vitest configuration
├── SECURITY_AUDIT.md           # Security audit & remediation record
└── README.md                   # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or higher; Node 20+ recommended)
- **npm** (v9 or higher)

---

### 1. Installation

Clone the repository and install dependencies:

```bash
npm install
```

---

### 2. Environment Configuration

Copy the sample environment file:

```bash
cp .env.example .env
```

Configure any optional values in `.env` as needed:
```env
# Optional: Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Optional: SMTP for password reset emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
```

---

### 3. Running the Development Server

Start the full-stack server (Express backend + Vite client middleware):

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

---

### 4. Running the Test Suite

Execute the Vitest test suite covering both backend regression cases and frontend UI components:

```bash
npm test
```

This runs:
- `tests/server.test.ts`: Cycle prevention, partial-date validation, spouse/child deduplication, OAuth CSRF state verification, atomic reset token consumption, photo payload optimization, and contact form validation.
- `tests/frontend.test.jsx`: Login, Register, Forgot Password, Reset Password, OAuth Callback, Dashboard, Searchable PeopleList, PersonDetail, and PersonForm.
- `src/family/relationship.test.js`: Kinship pathfinding and relationship labeling algorithm.

---

### 5. Production Build

Compile the client assets and bundle the backend server:

```bash
npm run build
npm start
```

---

## 🌐 Application Routes

| Path | Description | Access |
|---|---|---|
| `/` | Landing page with feature overview & contact form | Public |
| `/login` | User login (with demo account pre-fill) | Public |
| `/register` | Account registration | Public |
| `/forgot-password` | Password recovery request | Public |
| `/reset-password` | Reset password via single-use token | Public |
| `/oauth-callback` | Google OAuth callback handler | Public |
| `/dashboard` | Family metrics, generation counts & quick navigation | Authenticated |
| `/people` | Searchable directory of family members with filter chips | Authenticated |
| `/people/new` | Add a new family member | Authenticated |
| `/people/:id` | Read-only member profile with complete vitals & connections | Authenticated |
| `/people/:id/edit`| Edit personal details, dates, birthplace, occupation, address, phone & bio | Authenticated |
| `/tree` | Interactive family tree visualizer with kinship inspector | Authenticated |

---

## 🔒 Security Summary

- Passwords hashed using standard `bcrypt` with salt rounds.
- Session tokens stored exclusively in `HttpOnly` cookies.
- Google OAuth protected by HMAC-SHA256 signatures validated against browser cookies.
- Email verification enforced for OAuth logins.
- Reset tokens are strictly single-use and atomically claimed.
- No sensitive keys or credentials exposed to client-side bundles.

---

## 📄 License

This project is licensed under the MIT License.

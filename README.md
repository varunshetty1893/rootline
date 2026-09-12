# Rootline 🌳

> A modern, elegant digital family tree management system built with FastAPI, PostgreSQL, and React.

Rootline makes it simple to map, document, and explore multi-generational family trees. Built with an intelligent layered layout engine, Rootline automatically aligns complex family branches, in-laws, partners, and siblings while providing smooth pan-and-zoom exploration, relationship discovery, and branch collapsing.

---

## ✨ Key Features

- **Interactive Family Tree Visualizer**
  - **Dynamic Layered Layout Engine**: Automatically computes generations, prevents card collisions, places in-laws on outer flanks, and eliminates cross-line clutter.
  - **Pan, Zoom & Fit**: Smooth canvas controls with mouse wheel zoom, pan/drag, fit-to-screen, and person centering.
  - **"How Am I Related?" Discovery**: Highlights shortest lineage paths between any selected person and the root person (e.g., *Second Cousin Once Removed*).
  - **Branch Collapsing**: Collapse or expand distant branches on demand; includes smart auto-collapse for large trees to maintain clean readability.
  - **Live Branch Building**: Quick-add parents, siblings, partners, and children directly from the inspector panel without leaving the tree.
  - **Print Ready**: High-resolution print-friendly mode for exporting your tree.

- **People Directory**
  - Searchable list of all family members.
  - Detailed profiles with birth dates, death dates, birthplaces, occupations, and bios.
  - Full CRUD operations with instant tree synchronization.

- **GEDCOM-Aligned Relational Data Model**
  - Normalized database schema using `Person`, `FamilyUnit`, and `FamilyChild` join models.
  - Supports single parents, multiple marriages, partner statuses, and complex blended families.

- **Authentication & Security**
  - Email/password authentication with bcrypt hashing.
  - JWT (JSON Web Token) authentication with persistent sessions.
  - Google OAuth 2.0 integration ("Sign in with Google").
  - Secure tokenized password reset workflow.
  - Protected API routes and client-side route guards.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **Icons**: Lucide React
- **HTTP Client**: Native Fetch API with custom auth wrapper

### Backend
- **Framework**: FastAPI (Python 3.12+)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Authentication**: Python-JOSE (JWT) + Passlib (Bcrypt) + Authlib (Google OAuth)
- **Validation**: Pydantic v2
- **Server**: Uvicorn ASGI

---

## 📁 Repository Structure

```
rootline/
├── backend/
│   ├── app/
│   │   ├── config.py           # Settings and environment validation
│   │   ├── database.py         # SQLAlchemy engine and session factory
│   │   ├── deps.py             # Auth dependencies & current user resolution
│   │   ├── email_utils.py      # Transactional reset email utilities
│   │   ├── main.py             # FastAPI entrypoint & route registration
│   │   ├── models.py           # SQLAlchemy tables (User, Person, FamilyUnit, etc.)
│   │   ├── rate_limit.py       # Rate limiting middleware
│   │   ├── schemas.py          # Pydantic request/response schemas
│   │   ├── security.py         # JWT tokens & bcrypt hashing
│   │   └── routers/            # API endpoints (auth, people, families, etc.)
│   ├── requirements.txt        # Python backend dependencies
│   └── .env.example            # Backend environment template
├── public/
│   └── favicon.svg             # Official Rootline branch favicon
├── src/
│   ├── family/
│   │   ├── AppHeader.jsx       # Global application navigation bar
│   │   ├── FamilyContext.jsx   # Shared family state and mutations
│   │   ├── PeopleList.jsx      # Searchable people directory
│   │   ├── PersonForm.jsx      # Create / Edit person forms
│   │   ├── relationship.js     # Kinship pathfinding & title generation
│   │   ├── treeLayout.js       # Core generation & coordinate layout engine
│   │   └── TreeView.jsx        # SVG + Canvas interactive family tree view
│   ├── App.jsx                 # Route declarations and root layout
│   ├── AuthContext.jsx         # User login state & JWT lifecycle
│   ├── ProtectedRoute.jsx      # Auth guard for private views
│   ├── RootlineDashboard.jsx   # Overview statistics and family summary
│   ├── RootlineHome.jsx        # Welcome landing page
│   ├── RootlineLogin.jsx       # Login view
│   ├── RootlineRegister.jsx    # Registration view
│   ├── api.js                  # Frontend API client
│   └── main.jsx                # React DOM root entry
├── index.html                  # HTML entry with custom Rootline branding
├── docker-compose.yml          # PostgreSQL database container
├── package.json                # Frontend dependencies and Vite scripts
└── README.md                   # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or higher)
- **Python** (v3.10 or higher; v3.12 recommended)
- **Docker** (optional, for running Postgres in one command) or local PostgreSQL server

---

### 1. Database Setup

The fastest way to start the database is using Docker Compose:

```bash
docker compose up -d
```

This starts PostgreSQL on `localhost:5432` with:
- **User**: `postgres`
- **Password**: `postgres`
- **Database**: `rootline`

*(If you are running PostgreSQL natively, create a database named `rootline` and adjust your `.env` connection string).*

---

### 2. Backend Setup

From the repository root:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:
- **Windows PowerShell**:
  ```powershell
  .\.venv\Scripts\Activate.ps1
  ```
- **macOS / Linux**:
  ```bash
  source .venv/bin/activate
  ```

Install dependencies:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

Configure your environment:
```bash
cp .env.example .env
```

Edit `backend/.env` with your settings:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rootline
SECRET_KEY=replace-with-a-secure-random-secret-key-64-characters-long
FRONTEND_URL=http://localhost:5173

# Optional: Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
```

Run the FastAPI dev server:
```bash
python -m uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive OpenAPI documentation is accessible at `http://localhost:8000/docs`.

---

### 3. Frontend Setup

In a new terminal window, from the repository root:

```bash
npm install
```

Start the Vite development server:
```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 🌐 Application Routes

| Path | Description | Access |
|---|---|---|
| `/` | Rootline landing page | Public |
| `/login` | User login | Public |
| `/register` | Account registration | Public |
| `/forgot-password` | Password recovery request | Public |
| `/reset-password` | Reset password via token | Public |
| `/oauth-callback` | Google OAuth callback handler | Public |
| `/dashboard` | Family summary & quick actions | Authenticated |
| `/people` | Searchable directory of family members | Authenticated |
| `/people/:id/edit`| Edit personal details, dates, & bio | Authenticated |
| `/tree` | Interactive, navigable family tree | Authenticated |

---

## 📐 Tree Layout Algorithm Details

The layout engine in [`treeLayout.js`](src/family/treeLayout.js) employs a multi-pass hierarchical algorithm:

1. **Unit Grouping (`buildUnits`)**:
   - Partner pairs are contracted into unified `FamilyUnit` nodes so couples always occupy a single logical block, keeping children centered beneath both parents.
2. **Dynamic Generation Assignment (`assignGenerations`)**:
   - Computes longest-path depth while performing bottom-up in-law anchoring.
   - Ensures in-law parents without upper ancestors are placed exactly 1 generation above their children (rather than defaulting to generation 0), and unmarried siblings share the same generational row.
3. **Flank-Aware Couple Ordering (`makeRows`)**:
   - Spouses are oriented dynamically: the partner belonging to the primary sibling lineage stays facing their siblings, while the in-law spouse sits on the outer flank.
   - This ensures parent-to-child drop lines connect cleanly without crossing spouse cards.
4. **Relaxation & Collision Resolution (`layoutUnitCenters`)**:
   - Iterative two-way relaxation aligns parent stems with children.
   - Symmetrically pushes colliding nodes apart while preserving minimum pitch gaps.

---

## 🔒 Security Best Practices

- Passwords hashed using `bcrypt`.
- JWTs signed with HMAC-SHA256 and verified via FastAPI dependencies.
- CORS restricted to configured `FRONTEND_URL`.
- Password reset tokens expire automatically and are single-use.
- Generic error messages for credential failures to prevent user enumeration.

---

## 📄 License

This project is licensed under the MIT License.

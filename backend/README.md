# Backend (FastAPI)

Auth (teacher / student), teacher-managed lesson access, and hosting of the built SPA.
Lesson markdown lives in `../content` and is only readable through `GET /api/lessons/{module}/{topic}`
(requires login + the lesson must be opened by a teacher; teachers can read everything).

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
npm run build                       # builds ../dist
DB_PATH=... .venv/bin/uvicorn app.main:app --port 8097
```

- Everyone who registers is a **student**. Promote a teacher after they register: `.venv/bin/python -m app.cli teacher you@example.com` (no email-based auto-promotion, so nobody can claim the role by registering first).
- Teachers open/close lessons per student at `/teacher` (`student_access` table). New students start with everything closed.
- Env: `JWT_SECRET` (auto-generated into `data/.jwt_secret` if unset), `DB_PATH` (default `backend/data/app.db`).
- Dev: `uvicorn app.main:app --port 8000` + `npm run dev` (Vite proxies `/api`).

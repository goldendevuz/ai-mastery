# Backend (FastAPI)

Auth (teacher / student), teacher-managed lesson access, and hosting of the built SPA.
Lesson markdown lives in `../content` and is only readable through `GET /api/lessons/{module}/{topic}`
(requires login + the lesson must be opened by a teacher; teachers can read everything).

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
npm run build                       # builds ../dist
TEACHER_EMAILS=you@example.com .venv/bin/uvicorn app.main:app --port 8097
```

- Everyone who registers is a **student**; emails in `TEACHER_EMAILS` (comma-separated) become **teacher**.
- Teachers open/close lessons at `/teacher`. Access is global for now (`lesson_access` table); per-student access can be added later.
- Env: `TEACHER_EMAILS`, `JWT_SECRET` (auto-generated into `data/.jwt_secret` if unset), `DB_PATH` (default `backend/data/app.db`).
- Dev: `uvicorn app.main:app --port 8000` + `npm run dev` (Vite proxies `/api`).

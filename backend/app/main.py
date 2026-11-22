"""AI Mastery backend: auth (teacher/student), lesson access control, SPA hosting.

Lesson markdown lives in ../content and is NEVER served statically; the only way
to read it is GET /api/lessons/{module}/{topic}, which checks the caller's role
and the teacher-managed lesson_access table.
"""
import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import time
from contextlib import closing
from pathlib import Path

import jwt
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[2]
CONTENT = ROOT / "content"
DIST = ROOT / "dist"
DB_PATH = Path(os.environ.get("DB_PATH", ROOT / "backend" / "data" / "app.db"))
TOKEN_TTL = 60 * 60 * 24 * 14
SLUG = re.compile(r"^[a-z0-9][a-z0-9-]*$")


def _secret() -> str:
    s = os.environ.get("JWT_SECRET")
    if s:
        return s
    f = DB_PATH.parent / ".jwt_secret"
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not f.exists():
        f.write_text(secrets.token_hex(32))
        f.chmod(0o600)
    return f.read_text().strip()


JWT_SECRET = _secret()


def db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def init_db() -> None:
    with closing(db()) as con, con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              email TEXT NOT NULL UNIQUE,
              name TEXT NOT NULL,
              password_hash TEXT NOT NULL,
              role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','teacher')),
              created_at INTEGER NOT NULL
            );
            -- Global access list (applies to every student for now).
            -- Per-student access can be added later as a separate table.
            CREATE TABLE IF NOT EXISTS lesson_access (
              lesson_id TEXT PRIMARY KEY
            );
            """
        )


def all_lesson_ids() -> list[str]:
    return sorted(f"{p.parent.name}/{p.stem}" for p in CONTENT.glob("*/*.md"))


def hash_password(pw: str) -> str:
    salt = secrets.token_bytes(16)
    h = hashlib.scrypt(pw.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{salt.hex()}${h.hex()}"


def verify_password(pw: str, stored: str) -> bool:
    salt, h = stored.split("$")
    cand = hashlib.scrypt(pw.encode(), salt=bytes.fromhex(salt), n=2**14, r=8, p=1)
    return hmac.compare_digest(cand.hex(), h)


def make_token(user_id: int) -> str:
    return jwt.encode({"sub": str(user_id), "exp": int(time.time()) + TOKEN_TTL}, JWT_SECRET, algorithm="HS256")


def current_user(request: Request) -> sqlite3.Row:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        raise HTTPException(401, "Login required")
    try:
        uid = int(jwt.decode(auth[7:], JWT_SECRET, algorithms=["HS256"])["sub"])
    except Exception:
        raise HTTPException(401, "Invalid or expired session")
    with closing(db()) as con:
        row = con.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    if not row:
        raise HTTPException(401, "Invalid session")
    return row  # role is read from the DB on every request, never from the token


def teacher_only(user: sqlite3.Row = Depends(current_user)) -> sqlite3.Row:
    if user["role"] != "teacher":
        raise HTTPException(403, "Teachers only")
    return user


def public_user(u: sqlite3.Row) -> dict:
    return {"id": u["id"], "email": u["email"], "name": u["name"], "role": u["role"]}


def unlocked_ids(user: sqlite3.Row) -> list[str]:
    if user["role"] == "teacher":
        return all_lesson_ids()
    with closing(db()) as con:
        opened = {r[0] for r in con.execute("SELECT lesson_id FROM lesson_access")}
    return [i for i in all_lesson_ids() if i in opened]


app = FastAPI(title="AI Mastery", docs_url=None, redoc_url=None, openapi_url=None)
init_db()


class Register(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(max_length=200, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=200)


class Login(BaseModel):
    email: str
    password: str


@app.post("/api/auth/register")
def register(body: Register):
    email = body.email.strip().lower()
    role = "student"  # registration always creates a student; teachers are promoted via `python -m app.cli`
    try:
        with closing(db()) as con, con:
            cur = con.execute(
                "INSERT INTO users (email,name,password_hash,role,created_at) VALUES (?,?,?,?,?)",
                (email, body.name.strip(), hash_password(body.password), role, int(time.time())),
            )
            uid = cur.lastrowid
            row = con.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    except sqlite3.IntegrityError:
        raise HTTPException(409, "This email is already registered")
    return {"token": make_token(uid), "user": public_user(row)}


@app.post("/api/auth/login")
def login(body: Login):
    with closing(db()) as con:
        row = con.execute("SELECT * FROM users WHERE email=?", (body.email.strip().lower(),)).fetchone()
    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(401, "Wrong email or password")
    return {"token": make_token(row["id"]), "user": public_user(row)}


@app.get("/api/me")
def me(user: sqlite3.Row = Depends(current_user)):
    return {"user": public_user(user), "unlocked": unlocked_ids(user)}


@app.get("/api/lessons/{module}/{topic}")
def lesson(module: str, topic: str, user: sqlite3.Row = Depends(current_user)):
    if not SLUG.match(module) or not SLUG.match(topic):
        raise HTTPException(404, "Lesson not found")
    path = CONTENT / module / f"{topic}.md"
    if not path.is_file():
        raise HTTPException(404, "Lesson not found")
    if f"{module}/{topic}" not in unlocked_ids(user):
        raise HTTPException(403, "This lesson is not open yet")
    return FileResponse(path, media_type="text/markdown; charset=utf-8", headers={"Cache-Control": "no-store"})


class Toggle(BaseModel):
    lesson_ids: list[str]
    open: bool


@app.get("/api/admin/access")
def admin_access(_: sqlite3.Row = Depends(teacher_only)):
    with closing(db()) as con:
        opened = [r[0] for r in con.execute("SELECT lesson_id FROM lesson_access")]
        students = [
            {"id": r["id"], "name": r["name"], "email": r["email"], "role": r["role"]}
            for r in con.execute("SELECT * FROM users ORDER BY created_at DESC")
        ]
    return {"open": opened, "students": students}


@app.put("/api/admin/access")
def admin_set_access(body: Toggle, _: sqlite3.Row = Depends(teacher_only)):
    valid = set(all_lesson_ids())
    ids = [i for i in body.lesson_ids if i in valid]
    with closing(db()) as con, con:
        if body.open:
            con.executemany("INSERT OR IGNORE INTO lesson_access (lesson_id) VALUES (?)", [(i,) for i in ids])
        else:
            con.executemany("DELETE FROM lesson_access WHERE lesson_id=?", [(i,) for i in ids])
        opened = [r[0] for r in con.execute("SELECT lesson_id FROM lesson_access")]
    return {"open": opened}


@app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
def api_404(rest: str):
    raise HTTPException(404, "Not found")


if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        f = (DIST / path).resolve()
        if path and f.is_file() and DIST in f.parents:
            return FileResponse(f)
        return FileResponse(DIST / "index.html")

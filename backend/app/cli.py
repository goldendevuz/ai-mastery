"""Usage: python -m app.cli teacher <email> | student <email> | users"""
import sys
from contextlib import closing

from .main import db, init_db

init_db()
cmd, *rest = sys.argv[1:] or ["users"]
with closing(db()) as con, con:
    if cmd in ("teacher", "student") and rest:
        n = con.execute("UPDATE users SET role=? WHERE email=?", (cmd, rest[0].strip().lower())).rowcount
        print("updated" if n else "no such user (register first)")
    else:
        for r in con.execute("SELECT email,name,role FROM users ORDER BY id"):
            print(r["role"], r["email"], r["name"], sep="\t")

from datetime import datetime, timedelta, timezone
from typing import Any
import hashlib
import os
import base64

import jwt
from jwt import InvalidTokenError

from app.config import get_settings

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return "pbkdf2$120000$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(digest).decode()


def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, rounds, salt_b64, hash_b64 = encoded.split("$", 3)
    except ValueError:
        return False
    if scheme != "pbkdf2":
        return False
    salt = base64.b64decode(salt_b64)
    expected = base64.b64decode(hash_b64)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(rounds))
    return hashlib.compare_digest(digest, expected)


def create_access_token(subject: str, extra: dict[str, Any] | None = None, secret: str | None = None) -> str:
    settings = get_settings()
    key = secret or settings.secret_key
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "exp": expire}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, key, algorithm=ALGORITHM)


def decode_token(token: str, secret: str | None = None) -> dict[str, Any]:
    settings = get_settings()
    key = secret or settings.secret_key
    try:
        return jwt.decode(token, key, algorithms=[ALGORITHM])
    except InvalidTokenError as exc:
        raise ValueError("invalid token") from exc

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas import LoginRequest, RegisterRequest, TokenResponse, UserOut, Preferences
from app.security import create_access_token, hash_password, verify_password
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


def _secret(request: Request) -> str:
    return request.app.state.settings.secret_key


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="email already registered")
    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        display_name=payload.display_name or payload.email.split("@")[0],
        preferences=Preferences().model_dump(),
        onboarding_done=False,
    )
    db.add(user)
    db.commit()
    return TokenResponse(access_token=create_access_token(user.id, secret=_secret(request)))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="invalid credentials")
    return TokenResponse(access_token=create_access_token(user.id, secret=_secret(request)))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return to_user_out(user)


def to_user_out(user: User) -> UserOut:
    prefs = Preferences.model_validate(user.preferences or {})
    return UserOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        onboarding_done=user.onboarding_done,
        preferences=prefs,
    )

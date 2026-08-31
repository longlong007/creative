from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.auth import to_user_out
from app.api.deps import get_current_user
from app.db import get_db
from app.models import User
from app.schemas import PreferencesUpdate, UserOut
from app.templates import list_templates

router = APIRouter(tags=["users"])


@router.put("/users/me/preferences", response_model=UserOut)
def update_preferences(
    payload: PreferencesUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user.preferences = payload.model_dump()
    user.onboarding_done = True
    db.commit()
    db.refresh(user)
    return to_user_out(user)


@router.get("/templates")
def templates(category: str | None = None, user: User = Depends(get_current_user)):
    preferred = (user.preferences or {}).get("categories") or []
    return list_templates(preferred, category)

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(default="", max_length=80)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class Preferences(BaseModel):
    language: str = "zh"
    tone: str = "warm"
    categories: list[str] = Field(default_factory=lambda: ["life"])
    risk_tolerance: str = "medium"
    decision_speed: str = "balanced"


class UserOut(BaseModel):
    id: str
    email: str
    display_name: str
    onboarding_done: bool
    preferences: Preferences


class PreferencesUpdate(Preferences):
    pass


class TemplateOut(BaseModel):
    id: str
    category: str
    title: str
    prompt: str
    suggested_criteria: list[str]


class DecisionCreate(BaseModel):
    title: str | None = None
    category: str | None = None
    template_id: str | None = None
    problem: str | None = None


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=8000)


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    stage: str
    extra: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class DecisionSummary(BaseModel):
    id: str
    title: str
    category: str
    stage: str
    status: str
    review_at: datetime | None
    updated_at: datetime


class DecisionOut(BaseModel):
    id: str
    title: str
    category: str
    template_id: str | None
    stage: str
    status: str
    workspace: dict[str, Any]
    report_markdown: str
    review_at: datetime | None
    reviewed_at: datetime | None
    review_notes: str
    messages: list[MessageOut]
    created_at: datetime
    updated_at: datetime


class RecordDecisionRequest(BaseModel):
    option_id: str | None = None
    custom_choice: str | None = None
    notes: str | None = None
    review_in_days: int = Field(default=14, ge=1, le=365)


class ReviewCompleteRequest(BaseModel):
    notes: str = ""


class ChatResponse(BaseModel):
    decision: DecisionOut
    assistant_message: MessageOut

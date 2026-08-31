from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db import get_db, utcnow
from app.domain.stages import DecisionStage
from app.models import Decision, Message, User
from app.schemas import (
    ChatResponse,
    DecisionCreate,
    DecisionOut,
    DecisionSummary,
    MessageCreate,
    MessageOut,
    RecordDecisionRequest,
    ReviewCompleteRequest,
)
from app.services.chat import ChatOrchestrator

router = APIRouter(tags=["decisions"])


def get_orchestrator(request: Request) -> ChatOrchestrator:
    return request.app.state.orchestrator


def _get_owned(db: Session, user: User, decision_id: str) -> Decision:
    decision = (
        db.query(Decision)
        .options(selectinload(Decision.messages))
        .filter(Decision.id == decision_id, Decision.user_id == user.id)
        .first()
    )
    if decision is None:
        raise HTTPException(status_code=404, detail="decision not found")
    return decision


def to_message_out(message: Message) -> MessageOut:
    return MessageOut(
        id=message.id,
        role=message.role,
        content=message.content,
        stage=message.stage,
        extra=message.extra or {},
        created_at=message.created_at,
    )


def to_decision_out(decision: Decision) -> DecisionOut:
    messages = [to_message_out(m) for m in decision.messages]
    return DecisionOut(
        id=decision.id,
        title=decision.title,
        category=decision.category,
        template_id=decision.template_id,
        stage=decision.stage,
        status=decision.status,
        workspace=decision.workspace or {},
        report_markdown=decision.report_markdown or "",
        review_at=decision.review_at,
        reviewed_at=decision.reviewed_at,
        review_notes=decision.review_notes or "",
        messages=messages,
        created_at=decision.created_at,
        updated_at=decision.updated_at,
    )


@router.post("/decisions", response_model=DecisionOut)
def create_decision(
    payload: DecisionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    orch: ChatOrchestrator = Depends(get_orchestrator),
):
    decision = orch.create_decision(
        db,
        user,
        title=payload.title,
        category=payload.category,
        template_id=payload.template_id,
        problem=payload.problem,
    )
    return to_decision_out(_get_owned(db, user, decision.id))


@router.get("/decisions", response_model=list[DecisionSummary])
def list_decisions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(Decision)
        .filter(Decision.user_id == user.id)
        .order_by(Decision.updated_at.desc())
        .all()
    )
    return [
        DecisionSummary(
            id=d.id,
            title=d.title,
            category=d.category,
            stage=d.stage,
            status=d.status,
            review_at=d.review_at,
            updated_at=d.updated_at,
        )
        for d in rows
    ]


@router.get("/decisions/{decision_id}", response_model=DecisionOut)
def get_decision(
    decision_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return to_decision_out(_get_owned(db, user, decision_id))


@router.get("/decisions/{decision_id}/report", response_model=DecisionOut)
def get_report(
    decision_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return to_decision_out(_get_owned(db, user, decision_id))


@router.post("/decisions/{decision_id}/messages", response_model=ChatResponse)
def post_message(
    decision_id: str,
    payload: MessageCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    orch: ChatOrchestrator = Depends(get_orchestrator),
):
    decision = _get_owned(db, user, decision_id)
    try:
        assistant = orch.add_user_message(db, user, decision, payload.content)
    except PermissionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    decision = _get_owned(db, user, decision_id)
    return ChatResponse(decision=to_decision_out(decision), assistant_message=to_message_out(assistant))


@router.post("/decisions/{decision_id}/record", response_model=DecisionOut)
def record_decision(
    decision_id: str,
    payload: RecordDecisionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    orch: ChatOrchestrator = Depends(get_orchestrator),
):
    decision = _get_owned(db, user, decision_id)
    language = (user.preferences or {}).get("language") or "zh"
    try:
        orch.record(
            db,
            decision,
            option_id=payload.option_id,
            custom_choice=payload.custom_choice,
            notes=payload.notes,
            review_in_days=payload.review_in_days,
            language=language,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return to_decision_out(_get_owned(db, user, decision_id))


@router.get("/reviews/due", response_model=list[DecisionSummary])
def due_reviews(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = utcnow()
    rows = (
        db.query(Decision)
        .filter(
            Decision.user_id == user.id,
            Decision.status == "recorded",
            Decision.review_at.is_not(None),
            Decision.review_at <= now,
        )
        .order_by(Decision.review_at.asc())
        .all()
    )
    return [
        DecisionSummary(
            id=d.id,
            title=d.title,
            category=d.category,
            stage=d.stage,
            status=d.status,
            review_at=d.review_at,
            updated_at=d.updated_at,
        )
        for d in rows
    ]


@router.post("/reviews/{decision_id}/complete", response_model=DecisionOut)
def complete_review(
    decision_id: str,
    payload: ReviewCompleteRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    decision = _get_owned(db, user, decision_id)
    if decision.status != "recorded":
        raise HTTPException(status_code=409, detail="review not due")
    decision.status = "reviewed"
    decision.reviewed_at = utcnow()
    decision.review_notes = payload.notes
    db.add(
        Message(
            decision_id=decision.id,
            role="user",
            content=payload.notes or "已复盘",
            stage=DecisionStage.RECORDED.value,
            extra={"kind": "review"},
        )
    )
    db.commit()
    return to_decision_out(_get_owned(db, user, decision_id))

from __future__ import annotations

from datetime import timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.db import utcnow
from app.domain.report import build_report
from app.domain.stages import DecisionStage, can_record
from app.models import Decision, Message, User
from app.services.llm import HeuristicCoach, LlmCoach
from app.services.rag import RagService
from app.services.web_search import WebSearch
from app.templates import get_template


class ChatOrchestrator:
    def __init__(self, rag: RagService, coach: HeuristicCoach | LlmCoach, search: WebSearch):
        self.rag = rag
        self.coach = coach
        self.search = search

    def create_decision(
        self, db: Session, user: User, *, title: str | None, category: str | None,
        template_id: str | None, problem: str | None,
    ) -> Decision:
        template = get_template(template_id) if template_id else None
        prefs = user.preferences or {}
        language = prefs.get("language") or "zh"
        resolved_title = title or (template.title if template else "") or (problem or "")[:40] or (
            "New decision" if language == "en" else "新的决策"
        )
        resolved_category = category or (template.category if template else None) or "life"
        criteria = []
        if template:
            criteria = [{"name": name, "weight": 2} for name in template.suggested_criteria]
        workspace = {
            "title": resolved_title,
            "stage": DecisionStage.CLARIFY.value,
            "problem_statement": problem or (template.prompt if template else ""),
            "criteria": criteria,
            "constraints": [],
            "options": [],
        }
        decision = Decision(
            user_id=user.id,
            title=resolved_title,
            category=resolved_category,
            template_id=template.id if template else None,
            stage=DecisionStage.CLARIFY.value,
            status="active",
            workspace=workspace,
        )
        db.add(decision)
        db.flush()
        greeting = _opening_message(language, template, resolved_title)
        db.add(
            Message(
                decision_id=decision.id,
                role="assistant",
                content=greeting,
                stage=DecisionStage.CLARIFY.value,
                extra={"kind": "opening"},
            )
        )
        db.commit()
        db.refresh(decision)
        return decision

    def add_user_message(self, db: Session, user: User, decision: Decision, content: str) -> Message:
        if decision.stage == DecisionStage.RECORDED.value:
            raise PermissionError("decision already recorded")
        prefs = user.preferences or {}
        query = f"{decision.title}\n{content}"
        retrieved = [chunk.as_dict() for chunk in self.rag.search(query, top_k=4)]
        web_results: list[dict[str, str]] = []
        if decision.stage in {DecisionStage.COLLECT.value, DecisionStage.EVALUATE.value}:
            try:
                web_results = [item.as_dict() for item in self.search.search(decision.title or content)]
            except Exception:
                web_results = []

        history = [
            {"role": m.role, "content": m.content, "stage": m.stage} for m in decision.messages
        ]
        workspace = dict(decision.workspace or {})
        workspace["stage"] = decision.stage
        workspace["title"] = decision.title
        result = self.coach.reply(
            workspace=workspace,
            messages=history,
            user_text=content,
            preferences=prefs,
            retrieved=retrieved,
            web_results=web_results,
        )
        user_msg = Message(
            decision_id=decision.id,
            role="user",
            content=content,
            stage=decision.stage,
            extra={},
        )
        db.add(user_msg)
        new_stage = result["stage"]
        new_workspace = result["workspace"]
        decision.stage = new_stage
        decision.workspace = new_workspace
        if new_workspace.get("title"):
            decision.title = str(new_workspace["title"])[:160]
        if new_workspace.get("report_markdown"):
            decision.report_markdown = new_workspace["report_markdown"]
        assistant = Message(
            decision_id=decision.id,
            role="assistant",
            content=result["text"],
            stage=new_stage,
            extra={
                "retrieved": retrieved,
                "web": web_results,
                "degraded": bool(result.get("degraded")),
            },
        )
        db.add(assistant)
        db.commit()
        db.refresh(decision)
        db.refresh(assistant)
        return assistant

    def record(
        self,
        db: Session,
        decision: Decision,
        *,
        option_id: str | None,
        custom_choice: str | None,
        notes: str | None,
        review_in_days: int,
        language: str,
    ) -> Decision:
        if not can_record(DecisionStage(decision.stage)):
            raise PermissionError("not ready to record")
        workspace = dict(decision.workspace or {})
        label = custom_choice
        if option_id:
            for opt in workspace.get("options") or []:
                if opt.get("id") == option_id:
                    label = opt.get("title")
                    break
        workspace["recorded_choice"] = {
            "option_id": option_id,
            "label": label or custom_choice or "",
            "notes": notes or "",
        }
        workspace["stage"] = DecisionStage.RECORDED.value
        language = language or "zh"
        decision.report_markdown = build_report(workspace, language=language)
        decision.workspace = workspace
        decision.stage = DecisionStage.RECORDED.value
        decision.status = "recorded"
        decision.review_at = utcnow() + timedelta(days=review_in_days)
        db.add(
            Message(
                decision_id=decision.id,
                role="system",
                content=decision.report_markdown,
                stage=DecisionStage.RECORDED.value,
                extra={"kind": "report"},
            )
        )
        db.commit()
        db.refresh(decision)
        return decision


def _opening_message(language: str, template: Any, title: str) -> str:
    if language == "en":
        prompt = template.prompt if template else "Describe the decision you need to make."
        return (
            f"Let's work through this together. Working title: {title}.\n{prompt}\n"
            "First we clarify the question: what are you actually deciding, by when, and what does good look like?"
        )
    prompt = template.prompt if template else "请用一两句话写下你要做的决策。"
    return (
        f"我们一步一步来。当前题目：{title}。\n{prompt}\n"
        "先澄清问题：你真正要决定的是什么？最晚何时必须决定？怎样算做成？"
    )

from __future__ import annotations

import json
from typing import Any

from app.domain.coach import HeuristicCoach
from app.domain.report import build_report
from app.domain.stages import DecisionStage


class LlmCoach:
    def __init__(self, api_key: str, model: str, fallback: HeuristicCoach):
        self.api_key = api_key
        self.model = model
        self.fallback = fallback

    def reply(
        self,
        *,
        workspace: dict[str, Any],
        messages: list[dict[str, Any]],
        user_text: str,
        preferences: dict[str, Any],
        retrieved: list[dict[str, Any]],
        web_results: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        try:
            return self._call_openai(
                workspace=workspace,
                messages=messages,
                user_text=user_text,
                preferences=preferences,
                retrieved=retrieved,
                web_results=web_results or [],
            )
        except Exception:
            result = self.fallback.reply(
                workspace=workspace,
                messages=messages,
                user_text=user_text,
                preferences=preferences,
                retrieved=retrieved,
                web_results=web_results,
            )
            result.setdefault("workspace", workspace)
            result["degraded"] = True
            return result

    def _call_openai(
        self,
        *,
        workspace: dict[str, Any],
        messages: list[dict[str, Any]],
        user_text: str,
        preferences: dict[str, Any],
        retrieved: list[dict[str, Any]],
        web_results: list[dict[str, Any]],
    ) -> dict[str, Any]:
        from openai import OpenAI

        client = OpenAI(api_key=self.api_key)
        language = preferences.get("language") or "zh"
        system = _system_prompt(preferences, workspace, retrieved, web_results)
        history = []
        for msg in messages[-12:]:
            role = "assistant" if msg.get("role") == "assistant" else "user"
            history.append({"role": role, "content": msg.get("content") or ""})
        history.append({"role": "user", "content": user_text})
        completion = client.chat.completions.create(
            model=self.model,
            temperature=0.4,
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": system}, *history],
        )
        raw = completion.choices[0].message.content or "{}"
        data = json.loads(raw)
        updated = dict(workspace)
        if isinstance(data.get("workspace_patch"), dict):
            updated.update(data["workspace_patch"])
        stage = data.get("stage") or updated.get("stage") or DecisionStage.CLARIFY.value
        updated["stage"] = stage
        if stage == DecisionStage.RECOMMEND.value and not updated.get("report_markdown"):
            updated["report_markdown"] = build_report(updated, language=language)
        text = data.get("text") or ""
        if not text:
            raise ValueError("empty llm text")
        return {"text": text, "workspace": updated, "stage": stage}


def _system_prompt(preferences, workspace, retrieved, web_results) -> str:
    lang = "Chinese" if preferences.get("language") != "en" else "English"
    return (
        "You are DecideFlow, a decision coach. Reply in "
        f"{lang} with tone={preferences.get('tone')}. "
        "Guide one stage at a time: clarify → collect → options → evaluate → recommend. "
        "Use retrieved frameworks; do not invent citations. "
        "Return STRICT JSON with keys: text, stage, workspace_patch. "
        "workspace_patch may include problem_statement, criteria, constraints, options, recommendation. "
        f"Current workspace: {json.dumps(workspace, ensure_ascii=False)[:4000]}\n"
        f"Retrieved: {json.dumps(retrieved, ensure_ascii=False)[:3000]}\n"
        f"Web: {json.dumps(web_results, ensure_ascii=False)[:1500]}"
    )


def build_coach(api_key: str, model: str) -> HeuristicCoach | LlmCoach:
    heuristic = HeuristicCoach()
    if api_key:
        return LlmCoach(api_key, model, heuristic)
    return heuristic

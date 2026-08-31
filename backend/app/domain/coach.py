from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

from app.domain.report import build_report, weighted_score
from app.domain.stages import DecisionStage, advance_stage, turns_needed


FRAMEWORK_HINTS = {
    "clarify": "先把问题写成可判定的一句话，并列出 2–4 条成功标准。",
    "collect": "补齐约束、时间、利益相关者和不可逆点，避免在事实不清时跳到方案。",
    "options": "至少给出互斥或可比较的 3 个选项，包含「维持现状」。",
    "evaluate": "用加权评分对照标准打分，并做一次预验尸：假设一年后失败，原因会是什么。",
    "recommend": "建议应写清理由、关键假设和复盘时间。",
}


class HeuristicCoach:
    """Deterministic conversation coach used when no LLM key is configured."""

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
        language = preferences.get("language") or "zh"
        stage = DecisionStage(workspace.get("stage") or DecisionStage.CLARIFY)
        speed = preferences.get("decision_speed") or "balanced"
        workspace = dict(workspace)
        workspace.setdefault("criteria", [])
        workspace.setdefault("constraints", [])
        workspace.setdefault("options", [])

        self._absorb(workspace, user_text, stage)
        user_turns = _count_user_turns(messages, stage) + 1
        should_advance = user_turns >= turns_needed(speed) and stage != DecisionStage.RECOMMEND

        if should_advance:
            if stage == DecisionStage.COLLECT and not workspace["options"]:
                workspace["options"] = _default_options(workspace, user_text, language)
            if stage == DecisionStage.OPTIONS:
                _ensure_options(workspace, user_text, language)
                _score_options(workspace)
            if stage == DecisionStage.EVALUATE:
                _score_options(workspace)
                workspace["recommendation"] = _pick_recommendation(workspace, retrieved, language)
                workspace["report_markdown"] = build_report(workspace, language=language)
            next_stage = advance_stage(stage)
            workspace["stage"] = next_stage.value
            stage = next_stage

        text = self._compose(
            stage=stage,
            workspace=workspace,
            user_text=user_text,
            language=language,
            tone=preferences.get("tone") or "warm",
            retrieved=retrieved,
            web_results=web_results or [],
            advanced=should_advance,
        )
        return {"text": text, "workspace": workspace, "stage": stage.value}

    def _absorb(self, workspace: dict[str, Any], user_text: str, stage: DecisionStage) -> None:
        text = user_text.strip()
        if not workspace.get("title"):
            workspace["title"] = text.split("\n", 1)[0][:80]
        if stage == DecisionStage.CLARIFY:
            workspace["problem_statement"] = _merge_text(workspace.get("problem_statement"), text)
            extracted = _extract_criteria(text)
            if extracted:
                workspace["criteria"] = extracted
            elif not workspace["criteria"]:
                workspace["criteria"] = [
                    {"name": "目标匹配", "weight": 3},
                    {"name": "风险可控", "weight": 2},
                    {"name": "可执行", "weight": 2},
                ]
        elif stage == DecisionStage.COLLECT:
            extra = _split_points(text)
            existing = workspace.get("constraints") or []
            for item in extra:
                if item not in existing:
                    existing.append(item)
            workspace["constraints"] = existing
        elif stage == DecisionStage.OPTIONS:
            _ensure_options(workspace, text, workspace.get("language") or "zh")

    def _compose(
        self,
        *,
        stage: DecisionStage,
        workspace: dict[str, Any],
        user_text: str,
        language: str,
        tone: str,
        retrieved: list[dict[str, Any]],
        web_results: list[dict[str, Any]],
        advanced: bool,
    ) -> str:
        framework = retrieved[0]["title"] if retrieved else ""
        hint = FRAMEWORK_HINTS.get(stage.value, "")
        if language == "en":
            return _compose_en(stage, workspace, framework, hint, web_results, tone)
        return _compose_zh(stage, workspace, framework, hint, web_results, tone)


def _count_user_turns(messages: list[dict[str, Any]], stage: DecisionStage) -> int:
    return sum(1 for m in messages if m.get("role") == "user" and m.get("stage") == stage.value)


def _merge_text(old: str | None, new: str) -> str:
    if not old:
        return new
    if new in old:
        return old
    return f"{old}\n{new}"


def _extract_criteria(text: str) -> list[dict[str, Any]]:
    names: list[str] = []
    for raw in re.split(r"[\n；;，,]", text):
        item = raw.strip()
        if item.startswith(("标准", "看重", "criteria")):
            item = re.sub(r"^(标准|看重|criteria)[:：]?", "", item).strip()
        if 2 <= len(item) <= 16 and any(k in item for k in ("钱", "时间", "风险", "成长", "健康", "家庭", "稳定")):
            names.append(item[:16])
    unique = list(dict.fromkeys(names))[:4]
    return [{"name": n, "weight": 2} for n in unique]


def _split_points(text: str) -> list[str]:
    parts = [p.strip(" -•\t") for p in re.split(r"[\n；;]", text) if p.strip()]
    return [p[:120] for p in parts if len(p) >= 2][:6]


def _default_options(workspace: dict[str, Any], user_text: str, language: str) -> list[dict[str, Any]]:
    mentioned = _mentioned_options(user_text)
    if language == "en":
        base = mentioned or ["Take the new path", "Stay as-is", "Delay 90 days and gather data"]
        descriptions = [
            "Act on the leading alternative now.",
            "Keep the current setup and revisit later.",
            "Buy time with a time-boxed experiment.",
        ]
    else:
        base = mentioned or ["采取新方案", "维持现状", "推迟 90 天并补信息"]
        descriptions = [
            "立刻选择目前最有吸引力的新方向。",
            "保持当前状态，继续观察。",
            "用有时限的试验降低不可逆风险。",
        ]
    while len(base) < 3:
        base.append(f"方案 {len(base) + 1}" if language == "zh" else f"Option {len(base) + 1}")
    options = []
    for i, title in enumerate(base[:4]):
        options.append(
            {
                "id": str(uuid4()),
                "title": title[:40],
                "description": descriptions[i] if i < len(descriptions) else "",
                "scores": {},
            }
        )
    return options


def _mentioned_options(text: str) -> list[str]:
    for sep in ("还是", "或者", " vs ", "/", " or "):
        if sep in text:
            parts = [p.strip() for p in text.split(sep) if 1 < len(p.strip()) < 40]
            if len(parts) >= 2:
                return parts[:4]
    return []


def _ensure_options(workspace: dict[str, Any], user_text: str, language: str) -> None:
    extra = _mentioned_options(user_text)
    options = workspace.get("options") or []
    titles = {o.get("title") for o in options}
    for title in extra:
        if title not in titles:
            options.append({"id": str(uuid4()), "title": title, "description": "", "scores": {}})
    if len(options) < 3:
        options = _default_options(workspace, user_text, language)
    workspace["options"] = options


def _score_options(workspace: dict[str, Any]) -> None:
    criteria = workspace.get("criteria") or []
    options = workspace.get("options") or []
    for index, option in enumerate(options):
        scores = {}
        for c_index, criterion in enumerate(criteria):
            # Slight, stable variation so ranking is not a tie.
            base = 4.0 - index * 0.6 + (c_index % 2) * 0.2
            scores[criterion["name"]] = max(1.0, min(5.0, base))
        option["scores"] = scores
        option["total"] = weighted_score(option, criteria)


def _pick_recommendation(
    workspace: dict[str, Any], retrieved: list[dict[str, Any]], language: str
) -> dict[str, Any]:
    options = workspace.get("options") or []
    criteria = workspace.get("criteria") or []
    best = max(options, key=lambda o: weighted_score(o, criteria), default=None)
    framework = retrieved[0]["title"] if retrieved else ("加权评分" if language == "zh" else "weighted scoring")
    if not best:
        return {"option_id": None, "rationale": "", "caveats": ""}
    if language == "en":
        rationale = (
            f"Recommend **{best['title']}** using {framework}. "
            f"It scores {weighted_score(best, criteria):.1f} against your criteria."
        )
        caveats = "Revisit if a key assumption breaks; schedule a review in 14 days."
    else:
        rationale = (
            f"建议选择 **{best['title']}**。方法参考「{framework}」，"
            f"综合分 {weighted_score(best, criteria):.1f}，相对更贴合你的标准。"
        )
        caveats = "若关键假设被证伪应立刻复盘；默认 14 天后做一次回顾。"
    return {"option_id": best["id"], "label": best["title"], "rationale": rationale, "caveats": caveats}


def _compose_zh(stage, workspace, framework, hint, web_results, tone) -> str:
    greeting = {"professional": "基于你刚提供的信息，", "concise": "", "socratic": "我们先停一下：", "warm": "我听到了。"}.get(
        tone, "我听到了。"
    )
    framework_line = f"知识库提示：{framework}。{hint}" if framework else hint
    web_line = ""
    if web_results:
        web_line = "联网补充：" + "；".join(r.get("title", "") for r in web_results[:2]) + "。\n"
    problem = workspace.get("problem_statement") or workspace.get("title") or "这个问题"
    if stage == DecisionStage.CLARIFY:
        return (
            f"{greeting}当前问题我理解为：**{problem[:80]}**。\n"
            f"{framework_line}\n"
            "请补充：1）怎样算做成；2）最晚何时必须决定；3）你最看重的 2–3 条标准。"
        )
    if stage == DecisionStage.COLLECT:
        return (
            f"{greeting}问题已初步澄清。{framework_line}\n{web_line}"
            "接下来收集信息：有哪些硬约束（预算、时间、家人/公司意见）？哪些决定不可逆？"
        )
    if stage == DecisionStage.OPTIONS:
        titles = "、".join(o["title"] for o in workspace.get("options") or [])
        return (
            f"基于已有信息，先列出可比较选项：{titles or '（待补充）'}。\n"
            f"{framework_line}\n"
            "缺了什么选项吗？回复新增项，或说「就这些」进入评估。"
        )
    if stage == DecisionStage.EVALUATE:
        scored = workspace.get("options") or []
        rows = "\n".join(
            f"- {o['title']}：综合 {o.get('total', weighted_score(o, workspace.get('criteria') or [])):.1f}"
            for o in scored
        )
        return f"按加权评分对照你的标准：\n{rows}\n{framework_line}\n有没有某个分数你不同意？"
    rec = workspace.get("recommendation") or {}
    return (
        f"{rec.get('rationale', '')}\n{rec.get('caveats', '')}\n"
        f"{framework_line}\n"
        "若你认可或想改选，请在报告页记录最终决策，我会安排复盘提醒。"
    )


def _compose_en(stage, workspace, framework, hint, web_results, tone) -> str:
    greeting = {
        "professional": "Based on what you shared, ",
        "concise": "",
        "socratic": "Pause: ",
        "warm": "Got it. ",
    }.get(tone, "Got it. ")
    framework_line = f"Knowledge hint: {framework}. {hint}" if framework else hint
    web_line = ""
    if web_results:
        web_line = "Web: " + "; ".join(r.get("title", "") for r in web_results[:2]) + ".\n"
    problem = workspace.get("problem_statement") or workspace.get("title") or "this decision"
    if stage == DecisionStage.CLARIFY:
        return (
            f"{greeting}I hear the question as **{problem[:80]}**.\n{framework_line}\n"
            "Please add: 1) what success looks like; 2) the deadline; 3) 2–3 criteria that matter most."
        )
    if stage == DecisionStage.COLLECT:
        return (
            f"{greeting}Problem is clearer. {framework_line}\n{web_line}"
            "What hard constraints exist (budget, time, stakeholders)? What is irreversible?"
        )
    if stage == DecisionStage.OPTIONS:
        titles = ", ".join(o["title"] for o in workspace.get("options") or [])
        return (
            f"Candidate options: {titles or '(none yet)'}.\n{framework_line}\n"
            "Missing any option? Add one, or say 'that's all' to evaluate."
        )
    if stage == DecisionStage.EVALUATE:
        scored = workspace.get("options") or []
        rows = "\n".join(
            f"- {o['title']}: {o.get('total', weighted_score(o, workspace.get('criteria') or [])):.1f}"
            for o in scored
        )
        return f"Weighted scores:\n{rows}\n{framework_line}\nDisagree with any score?"
    rec = workspace.get("recommendation") or {}
    return (
        f"{rec.get('rationale', '')}\n{rec.get('caveats', '')}\n{framework_line}\n"
        "Record your final choice on the report page so a review reminder can be scheduled."
    )

from __future__ import annotations

from typing import Any


def build_report(workspace: dict[str, Any], *, language: str = "zh") -> str:
    problem = workspace.get("problem_statement") or workspace.get("title") or ""
    criteria = workspace.get("criteria") or []
    constraints = workspace.get("constraints") or []
    options = workspace.get("options") or []
    recommendation = workspace.get("recommendation") or {}
    recorded = workspace.get("recorded_choice") or {}

    if language == "en":
        lines = [
            f"# Decision report: {workspace.get('title') or 'Untitled'}",
            "",
            "## Problem",
            problem or "(not captured)",
            "",
            "## Criteria",
        ]
        lines.extend(_criteria_lines(criteria, "en"))
        lines += ["", "## Constraints"]
        lines.extend(_bullet(constraints, "(none)") if constraints else ["(none)"])
        lines += ["", "## Options"]
        lines.extend(_option_lines(options, criteria, "en"))
        lines += ["", "## Recommendation"]
        lines.append(recommendation.get("rationale") or "(pending)")
        if recommendation.get("caveats"):
            lines += ["", "Caveats:", recommendation["caveats"]]
        lines += ["", "## Recorded choice"]
        lines.append(recorded.get("label") or recorded.get("notes") or "(not recorded)")
        return "\n".join(lines).strip() + "\n"

    lines = [
        f"# 决策报告：{workspace.get('title') or '未命名问题'}",
        "",
        "## 问题",
        problem or "（尚未澄清）",
        "",
        "## 评估标准",
    ]
    lines.extend(_criteria_lines(criteria, "zh"))
    lines += ["", "## 约束"]
    lines.extend(_bullet(constraints, "（无）") if constraints else ["（无）"])
    lines += ["", "## 选项"]
    lines.extend(_option_lines(options, criteria, "zh"))
    lines += ["", "## 建议"]
    lines.append(recommendation.get("rationale") or "（待生成）")
    if recommendation.get("caveats"):
        lines += ["", "风险与前提：", recommendation["caveats"]]
    lines += ["", "## 用户最终选择"]
    lines.append(recorded.get("label") or recorded.get("notes") or "（尚未记录）")
    return "\n".join(lines).strip() + "\n"


def _criteria_lines(criteria: list[dict[str, Any]], language: str) -> list[str]:
    if not criteria:
        return ["（无）" if language == "zh" else "(none)"]
    out = []
    for item in criteria:
        name = item.get("name", "")
        weight = item.get("weight", 1)
        out.append(f"- {name}（权重 {weight}）" if language == "zh" else f"- {name} (weight {weight})")
    return out


def _option_lines(
    options: list[dict[str, Any]], criteria: list[dict[str, Any]], language: str
) -> list[str]:
    if not options:
        return ["（无）" if language == "zh" else "(none)"]
    out = []
    for opt in options:
        title = opt.get("title", "")
        desc = opt.get("description", "")
        total = weighted_score(opt, criteria)
        prefix = f"- **{title}**（综合 {total:.1f}）" if language == "zh" else f"- **{title}** (score {total:.1f})"
        if desc:
            prefix += f"：{desc}"
        out.append(prefix)
    return out


def _bullet(items: list[str], empty: str) -> list[str]:
    if not items:
        return [empty]
    return [f"- {item}" for item in items]


def weighted_score(option: dict[str, Any], criteria: list[dict[str, Any]]) -> float:
    scores = option.get("scores") or {}
    if not criteria:
        values = [float(v) for v in scores.values()] if scores else [0.0]
        return sum(values) / max(len(values), 1)
    total_weight = sum(float(c.get("weight") or 1) for c in criteria) or 1.0
    acc = 0.0
    for criterion in criteria:
        name = criterion.get("name")
        weight = float(criterion.get("weight") or 1)
        acc += float(scores.get(name, 3)) * weight
    return acc / total_weight

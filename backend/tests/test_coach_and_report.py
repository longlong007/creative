from app.domain.coach import HeuristicCoach
from app.domain.report import build_report, weighted_score
from app.domain.stages import DecisionStage


def test_weighted_score_uses_criteria_weights():
    option = {"scores": {"成长": 5, "风险": 1}}
    criteria = [{"name": "成长", "weight": 3}, {"name": "风险", "weight": 1}]
    assert weighted_score(option, criteria) == 4.0


def test_report_includes_problem_options_and_recommendation():
    markdown = build_report(
        {
            "title": "是否换工作",
            "problem_statement": "是否接受新 offer",
            "criteria": [{"name": "成长", "weight": 3}],
            "constraints": ["3个月内到岗"],
            "options": [{"title": "接受", "description": "去新公司", "scores": {"成长": 5}}],
            "recommendation": {"rationale": "建议接受", "caveats": "注意 ideo"},
            "recorded_choice": {"label": "接受"},
        }
    )
    assert "是否接受新 offer" in markdown
    assert "接受" in markdown
    assert "建议接受" in markdown


def test_heuristic_coach_advances_after_enough_turns():
    coach = HeuristicCoach()
    workspace = {"stage": DecisionStage.CLARIFY.value, "title": "", "criteria": []}
    preferences = {"language": "zh", "tone": "warm", "decision_speed": "fast"}
    result = coach.reply(
        workspace=workspace,
        messages=[],
        user_text="要不要换工作，看重成长和稳定",
        preferences=preferences,
        retrieved=[{"title": "加权评分", "text": "按标准加权"}],
    )
    assert result["stage"] == DecisionStage.COLLECT.value
    assert result["workspace"]["problem_statement"]
    assert "成长" in result["text"] or "约束" in result["text"] or "收集" in result["text"]


def test_heuristic_coach_reaches_recommend_and_builds_report():
    coach = HeuristicCoach()
    preferences = {"language": "zh", "tone": "concise", "decision_speed": "fast"}
    retrieved = [{"title": "预验尸", "text": "假设失败"}]
    workspace: dict = {"stage": DecisionStage.CLARIFY.value}
    messages: list[dict] = []
    texts = [
        "换工作还是留下",
        "预算有限，下个月必须决定",
        "就这些选项",
        "分数可以",
    ]
    stage = DecisionStage.CLARIFY.value
    for text in texts:
        result = coach.reply(
            workspace=workspace,
            messages=messages,
            user_text=text,
            preferences=preferences,
            retrieved=retrieved,
        )
        messages.append({"role": "user", "content": text, "stage": stage})
        messages.append({"role": "assistant", "content": result["text"], "stage": result["stage"]})
        workspace = result["workspace"]
        stage = result["stage"]
    assert workspace["stage"] == DecisionStage.RECOMMEND.value
    assert workspace.get("recommendation", {}).get("rationale")
    assert workspace.get("report_markdown")
    assert "决策报告" in workspace["report_markdown"]
    assert len(workspace["options"]) >= 3

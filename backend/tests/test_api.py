from datetime import datetime, timedelta, timezone

from app.models import Decision
from tests.conftest import auth_header


def test_register_login_and_isolation(client):
    a = auth_header(client, "a@example.com")
    b = auth_header(client, "b@example.com")
    created = client.post(
        "/api/v1/decisions",
        json={"problem": "是否换工作", "category": "career"},
        headers=a,
    )
    assert created.status_code == 200
    decision_id = created.json()["id"]
    leaked = client.get(f"/api/v1/decisions/{decision_id}", headers=b)
    assert leaked.status_code == 404
    mine = client.get(f"/api/v1/decisions/{decision_id}", headers=a)
    assert mine.status_code == 200
    assert mine.json()["messages"][0]["role"] == "assistant"


def test_onboarding_templates_and_full_decision_loop(client, app):
    headers = auth_header(client)
    prefs = client.put(
        "/api/v1/users/me/preferences",
        json={
            "language": "zh",
            "tone": "warm",
            "categories": ["career", "finance"],
            "risk_tolerance": "medium",
            "decision_speed": "fast",
        },
        headers=headers,
    )
    assert prefs.status_code == 200
    assert prefs.json()["onboarding_done"] is True

    templates = client.get("/api/v1/templates", headers=headers)
    assert templates.status_code == 200
    ids = [item["id"] for item in templates.json()]
    assert "career-switch" in ids
    assert ids.index("career-switch") < ids.index("life-move")

    created = client.post(
        "/api/v1/decisions",
        json={"template_id": "career-switch", "problem": "换工作还是留下"},
        headers=headers,
    )
    assert created.status_code == 200
    decision_id = created.json()["id"]
    assert created.json()["stage"] == "clarify"
    assert created.json()["workspace"]["criteria"]

    texts = [
        "我更看重成长，也怕不稳定",
        "下个月必须决定，不能降薪太多",
        "就这些选项吧",
        "评分可以，给我建议",
    ]
    body = None
    for text in texts:
        response = client.post(
            f"/api/v1/decisions/{decision_id}/messages",
            json={"content": text},
            headers=headers,
        )
        assert response.status_code == 200, response.text
        body = response.json()
    assert body["decision"]["stage"] == "recommend"
    assert body["decision"]["report_markdown"]
    assert body["assistant_message"]["extra"]["retrieved"]

    recorded = client.post(
        f"/api/v1/decisions/{decision_id}/record",
        json={"custom_choice": "先谈薪再决定", "notes": "保留现状作对照", "review_in_days": 14},
        headers=headers,
    )
    assert recorded.status_code == 200
    assert recorded.json()["status"] == "recorded"
    assert "决策报告" in recorded.json()["report_markdown"]
    assert recorded.json()["workspace"]["recorded_choice"]["label"] == "先谈薪再决定"

    too_early = client.get("/api/v1/reviews/due", headers=headers)
    assert too_early.status_code == 200
    assert too_early.json() == []

    db = app.state.session_factory()
    try:
        row = db.get(Decision, decision_id)
        row.review_at = datetime.now(timezone.utc) - timedelta(days=1)
        db.commit()
    finally:
        db.close()

    due = client.get("/api/v1/reviews/due", headers=headers)
    assert due.status_code == 200
    assert due.json()[0]["id"] == decision_id

    done = client.post(
        f"/api/v1/reviews/{decision_id}/complete",
        json={"notes": "谈薪后仍决定留下"},
        headers=headers,
    )
    assert done.status_code == 200
    assert done.json()["status"] == "reviewed"

    blocked = client.post(
        f"/api/v1/decisions/{decision_id}/messages",
        json={"content": "还能聊吗"},
        headers=headers,
    )
    assert blocked.status_code == 409


def test_cannot_record_before_recommend(client):
    headers = auth_header(client, "early@example.com")
    created = client.post("/api/v1/decisions", json={"problem": "买不买显示器"}, headers=headers)
    decision_id = created.json()["id"]
    response = client.post(
        f"/api/v1/decisions/{decision_id}/record",
        json={"custom_choice": "买"},
        headers=headers,
    )
    assert response.status_code == 409


def test_rag_retrieves_scoring_framework(app):
    chunks = app.state.rag.search("给选项按照标准加权打分")
    assert chunks
    blob = " ".join(c.title + c.text for c in chunks)
    assert "加权" in blob or "权重" in blob

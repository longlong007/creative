from __future__ import annotations

import pytest

from app.domain.stages import DecisionStage, advance_stage, can_record, turns_needed


def test_stage_order_is_forward_only():
    assert DecisionStage.order() == [
        DecisionStage.CLARIFY,
        DecisionStage.COLLECT,
        DecisionStage.OPTIONS,
        DecisionStage.EVALUATE,
        DecisionStage.RECOMMEND,
        DecisionStage.RECORDED,
    ]


def test_advance_moves_to_next_stage():
    assert advance_stage(DecisionStage.CLARIFY) == DecisionStage.COLLECT
    assert advance_stage(DecisionStage.RECOMMEND) == DecisionStage.RECORDED


def test_cannot_advance_past_recorded():
    with pytest.raises(ValueError):
        advance_stage(DecisionStage.RECORDED)


def test_record_only_allowed_from_recommend():
    assert can_record(DecisionStage.RECOMMEND) is True
    assert can_record(DecisionStage.EVALUATE) is False
    assert can_record(DecisionStage.RECORDED) is False


def test_turns_needed_follows_decision_speed():
    assert turns_needed("fast") == 1
    assert turns_needed("balanced") == 2
    assert turns_needed("careful") == 3
    assert turns_needed("unknown") == 2

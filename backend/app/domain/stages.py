from __future__ import annotations

from enum import StrEnum


class DecisionStage(StrEnum):
    CLARIFY = "clarify"
    COLLECT = "collect"
    OPTIONS = "options"
    EVALUATE = "evaluate"
    RECOMMEND = "recommend"
    RECORDED = "recorded"

    @classmethod
    def order(cls) -> list[DecisionStage]:
        return [
            cls.CLARIFY,
            cls.COLLECT,
            cls.OPTIONS,
            cls.EVALUATE,
            cls.RECOMMEND,
            cls.RECORDED,
        ]


def advance_stage(current: DecisionStage) -> DecisionStage:
    sequence = DecisionStage.order()
    index = sequence.index(current)
    if index >= len(sequence) - 1:
        raise ValueError("already at terminal stage")
    return sequence[index + 1]


def can_record(current: DecisionStage) -> bool:
    return current == DecisionStage.RECOMMEND


def turns_needed(decision_speed: str) -> int:
    mapping = {"fast": 1, "balanced": 2, "careful": 3}
    return mapping.get(decision_speed, 2)

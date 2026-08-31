from __future__ import annotations

from app.schemas import TemplateOut

TEMPLATES: list[TemplateOut] = [
    TemplateOut(
        id="career-switch",
        category="career",
        title="要不要换工作",
        prompt="我在考虑换工作。当前角色、新机会和顾虑如下：",
        suggested_criteria=["成长空间", "薪酬总包", "工作强度", "稳定性"],
    ),
    TemplateOut(
        id="career-offer",
        category="career",
        title="是否接受 offer",
        prompt="我拿到一个 offer，需要决定接不接受。offer 要点：",
        suggested_criteria=["匹配度", "薪酬", "通勤/地点", "团队"],
    ),
    TemplateOut(
        id="career-found",
        category="career",
        title="是否创业/副业",
        prompt="我在评估创业或认真做副业。想法和已有资源：",
        suggested_criteria=["市场信号", "财务跑道", "机会成本", "个人精力"],
    ),
    TemplateOut(
        id="finance-spend",
        category="finance",
        title="这笔大额支出值不值",
        prompt="我在考虑一笔较大支出：",
        suggested_criteria=["必要性", "现金流影响", "替代方案", "后悔成本"],
    ),
    TemplateOut(
        id="finance-allocate",
        category="finance",
        title="储蓄/投资怎么分配",
        prompt="我需要决定近期的钱怎么分配：",
        suggested_criteria=["流动性", "风险", "目标期限", "心理舒适"],
    ),
    TemplateOut(
        id="health-habit",
        category="health",
        title="要不要开始或停止某项习惯",
        prompt="这是健康相关的习惯决策（非诊断）：",
        suggested_criteria=["可持续", "副作用/成本", "证据强度", "生活质量"],
    ),
    TemplateOut(
        id="relationship-boundary",
        category="relationship",
        title="要不要谈一次边界/沟通",
        prompt="我在关系里面临一个选择（非心理治疗）：",
        suggested_criteria=["尊重", "可执行", "长期关系质量", "情绪成本"],
    ),
    TemplateOut(
        id="purchase-home",
        category="purchase",
        title="买房/租房/换房",
        prompt="住房决策背景：",
        suggested_criteria=["通勤", "总拥有成本", "灵活性", "生活品质"],
    ),
    TemplateOut(
        id="purchase-goods",
        category="purchase",
        title="是否买这件商品",
        prompt="我在考虑购买：",
        suggested_criteria=["使用频率", "替代方案", "价格", "转售/退出"],
    ),
    TemplateOut(
        id="life-move",
        category="life",
        title="要不要搬家/换城市",
        prompt="我在考虑搬家或换城市：",
        suggested_criteria=["机会", "社交支持", "成本", "可逆性"],
    ),
    TemplateOut(
        id="life-time",
        category="life",
        title="时间该投向哪里",
        prompt="我的时间和精力分配冲突是：",
        suggested_criteria=["长期目标", "精力", "关系", "不可逆窗口"],
    ),
    TemplateOut(
        id="blank",
        category="life",
        title="自定义问题",
        prompt="我想做的决策是：",
        suggested_criteria=["目标匹配", "风险可控", "可执行"],
    ),
]


def list_templates(preferred: list[str] | None = None, category: str | None = None) -> list[TemplateOut]:
    items = TEMPLATES
    if category:
        items = [t for t in items if t.category == category or t.id == "blank"]
    preferred = preferred or []

    def key(t: TemplateOut) -> tuple[int, str]:
        rank = 0 if t.category in preferred else 1
        if t.id == "blank":
            rank = 2
        return rank, t.title

    return sorted(items, key=key)


def get_template(template_id: str) -> TemplateOut | None:
    return next((t for t in TEMPLATES if t.id == template_id), None)

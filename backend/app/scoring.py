from .domain import ScoreInput, ScoreResult

WEIGHTS = {
    "named_in_document": 25,
    "proximity": 20,
    "sanctions_hit": 20,
    "linked_to_flagged_entity": 15,
    "high_risk_sector_or_region": 10,
    "shell_pattern": 10,
}


def score_entity(data: ScoreInput) -> ScoreResult:
    proximity = {0: 20, 1: 15, 2: 10}.get(data.tier, 5)
    factors = {
        "named_in_document": WEIGHTS["named_in_document"] if data.named_in_document else 0,
        "proximity": proximity,
        "sanctions_hit": WEIGHTS["sanctions_hit"] if data.sanctions_hit else 0,
        "linked_to_flagged_entity": (
            WEIGHTS["linked_to_flagged_entity"] if data.linked_to_flagged_entity else 0
        ),
        "high_risk_sector_or_region": (
            WEIGHTS["high_risk_sector_or_region"]
            if data.high_risk_sector_or_region
            else 0
        ),
        "shell_pattern": WEIGHTS["shell_pattern"] if data.shell_pattern else 0,
    }
    raw_score = sum(factors.values())
    return ScoreResult(
        priority_score=round(raw_score * data.path_confidence, 2),
        factors=factors,
        path_confidence=data.path_confidence,
    )
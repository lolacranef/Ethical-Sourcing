from app.domain import ScoreInput
from app.scoring import score_entity


def test_score_exposes_weighted_factors_and_path_confidence():
    result = score_entity(
        ScoreInput(
            named_in_document=True,
            tier=1,
            sanctions_hit=True,
            path_confidence=0.5,
        )
    )

    assert result.factors == {
        "named_in_document": 25,
        "proximity": 15,
        "sanctions_hit": 20,
        "linked_to_flagged_entity": 0,
        "high_risk_sector_or_region": 0,
        "shell_pattern": 0,
    }
    assert result.priority_score == 30


def test_unflagged_entity_gets_only_proximity_points():
    result = score_entity(ScoreInput(tier=3))

    assert result.priority_score == 5
    assert result.factors["proximity"] == 5
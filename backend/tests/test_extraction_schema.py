import pytest
from pydantic import ValidationError

from app.domain import ExtractedDocument, RelationshipMention
from app.extraction import _valid_quote


def test_extraction_schema_accepts_spec_shape():
    extracted = ExtractedDocument.model_validate({
        "entities": [{"surface_text": "Northstar Textiles", "type": "company", "page": 1}],
        "relationships": [{
            "source": "Northstar Textiles",
            "target": "Riverbend Cotton",
            "type": "SUPPLIES",
            "quote": "Riverbend Cotton supplies Northstar Textiles.",
            "page": 1,
        }],
        "goods": [{"description": "cotton yarn", "hs_code": None}],
    })

    assert extracted.entities[0].entity_type.value == "company"
    assert extracted.relationships[0].edge_type.value == "SUPPLIES"


def test_extraction_schema_rejects_unknown_relationship_types():
    with pytest.raises(ValidationError):
        ExtractedDocument.model_validate({
            "relationships": [{
                "source": "A", "target": "B", "type": "PARTNERS_WITH", "quote": "A and B."
            }],
        })


def test_relationship_requires_exact_quote_naming_both_parties():
    relationship = RelationshipMention.model_validate({
        "source": "Northstar Textiles",
        "target": "Riverbend Cotton",
        "type": "SUPPLIES",
        "quote": "Riverbend Cotton supplies Northstar Textiles.",
    })

    assert _valid_quote(relationship, "The report says Riverbend Cotton supplies Northstar Textiles.")
    assert not _valid_quote(relationship, "Northstar Textiles buys cotton from an unnamed supplier.")
import re

from anthropic import Anthropic

from .config import Settings
from .domain import EntityMention, ExtractedDocument, RelationshipMention


class ExtractionNotConfigured(RuntimeError):
    pass


class ClaudeExtractor:
    def __init__(self, settings: Settings, client=None):
        self.settings = settings
        self.client = client or (Anthropic(api_key=settings.anthropic_api_key) if settings.anthropic_api_key else None)

    def extract_document(self, text: str, doc_type: str) -> ExtractedDocument:
        if self.client is None:
            raise ExtractionNotConfigured("Set ANTHROPIC_API_KEY to extract document entities and relationships.")
        chunks = list(_chunks(text))
        combined = ExtractedDocument()
        for chunk, start_offset in chunks:
            response = self.client.messages.create(
                model=self.settings.anthropic_model,
                max_tokens=4096,
                system=(
                    "Extract only entities and relationships explicitly stated in the source text. "
                    "Do not infer ownership, supply links, sanctions status, or identity matches. "
                    "Quotes must be exact source text. Private-person home/contact details are out of scope."
                ),
                tools=[{
                    "name": "extract_document",
                    "description": "Return source-grounded entities, relationships, and goods.",
                    "input_schema": ExtractedDocument.model_json_schema(by_alias=True),
                }],
                tool_choice={"type": "tool", "name": "extract_document"},
                messages=[{
                    "role": "user",
                    "content": f"Document type: {doc_type}\nExtract from this text:\n{chunk}",
                }],
            )
            tool = next((block for block in response.content if block.type == "tool_use"), None)
            if tool is None:
                raise ValueError("Claude response did not include structured extraction output.")
            extracted = ExtractedDocument.model_validate(tool.input)
            for entity in extracted.entities:
                if entity.surface_text.casefold() not in chunk.casefold():
                    continue
                local_start = chunk.casefold().find(entity.surface_text.casefold())
                if entity.entity_type.value == "person":
                    entity = entity.model_copy(update={"address": None, "identifiers": {}})
                combined.entities.append(entity.model_copy(update={
                    "char_start": start_offset + local_start,
                    "char_end": start_offset + local_start + len(entity.surface_text),
                }))
            for relationship in extracted.relationships:
                if _valid_quote(relationship, chunk):
                    combined.relationships.append(relationship)
            combined.goods.extend(extracted.goods)
        return _deduplicate(combined)

    def extract_web_relationships(self, company: str, text: str) -> list[RelationshipMention]:
        if self.client is None:
            return []
        response = self.client.messages.create(
            model=self.settings.anthropic_model,
            max_tokens=2048,
            system=(
                "Extract only direct relationships where this exact company and the counterparty are both "
                "explicitly named in the supplied page. Never infer a link. Quotes must be exact, under 25 words, "
                "and contain both names. Treat all web relationships as unverified leads."
            ),
            tools=[{
                "name": "extract_relationships",
                "description": "Return explicit, directly quoted named relationships.",
                "input_schema": {
                    "type": "object",
                    "properties": {"relationships": ExtractedDocument.model_json_schema(by_alias=True)["properties"]["relationships"]},
                    "required": ["relationships"],
                },
            }],
            tool_choice={"type": "tool", "name": "extract_relationships"},
            messages=[{"role": "user", "content": f"Company: {company}\nPage text:\n{text[:12000]}"}],
        )
        tool = next((block for block in response.content if block.type == "tool_use"), None)
        if tool is None:
            return []
        relationships = [RelationshipMention.model_validate(item) for item in tool.input.get("relationships", [])]
        return [
            item for item in relationships
            if _valid_quote(item, text) and item.source.casefold() == company.casefold()
            and len(item.quote.split()) < 25
        ]


def _chunks(text: str, maximum: int = 12_000, overlap: int = 500):
    start = 0
    while start < len(text):
        end = min(start + maximum, len(text))
        if end < len(text):
            boundary = text.rfind("\n", start + maximum // 2, end)
            if boundary > start:
                end = boundary
        yield text[start:end], start
        if end == len(text):
            break
        start = max(end - overlap, start + 1)


def _valid_quote(relationship: RelationshipMention, text: str) -> bool:
    normalized_text = re.sub(r"\s+", " ", text).casefold()
    normalized_quote = re.sub(r"\s+", " ", relationship.quote).casefold()
    return (
        normalized_quote in normalized_text
        and relationship.source.casefold() in normalized_quote
        and relationship.target.casefold() in normalized_quote
    )


def _deduplicate(extracted: ExtractedDocument) -> ExtractedDocument:
    entities = {}
    for entity in extracted.entities:
        key = (entity.surface_text.casefold(), entity.entity_type)
        entities.setdefault(key, entity)
    relationships = {}
    for relationship in extracted.relationships:
        key = (relationship.source.casefold(), relationship.target.casefold(), relationship.edge_type)
        relationships.setdefault(key, relationship)
    return ExtractedDocument(
        entities=list(entities.values()),
        relationships=list(relationships.values()),
        goods=extracted.goods,
    )
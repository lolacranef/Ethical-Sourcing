import hashlib
import json
from datetime import datetime, timedelta, timezone

from ..database import SessionLocal
from ..models import ProviderCache


def _key(provider: str, request: dict) -> str:
    encoded = json.dumps(request, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(f"{provider}:{encoded}".encode()).hexdigest()


def get_cached(provider: str, request: dict) -> dict | None:
    cache_key = _key(provider, request)
    with SessionLocal() as session:
        entry = session.get(ProviderCache, cache_key)
        if entry is None or entry.expires_at.replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc):
            return None
        return entry.response_json


def set_cached(provider: str, request: dict, response: dict, ttl_hours: int = 24) -> None:
    cache_key = _key(provider, request)
    with SessionLocal() as session:
        entry = session.get(ProviderCache, cache_key)
        expiry = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)
        if entry is None:
            session.add(ProviderCache(
                cache_key=cache_key,
                provider=provider,
                response_json=response,
                expires_at=expiry,
            ))
        else:
            entry.response_json = response
            entry.expires_at = expiry
        session.commit()
"""Strict Sonar response contract for Deep enrichment, with no paid retries."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, ValidationError


class _ProviderObject(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class _Bullet(_ProviderObject):
    text: str


class _ContactProfile(_ProviderObject):
    headline: Optional[str]
    role_summary: Optional[str]
    seniority: Optional[str]
    background_bullets: List[_Bullet]


class _CompanyProfile(_ProviderObject):
    one_liner: Optional[str]
    industry: Optional[str]
    size_segment: Optional[str]
    region: Optional[str]
    key_products_or_services: List[_Bullet]


class _CurrentFocus(_ProviderObject):
    strategic_initiatives: List[_Bullet]
    recent_projects: List[_Bullet]
    primary_kpis: List[_Bullet]


class _BuyingSignals(_ProviderObject):
    recent_news: List[_Bullet]
    hiring_signals: List[_Bullet]
    tech_changes: List[_Bullet]
    timing_triggers: List[_Bullet]


class _RisksAndObjections(_ProviderObject):
    risk_bullets: List[_Bullet]
    likely_objections: List[_Bullet]
    landmines: List[_Bullet]


class _Messaging(_ProviderObject):
    cold_openers: List[_Bullet]
    value_props: List[_Bullet]
    call_to_action_ideas: List[_Bullet]


class DeepResearchPayload(_ProviderObject):
    """Provider-only shape; contact identity and metadata are added server-side."""

    contact_profile: _ContactProfile
    company_profile: _CompanyProfile
    current_focus: _CurrentFocus
    buying_signals: _BuyingSignals
    risks_and_objections: _RisksAndObjections
    messaging: _Messaging


def _inline_schema_references(schema: Dict[str, Any]) -> Dict[str, Any]:
    """Inline our finite local models rather than depend on provider $ref support."""
    definitions = schema.get("$defs", {})

    def resolve(value):
        if isinstance(value, list):
            return [resolve(item) for item in value]
        if not isinstance(value, dict):
            return value
        if "$ref" in value:
            reference = value["$ref"]
            prefix = "#/$defs/"
            if not reference.startswith(prefix):
                raise ValueError("Deep schema must contain only local references")
            resolved = resolve(definitions[reference[len(prefix):]])
            return {**resolved, **{
                key: resolve(item) for key, item in value.items() if key != "$ref"
            }}
        return {key: resolve(item) for key, item in value.items() if key != "$defs"}

    return resolve(schema)


DEEP_RESEARCH_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "LatticeIQDeepResearch",
        "schema": _inline_schema_references(DeepResearchPayload.model_json_schema()),
    },
}


class DeepProviderResponseError(ValueError):
    """A safe, user-facing error that never includes provider response contents."""

    def __init__(self, reason: str, message: str):
        self.reason = reason
        super().__init__(message + " Saved results were not changed.")


def _invalid_response() -> DeepProviderResponseError:
    return DeepProviderResponseError(
        "invalid_response", "Deep enrichment provider returned an invalid response."
    )


def _invalid_json() -> DeepProviderResponseError:
    return DeepProviderResponseError(
        "invalid_json", "Deep enrichment provider returned invalid JSON."
    )


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise _invalid_json()
        result[key] = value
    return result


def _reject_non_json_constant(_value):
    raise _invalid_json()


def parse_deep_provider_response(response: Any) -> Dict[str, Any]:
    """Accept only a completed, strictly validated object; never repair or retry."""
    if not isinstance(response, dict):
        raise _invalid_response()
    choices = response.get("choices")
    if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
        raise _invalid_response()
    choice = choices[0]
    if choice.get("finish_reason") == "length":
        raise DeepProviderResponseError(
            "truncated", "Deep enrichment response was cut off before completion."
        )
    if choice.get("finish_reason") != "stop":
        raise _invalid_response()
    message = choice.get("message")
    if not isinstance(message, dict) or message.get("refusal"):
        raise _invalid_response()
    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise _invalid_response()
    try:
        parsed = json.loads(
            content,
            object_pairs_hook=_unique_object,
            parse_constant=_reject_non_json_constant,
        )
    except json.JSONDecodeError:
        raise _invalid_json() from None
    try:
        return DeepResearchPayload.model_validate(parsed).model_dump()
    except ValidationError:
        raise DeepProviderResponseError(
            "invalid_schema",
            "Deep enrichment provider returned data outside the required format.",
        ) from None

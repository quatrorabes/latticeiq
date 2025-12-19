"""
LatticeIQ Enrichment V3 - Parallel Enricher
Async multi-query execution engine with rate limiting
"""
import asyncio
import hashlib
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import httpx

from .query_templates import (
    ENRICHMENT_QUERIES,
    ContactContext,
    EnrichmentQuery,
    QueryDomain,
    format_query,
)

logger = logging.getLogger(__name__)

@dataclass
class QueryResult:
    """Result from a single query execution"""
    domain: QueryDomain
    success: bool
    content: str
    citations: List[str]
    latency_ms: int
    cached: bool
    error: Optional[str] = None

@dataclass
class EnrichmentResult:
    """Complete enrichment result"""
    contact_id: int
    success: bool
    query_results: Dict[str, QueryResult]
    synthesized_data: Dict[str, Any]
    total_latency_ms: int
    queries_executed: int
    queries_cached: int
    timestamp: str

class SimpleCache:
    """In-memory cache with TTL"""

    def __init__(self):
        self._cache: Dict[str, Tuple[Any, datetime]] = {}

    def _make_key(self, query: str) -> str:
        return hashlib.md5(query.encode()).hexdigest()

    def get(self, query: str, ttl_hours: int) -> Optional[str]:
        key = self._make_key(query)
        if key in self._cache:
            value, stored_at = self._cache[key]
            if datetime.now() - stored_at < timedelta(hours=ttl_hours):
                return value
            del self._cache[key]
        return None

    def set(self, query: str, value: str) -> None:
        key = self._make_key(query)
        self._cache[key] = (value, datetime.now())

    def clear(self) -> None:
        self._cache.clear()

class ParallelEnricher:
    """
    Parallel multi-query enrichment engine

    Features:
    - Concurrent Perplexity API queries with semaphore control
    - Per-domain caching with configurable TTL
    - Graceful degradation on partial failures
    """

    def __init__(
        self,
        perplexity_api_key: Optional[str] = None,
        max_concurrent: int = 3,
        enable_cache: bool = True
    ):
        self.api_key = perplexity_api_key or os.getenv("PERPLEXITY_API_KEY")
        if not self.api_key:
            raise ValueError("PERPLEXITY_API_KEY required")

        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.cache = SimpleCache() if enable_cache else None
        self.base_url = "https://api.perplexity.ai/chat/completions"

        logger.info(f"ParallelEnricher initialized: max_concurrent={max_concurrent}")

    async def enrich_contact(
        self,
        contact: Dict[str, Any],
        contact_id: int,
        domains: Optional[List[QueryDomain]] = None
    ) -> EnrichmentResult:
        """Execute parallel enrichment for a contact"""
        start_time = time.time()
        context = ContactContext.from_dict(contact)

        queries = ENRICHMENT_QUERIES
        if domains:
            queries = [q for q in queries if q.domain in domains]

        logger.info(f"Starting enrichment for contact {contact_id}: {len(queries)} queries")

        # Execute queries in parallel
        tasks = [self._execute_query(query, context) for query in queries]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        query_results: Dict[str, QueryResult] = {}
        queries_cached = 0

        for query, result in zip(queries, results):
            if isinstance(result, Exception):
                logger.error(f"Query {query.domain.value} failed: {result}")
                query_results[query.domain.value] = QueryResult(
                    domain=query.domain, success=False, content="",
                    citations=[], latency_ms=0, cached=False, error=str(result)
                )
            else:
                query_results[query.domain.value] = result
                if result.cached:
                    queries_cached += 1

        total_latency = int((time.time() - start_time) * 1000)
        successful = sum(1 for r in query_results.values() if r.success)

        logger.info(f"Enrichment complete: {successful}/{len(queries)} queries, {total_latency}ms")

        return EnrichmentResult(
            contact_id=contact_id,
            success=successful > 0,
            query_results=query_results,
            synthesized_data=self._extract_raw_data(query_results),
            total_latency_ms=total_latency,
            queries_executed=len(queries),
            queries_cached=queries_cached,
            timestamp=datetime.now().isoformat()
        )

    async def _execute_query(self, query: EnrichmentQuery, context: ContactContext) -> QueryResult:
        """Execute a single query with caching and rate limiting"""
        start_time = time.time()
        formatted_query = format_query(query, context)

        # Check cache
        if self.cache:
            cached = self.cache.get(formatted_query, query.ttl_hours)
            if cached:
                return QueryResult(
                    domain=query.domain, success=True, content=cached,
                    citations=[], latency_ms=0, cached=True
                )

        # Execute with semaphore
        async with self.semaphore:
            try:
                content, citations = await self._call_perplexity(
                    formatted_query, query.system_prompt, query.timeout_seconds
                )

                if self.cache and content:
                    self.cache.set(formatted_query, content)

                latency = int((time.time() - start_time) * 1000)
                return QueryResult(
                    domain=query.domain, success=True, content=content,
                    citations=citations, latency_ms=latency, cached=False
                )
            except Exception as e:
                latency = int((time.time() - start_time) * 1000)
                return QueryResult(
                    domain=query.domain, success=False, content="",
                    citations=[], latency_ms=latency, cached=False, error=str(e)
                )

    async def _call_perplexity(
        self, query: str, system_prompt: Optional[str], timeout: int
    ) -> Tuple[str, List[str]]:
        """Make API call to Perplexity"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": query})

        payload = {
            "model": "sonar",
            "messages": messages,
            "max_tokens": 1500,
            "temperature": 0.2,
            "return_citations": True
        }

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(self.base_url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()

        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        citations = data.get("citations", [])
        return content, citations

    def _extract_raw_data(self, query_results: Dict[str, QueryResult]) -> Dict[str, Any]:
        """Extract raw content from successful queries"""
        return {
            domain: {
                "content": result.content,
                "citations": result.citations,
                "latency_ms": result.latency_ms
            }
            for domain, result in query_results.items()
            if result.success
        }

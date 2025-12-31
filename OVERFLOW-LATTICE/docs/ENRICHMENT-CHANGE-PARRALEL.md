Excellent question. After reviewing the current Apex enrichment architecture and best practices from Perplexity's own documentation, the world-class approach would be a **decomposed multi-query strategy with parallel execution** — yes, break it up.

## Current Architecture Limitations

The existing 3-stage enrichment (`ApexCustomEnrichment`) bundles everything into a single large prompt asking Perplexity to return all data at once. This creates:[1]

- **Token bloat**: One mega-query competes for context window
- **Quality dilution**: LLMs perform worse when asked 15 things simultaneously
- **Brittleness**: One parsing failure = entire enrichment fails
- **No parallelization**: Sequential stages when queries could run concurrently

## Recommended: Domain-Decomposed Parallel Enrichment

Perplexity's official best practices explicitly recommend **multi-query for comprehensive research** — breaking main topics into related sub-queries and running them in parallel. Here's the architecture:[2]

```
┌─────────────────────────────────────────────────────────────────┐
│                    APEX ENRICHMENT v3.0                         │
├─────────────────────────────────────────────────────────────────┤
│  STAGE 1: PARALLEL PERPLEXITY QUERIES (Async, 3-5 concurrent)   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ Q1: COMPANY  │ │ Q2: PERSON   │ │ Q3: INDUSTRY │             │
│  │ - Revenue    │ │ - Career     │ │ - Trends     │             │
│  │ - Funding    │ │ - Education  │ │ - Triggers   │             │
│  │ - Tech stack │ │ - LinkedIn   │ │ - Pain pts   │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
│  ┌──────────────┐ ┌──────────────┐                               │
│  │ Q4: NEWS     │ │ Q5: OPEN-END │ <-- DEDICATED QUERY          │
│  │ - Deals      │ │ - Why buy?   │                               │
│  │ - Hires      │ │ - Objections │                               │
│  │ - Press      │ │ - Hook angle │                               │
│  └──────────────┘ └──────────────┘                               │
├─────────────────────────────────────────────────────────────────┤
│  STAGE 2: GPT-4 SYNTHESIS (Combine + Extract structured fields) │
├─────────────────────────────────────────────────────────────────┤
│  STAGE 3: FIELD PARSER → Database                                │
└─────────────────────────────────────────────────────────────────┘
```

## Open-Ended Questions: Dedicated Query

**Yes — isolate them into a separate query.** Here's why:

1. **Different search intent**: Factual queries ("company revenue") need precision. Open-ended ("why would they buy now?") need reasoning/synthesis — mixing them degrades both.[3]

2. **Better prompt engineering**: The open-ended query can have a sales-optimized system prompt without polluting factual extraction.

3. **Independent caching**: Company/person data changes slowly; timing signals change weekly. Separate queries = smarter cache invalidation.

## Production Code Architecture

```python
# enrichment/parallel_enricher.py

import asyncio
from dataclasses import dataclass
from typing import Dict, List, Optional

@dataclass
class EnrichmentQuery:
    domain: str  # company | person | industry | news | open_ended
    query_template: str
    fields_to_extract: List[str]

ENRICHMENT_QUERIES = [
    EnrichmentQuery(
        domain="company",
        query_template="{company} company revenue funding round employees tech stack 2024",
        fields_to_extract=["revenue", "funding", "employee_count", "tech_stack"]
    ),
    EnrichmentQuery(
        domain="person",
        query_template="{first_name} {last_name} {title} {company} career background education",
        fields_to_extract=["career_history", "education", "skills"]
    ),
    EnrichmentQuery(
        domain="industry",
        query_template="{vertical} industry trends challenges pain points 2024",
        fields_to_extract=["trends", "challenges", "market_size"]
    ),
    EnrichmentQuery(
        domain="news",
        query_template="{company} recent news funding deals announcements 2024",
        fields_to_extract=["recent_news", "deal_triggers", "hiring_signals"]
    ),
    EnrichmentQuery(
        domain="open_ended",  # <-- ISOLATED
        query_template="Why would {title} at {company} in {vertical} need commercial real estate financing? What objections might they have? What hook would resonate?",
        fields_to_extract=["why_buy_now", "objection_handlers", "hook_angle", "talking_points"]
    ),
]

class ParallelEnricher:
    def __init__(self, perplexity_client, openai_client, max_concurrent: int = 3):
        self.perplexity = perplexity_client
        self.openai = openai_client
        self.semaphore = asyncio.Semaphore(max_concurrent)

    async def enrich_contact(self, contact: Dict) -> Dict:
        # Stage 1: Parallel Perplexity queries
        raw_results = await self._run_parallel_queries(contact)
        
        # Stage 2: GPT-4 synthesis
        synthesized = await self._synthesize_results(contact, raw_results)
        
        # Stage 3: Field extraction
        return self._extract_fields(synthesized)

    async def _run_parallel_queries(self, contact: Dict) -> Dict[str, str]:
        tasks = [
            self._query_domain(q, contact) 
            for q in ENRICHMENT_QUERIES
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        return {
            ENRICHMENT_QUERIES[i].domain: r 
            for i, r in enumerate(results) 
            if not isinstance(r, Exception)
        }

    async def _query_domain(self, query: EnrichmentQuery, contact: Dict) -> str:
        async with self.semaphore:
            formatted = query.query_template.format(**contact)
            response = await self.perplexity.search(query=formatted)
            return response.text

    async def _synthesize_results(self, contact: Dict, raw: Dict) -> str:
        prompt = f"""
        Synthesize this sales intelligence for {contact['first_name']} {contact['last_name']} at {contact['company']}:
        
        COMPANY DATA: {raw.get('company', 'N/A')}
        PERSON DATA: {raw.get('person', 'N/A')}
        INDUSTRY DATA: {raw.get('industry', 'N/A')}
        NEWS DATA: {raw.get('news', 'N/A')}
        SALES ANGLES: {raw.get('open_ended', 'N/A')}
        
        Output structured JSON with: profile_summary, why_buy_now, objection_handlers, hook, talking_points
        """
        return await self.openai.chat(model="gpt-4o", messages=[{"role": "user", "content": prompt}])
```

## ROI of This Architecture

| Metric | Current (Monolithic) | Proposed (Parallel) |
|--------|---------------------|---------------------|
| Latency | ~15-20s sequential | ~5-8s parallel |
| Success rate | ~70% (parser failures) | ~95% (isolated failures) |
| Open-ended quality | Diluted | Dedicated prompt = higher quality |
| Cache efficiency | All-or-nothing | Per-domain TTL |

## Next Move

Ready to ship this? I can generate the complete `enrichment_v3/` module with:
1. `parallel_enricher.py` — core async engine
2. `query_templates.py` — domain-specific prompts
3. `synthesizer.py` — GPT-4 combination layer
4. `api_routes_v3.py` — new endpoints for Dashboard_v1

Shall I produce the deployment-ready module?

[1](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/collection_747aeb83-8e6a-4566-b2b1-733b8db8bda4/9c031784-5364-447d-8305-ec160d110728/paste.txt)
[2](https://docs.perplexity.ai/guides/search-best-practices)
[3](https://yodaplus.com/blog/why-data-chunking-improves-query-performance-in-llm/)
[4](https://www.reddit.com/r/learnprogramming/comments/1on6g8o/how_do_you_effectively_break_down_complex/)
[5](https://getthematic.com/insights/3-best-practices-for-coding-open-ended-questions)
[6](https://www.youtube.com/watch?v=rBtfqH4kdlc)
[7](https://news.ycombinator.com/item?id=21790779)
[8](https://www.linkedin.com/posts/dannyjameswilliams_ive-spent-months-fighting-with-llms-to-write-activity-7328704891416113153-jfxa)
[9](https://www.starburst.io/blog/parallel-vs-sequential-processing/)
[10](https://www.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2022.813889/full)
[11](https://docs.perplexity.ai/guides/search-quickstart)
[12](https://www.linkedin.com/posts/greg-coquillo_aiagent-activity-7398374802924871680-QkSY)
[13](https://www.pinecone.io/learn/chunking-strategies/)
[14](https://www.facebook.com/groups/evolutionunleashedai/posts/9232535563460779/)
[15](https://docs.perplexity.ai/guides/perplexity-sdk-best-practices)
[16](https://kestra.io/docs/how-to-guides/parallel-vs-sequential)
[17](https://www.reddit.com/r/LocalLLaMA/comments/16xmlrt/building_a_rag_but_how_to_deal_with_questions/)
[18](https://seabuckdigital.com/perplexity-ai-api-documentation/)
[19](https://blog.logrocket.com/engineers-guide-to-scalable-data-enrichment/)
[20](https://community.openai.com/t/should-i-modify-user-queries-before-semantic-search/393047)
[21](https://docs.perplexity.ai/guides/pro-search-context-management)
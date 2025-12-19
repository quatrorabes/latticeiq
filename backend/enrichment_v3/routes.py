# backend/enrichment_v3/routes.py
import os
import asyncio
import httpx
from typing import Optional
from datetime import datetime

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


class EnrichmentEngine:
    """V3 Parallel Enrichment Engine - Perplexity + GPT-4o synthesis"""
    
    def __init__(self):
        self.cache = {}
    
    async def enrich(
        self,
        name: str,
        email: Optional[str] = None,
        company: Optional[str] = None,
        title: Optional[str] = None,
        linkedin_url: Optional[str] = None,
        synthesize: bool = True
    ) -> dict:
        """Run parallel enrichment queries and synthesize results"""
        
        search_context = f"{name}"
        if company:
            search_context += f" at {company}"
        if title:
            search_context += f", {title}"
        
        raw_results = await self._run_parallel_queries(search_context, company)
        
        result = {
            "raw": raw_results,
            "enriched_at": datetime.utcnow().isoformat()
        }
        
        if synthesize and OPENAI_API_KEY:
            synthesized = await self._synthesize_profile(
                name=name,
                email=email,
                company=company,
                title=title,
                raw_data=raw_results
            )
            result["synthesized"] = synthesized
        
        return result
    
    async def _run_parallel_queries(self, search_context: str, company: Optional[str]) -> dict:
        """Run 5 parallel Perplexity queries"""
        
        queries = {
            "person": f"Professional background and role of {search_context}",
            "company": f"Company overview and recent news about {company}" if company else None,
            "industry": f"Industry trends and challenges for {company}" if company else None,
            "news": f"Recent news and announcements about {search_context}",
            "insights": f"Business priorities and initiatives for {search_context}"
        }
        
        queries = {k: v for k, v in queries.items() if v}
        
        if not PERPLEXITY_API_KEY:
            return {domain: f"Mock data for {query}" for domain, query in queries.items()}
        
        async def fetch_domain(domain: str, query: str) -> tuple:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        "https://api.perplexity.ai/chat/completions",
                        headers={
                            "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": "sonar-pro",
                            "messages": [
                                {"role": "user", "content": query}
                            ],
                            "max_tokens": 1000
                        }
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                        return (domain, content)
                    else:
                        return (domain, f"Error: {response.status_code}")
            except Exception as e:
                return (domain, f"Error: {str(e)}")
        
        tasks = [fetch_domain(domain, query) for domain, query in queries.items()]
        results = await asyncio.gather(*tasks)
        
        return dict(results)
    
    async def _synthesize_profile(
        self,
        name: str,
        email: Optional[str],
        company: Optional[str],
        title: Optional[str],
        raw_data: dict
    ) -> dict:
        """Synthesize raw data into structured sales profile using GPT-4o"""
        
        if not OPENAI_API_KEY:
            return self._mock_synthesis(name, company, title)
        
        combined_intel = "\n\n".join([
            f"=== {domain.upper()} ===\n{content}"
            for domain, content in raw_data.items()
        ])
        
        prompt = f"""Analyze this intelligence about {name} ({title} at {company}) and create a structured sales profile.

RAW INTELLIGENCE:
{combined_intel}

Generate a JSON response with this exact structure:
{{
    "summary": "2-3 sentence executive summary",
    "opening_line": "Personalized cold call opener",
    "hook": "Key value proposition hook",
    "why_now": "Reason to act now based on their situation",
    "talking_points": ["point 1", "point 2", "point 3"],
    "bant": {{
        "budget": "Budget assessment",
        "authority": "Decision-making authority",
        "need": "Identified needs",
        "timeline": "Urgency/timeline indicators"
    }},
    "company_info": {{
        "industry": "Industry",
        "size": "Company size estimate",
        "recent_news": "Key recent news"
    }},
    "objection_handlers": [
        {{"objection": "Common objection", "response": "Suggested response"}}
    ],
    "scores": {{
        "apex": 75,
        "mdcp": 70,
        "rss": 80
    }}
}}

Return ONLY valid JSON, no markdown or explanation."""

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {OPENAI_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "gpt-4o",
                        "messages": [
                            {"role": "system", "content": "You are a sales intelligence analyst. Return only valid JSON."},
                            {"role": "user", "content": prompt}
                        ],
                        "max_tokens": 2000,
                        "temperature": 0.7
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
                    
                    # Clean up JSON if wrapped in markdown code fences
                    content = content.strip()
                    json_marker = "```
                    code_marker = "```"
                    
                    if content.startswith(json_marker):
                        content = content[len(json_marker):]
                    elif content.startswith(code_marker):
                        content = content[len(code_marker):]
                    
                    if content.endswith(code_marker):
                        content = content[:-len(code_marker)]
                    
                    content = content.strip()
                    
                    import json
                    return json.loads(content)
                else:
                    return self._mock_synthesis(name, company, title)
                    
        except Exception as e:
            print(f"GPT synthesis error: {e}")
            return self._mock_synthesis(name, company, title)
    
    def _mock_synthesis(self, name: str, company: Optional[str], title: Optional[str]) -> dict:
        """Generate mock synthesis for testing"""
        first_name = name.split()[0] if name else "there"
        return {
            "summary": f"{name} is a {title or 'professional'} at {company or 'their company'}. They appear to be a key decision maker in their organization.",
            "opening_line": f"Hi {first_name}, I noticed your work at {company} and wanted to connect.",
            "hook": "Our solution helps companies like yours improve efficiency by 40%.",
            "why_now": "Q1 is typically when teams evaluate new solutions.",
            "talking_points": [
                "Industry-leading ROI",
                "Quick implementation timeline",
                "Dedicated support team"
            ],
            "bant": {
                "budget": "Likely has budget authority based on title",
                "authority": f"{title} typically has decision-making power",
                "need": "Potential efficiency and growth needs",
                "timeline": "May be planning for next quarter"
            },
            "company_info": {
                "industry": "Technology",
                "size": "Mid-market",
                "recent_news": "No recent news available"
            },
            "objection_handlers": [
                {
                    "objection": "We're happy with our current solution",
                    "response": "I understand. Many of our best customers said the same thing before seeing our ROI numbers."
                },
                {
                    "objection": "We don't have budget right now",
                    "response": "That's fair. Would it make sense to explore this for next quarter's planning?"
                }
            ],
            "scores": {
                "apex": 65,
                "mdcp": 60,
                "rss": 70
            }
        }
    
    def clear_cache(self):
        """Clear the enrichment cache"""
        self.cache = {}

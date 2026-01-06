#!/usr/bin/env python3
"""
CALL SCRIPT GENERATOR - LatticeIQ
Generates DISC-optimized call scripts from enrichment data
"""

import os
import requests
import json
from datetime import datetime
from typing import Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

# DISC personality approaches
DISC_APPROACHES = {
    "D": {
        "name": "Dominant",
        "opening": "Get to the point in 10 seconds",
        "pace": "Fast, efficient",
        "focus": "Results and ROI",
        "objection_style": "Direct counter with data",
        "avoid": "Small talk, long explanations",
        "mbti_maps": ["ENTJ", "ESTJ", "ESTP", "INTJ"]
    },
    "I": {
        "name": "Influential", 
        "opening": "Build rapport first (20 seconds)",
        "pace": "Conversational, energetic",
        "focus": "People and relationships",
        "objection_style": "Story-based response",
        "avoid": "Too many details, being cold",
        "mbti_maps": ["ENFP", "ENFJ", "ESFP", "ESFJ"]
    },
    "S": {
        "name": "Steady",
        "opening": "Warm, ask about their team",
        "pace": "Patient, supportive",
        "focus": "Stability and support",
        "objection_style": "Reassurance and case studies",
        "avoid": "Pressure, rushing decisions",
        "mbti_maps": ["ISFJ", "ISFP", "INFP", "INFJ"]
    },
    "C": {
        "name": "Conscientious",
        "opening": "Professional, agenda-driven",
        "pace": "Methodical, detailed",
        "focus": "Data and accuracy",
        "objection_style": "Provide detailed proof",
        "avoid": "Vague claims, emotional appeals",
        "mbti_maps": ["ISTJ", "INTP", "ISTP", "INTJ"]
    }
}

SCRIPT_STYLES = {
    1: "Direct & Value-Focused",
    2: "Consultative & Rapport-Building",
    3: "Executive / Insight-Led"
}


class CallScriptGenerator:
    """Generate DISC-optimized cold call scripts"""
    
    def __init__(self):
        self.perplexity_key = os.getenv('PERPLEXITY_API_KEY')
        self.openai_key = os.getenv('OPENAI_API_KEY')
        
    def map_mbti_to_disc(self, mbti: str) -> str:
        """Map Myers-Briggs type to DISC profile"""
        if not mbti:
            return "D"  # Default to Direct
            
        mbti = mbti.upper().strip()[:4]
        
        for disc_type, data in DISC_APPROACHES.items():
            if mbti in data["mbti_maps"]:
                return disc_type
        
        # Fallback based on first letter
        if mbti.startswith("E"):
            return "I" if "F" in mbti else "D"
        else:
            return "S" if "F" in mbti else "C"
    
    def extract_personality_from_enrichment(self, enrichment_data: str) -> Dict:
        """Extract personality info from enrichment text"""
        result = {
            "mbti": None,
            "disc": "D",
            "personality_summary": "",
            "talking_points": []
        }
        
        if not enrichment_data:
            return result
            
        # Look for Myers-Briggs section
        import re
        
        # Find MBTI type (4 letters like ENTJ, ISFP, etc.)
        mbti_match = re.search(r'\b([EI][NS][TF][JP])\b', enrichment_data, re.IGNORECASE)
        if mbti_match:
            result["mbti"] = mbti_match.group(1).upper()
            result["disc"] = self.map_mbti_to_disc(result["mbti"])
        
        # Extract personality summary (look for Section 6 or 7)
        personality_section = re.search(
            r'(?:Personality Detail|Myers-Briggs).*?(?=###|\Z)',
            enrichment_data,
            re.IGNORECASE | re.DOTALL
        )
        if personality_section:
            result["personality_summary"] = personality_section.group(0)[:500]
        
        # Extract talking points (Section 8)
        talking_points_section = re.search(
            r'(?:Sales Opportunity|Talking Points).*?(?=###|---|\Z)',
            enrichment_data,
            re.IGNORECASE | re.DOTALL
        )
        if talking_points_section:
            points = re.findall(r'[-•]\s*(.+)', talking_points_section.group(0))
            result["talking_points"] = points[:5]
        
        return result
    
    def generate_script(self, contact: Dict, variant: int, business_context: str = "") -> str:
        """Generate a single call script variant"""
        
        name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
        title = contact.get('title', '') or contact.get('job_title', '')
        company = contact.get('company', '')
        
        # Get enrichment data
        enrichment = contact.get('deep_enrichment_data') or contact.get('enrichment_data') or ""
        if isinstance(enrichment, dict):
            enrichment = json.dumps(enrichment)
        
        # Extract personality
        personality = self.extract_personality_from_enrichment(enrichment)
        disc = personality["disc"]
        approach = DISC_APPROACHES[disc]
        style = SCRIPT_STYLES[variant]
        
        # Get intel snippet
        intel = enrichment[:1500] if enrichment else f"{name} is {title} at {company}"
        
        prompt = f"""You are writing a {style} cold-call script for {name}, {title} at {company}.

PERSONALITY TYPE: {disc} ({approach['name']}) - {approach['focus']}
OPENING STYLE: {approach['opening']}
PACE: {approach['pace']}
MBTI: {personality.get('mbti', 'Unknown')}

INTELLIGENCE ON THIS CONTACT:
{intel}

BUSINESS CONTEXT (what we sell):
{business_context or "B2B sales intelligence and outreach platform"}

GOAL: Book a 15-minute discovery call.

Format your response EXACTLY as:

════════════════════════════════════════════════════════════════
CALL SCRIPT – {style}
{name} | {title} | {company}
Personality: {disc}-Type ({approach['name']})
════════════════════════════════════════════════════════════════

📞 OPENER (10 seconds):
[{approach['opening']} - use specific intel about them]

🎯 HOOK / VALUE PROP:
[1 sentence identifying their likely pain point]
[1 sentence showing outcome/benefit]

❓ DISCOVERY QUESTIONS:
• [Question 1 aligned with {disc} personality style]
• [Question 2 about their current process]
• [Question 3 about timing/urgency]

🛡️ OBJECTION HANDLING:

IF "Not interested":
→ [{approach['objection_style']}]

IF "Send me info":
→ [Response matching {disc} style - don't just comply]

IF "Too busy right now":
→ [Response respecting their {approach['pace']}]

IF "We already have a solution":
→ [Curious response, not defensive]

✅ CLOSE:
[Propose specific times - match {disc} preference]
[Alternative: softer next step if needed]

📝 PERSONALITY REMINDERS:
• DO: {approach['focus']}
• DON'T: {approach['avoid']}
• PACE: {approach['pace']}

════════════════════════════════════════════════════════════════
"""

        # Call Perplexity
        try:
            response = requests.post(
                "https://api.perplexity.ai/chat/completions",
                json={
                    "model": "sonar",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 1000,
                    "temperature": 0.7
                },
                headers={"Authorization": f"Bearer {self.perplexity_key}"},
                timeout=45
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            print(f"Perplexity error: {e}")
            return self._fallback_script(name, title, company, variant, disc, approach)
    
    def _fallback_script(self, name: str, title: str, company: str, 
                         variant: int, disc: str, approach: Dict) -> str:
        """Fallback template if API fails"""
        first_name = name.split()[0] if name else "there"
        return f"""
════════════════════════════════════════════════════════════════
CALL SCRIPT – {SCRIPT_STYLES[variant]}
{name} | {title} | {company}
Personality: {disc}-Type ({approach['name']})
════════════════════════════════════════════════════════════════

📞 OPENER:
"Hi {first_name}, this is [Your Name] with [Company]. I know you're busy so I'll be brief..."

🎯 HOOK / VALUE PROP:
"We help {title}s like yourself [specific benefit]. Companies like {company} typically see [outcome]."

❓ DISCOVERY QUESTIONS:
• "What's your current process for [area]?"
• "What would make the biggest impact for you right now?"
• "Who else should be involved in this conversation?"

🛡️ OBJECTION HANDLING:

IF "Not interested":
→ "{approach['objection_style']}"

IF "Send me info":
→ "Happy to - what specifically would be most relevant to you?"

IF "Too busy":
→ "Totally understand - when would be a better time?"

✅ CLOSE:
"Would Tuesday at 2pm or Wednesday at 10am work better for a quick 15-minute call?"

📝 PERSONALITY REMINDERS:
• DO: {approach['focus']}
• DON'T: {approach['avoid']}
• PACE: {approach['pace']}

════════════════════════════════════════════════════════════════
"""

    def generate_all_scripts(self, contact: Dict, business_context: str = "") -> Dict:
        """Generate all 3 script variants"""
        
        name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
        
        # Extract personality first
        enrichment = contact.get('deep_enrichment_data') or contact.get('enrichment_data') or ""
        if isinstance(enrichment, dict):
            enrichment = json.dumps(enrichment)
        personality = self.extract_personality_from_enrichment(enrichment)
        
        scripts = {}
        
        for variant in [1, 2, 3]:
            try:
                scripts[f"script_{variant}"] = self.generate_script(
                    contact, variant, business_context
                )
            except Exception as e:
                scripts[f"script_{variant}"] = f"Error generating script: {str(e)}"
        
        return {
            "success": True,
            "contact_name": name,
            "personality": {
                "mbti": personality.get("mbti"),
                "disc": personality.get("disc"),
                "disc_name": DISC_APPROACHES[personality["disc"]]["name"]
            },
            "scripts": scripts,
            "generated_at": datetime.utcnow().isoformat()
        }


# Convenience function for API
def generate_call_scripts(contact: Dict, business_context: str = "") -> Dict:
    """Main entry point for call script generation"""
    generator = CallScriptGenerator()
    return generator.generate_all_scripts(contact, business_context)


if __name__ == "__main__":
    # Test
    test_contact = {
        "first_name": "John",
        "last_name": "Smith",
        "title": "VP of Sales",
        "company": "Acme Corp",
        "deep_enrichment_data": "Myers-Briggs: ENTJ. Direct communicator focused on results..."
    }
    
    result = generate_call_scripts(test_contact)
    print(json.dumps(result, indent=2))

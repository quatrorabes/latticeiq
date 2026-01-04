#!/usr/bin/env python3
"""
Enhanced Full Output Perplexity Enrichment with GPT-4 Polishing
- Perplexity (sonar-pro) for research
- GPT-4 for professional polish
"""
import os
import requests
import json
from datetime import datetime
from dotenv import load_dotenv
import openai

load_dotenv()

class EnhancedEnrichment:
    """Two-stage enrichment: Research + Polish"""
    
    def __init__(self, api_key=None, openai_key=None):
        self.perplexity_key = api_key or os.getenv('PERPLEXITY_API_KEY')
        self.openai_key = openai_key or os.getenv('OPENAI_API_KEY')
        
        if not self.perplexity_key:
            raise ValueError("PERPLEXITY_API_KEY required")
        if not self.openai_key:
            raise ValueError("OPENAI_API_KEY required for polishing")
        
        # Initialize OpenAI client
        self.openai_client = openai.OpenAI(api_key=self.openai_key)
        
        # Create output directory
        self.output_dir = "enrichment_profiles"
        os.makedirs(self.output_dir, exist_ok=True)
    
    def enrich_contact(self, contact):
        """Enrich with enhanced strategic questions and polish"""
        
        name = contact.get('name', '')
        company = contact.get('company', '')
        title = contact.get('title', '')
        contact_id = contact.get('id', 'unknown')
        
        print(f"\n{'='*80}")
        print(f"🔍 ENHANCED ENRICHMENT: {name} at {company}")
        print(f"{'='*80}\n")
        
        # STAGE 1: Perplexity Research
        query = self.build_enhanced_query(contact)
        
        print("📤 STAGE 1: PERPLEXITY RESEARCH (sonar-pro):")
        print("-" * 40)
        print(query[:500] + "...[truncated for display]")
        print("-" * 40)
        
        raw_profile = self.call_perplexity(query)
        
        if not raw_profile:
            print("\n❌ No result from Perplexity")
            return None
        
        print(f"\n✅ STAGE 1 COMPLETE: {len(raw_profile):,} characters")
        
        # STAGE 2: GPT-4 Polishing
        print("\n📤 STAGE 2: GPT-4 POLISHING...")
        print("-" * 40)
        
        polished_profile = self.polish_profile(raw_profile, contact)
        
        if not polished_profile:
            print("⚠️  Polishing failed, using raw profile")
            polished_profile = raw_profile
        else:
            print(f"✅ STAGE 2 COMPLETE: {len(polished_profile):,} characters")
        
        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_filename = f"{self.output_dir}/profile_{contact_id}_{name.replace(' ', '_')}_{timestamp}"
        
        # Save RAW version
        raw_filename = f"{base_filename}_raw.txt"
        self._save_profile(raw_filename, contact, raw_profile, "sonar-pro (raw)")
        
        # Save POLISHED version
        polished_filename = f"{base_filename}_polished.txt"
        self._save_profile(polished_filename, contact, polished_profile, "sonar-pro + gpt-4 (polished)")
        
        # Save JSON version with both
        json_filename = f"{base_filename}.json"
        with open(json_filename, 'w', encoding='utf-8') as f:
            json.dump({
                'contact': contact,
                'raw_profile': raw_profile,
                'polished_profile': polished_profile,
                'generated_at': datetime.now().isoformat(),
                'raw_length': len(raw_profile),
                'polished_length': len(polished_profile),
                'filenames': {
                    'raw': raw_filename,
                    'polished': polished_filename
                }
            }, f, indent=2)
        
        print(f"\n{'='*80}")
        print("✅ TWO-STAGE ENRICHMENT COMPLETE!")
        print(f"{'='*80}")
        print(f"📁 Raw profile: {raw_filename}")
        print(f"📁 Polished profile: {polished_filename}")
        print(f"📁 JSON data: {json_filename}")
        print(f"📊 Raw size: {len(raw_profile):,} characters")
        print(f"📊 Polished size: {len(polished_profile):,} characters")
        
        # Return polished version as primary
        return {
            'success': True,
            'profile_text': polished_profile,
            'raw_profile': raw_profile,
            'filename': polished_filename,
            'character_count': len(polished_profile)
        }
    
    def _save_profile(self, filename, contact, profile_text, model_info):
        """Save profile to file with header"""
        with open(filename, 'w', encoding='utf-8') as f:
            f.write("=" * 80 + "\n")
            f.write(f"ENHANCED ENRICHMENT PROFILE\n")
            f.write(f"Generated: {datetime.now().isoformat()}\n")
            f.write(f"Model: {model_info}\n")
            f.write("=" * 80 + "\n\n")
            
            f.write("CONTACT DETAILS:\n")
            f.write(f"Name: {contact.get('name')}\n")
            f.write(f"Title: {contact.get('title')}\n")
            f.write(f"Company: {contact.get('company')}\n")
            f.write(f"Email: {contact.get('email')}\n")
            f.write(f"Phone: {contact.get('phone')}\n")
            f.write("\n" + "=" * 80 + "\n\n")
            
            f.write("PROFILE:\n")
            f.write("-" * 80 + "\n")
            f.write(profile_text)
            f.write("\n" + "=" * 80 + "\n")
    
    def polish_profile(self, raw_profile, contact):
        """Polish the raw Perplexity output into sales-ready format"""
        
        name = contact.get('name', '')
        title = contact.get('title', '')
        company = contact.get('company', '')
        
        polish_prompt = f"""You you are an AI tasked with converting business profile information into a refined, professional dossier for sales reps. Your goal is to develop a detailed and flexible business profile. Using the provided data, highlight the main facts about the subject to help support sales activities.

Data: [input]

    
    **Contact Information:**
    Name: {name}
    Title: {title}
    Company: {company}
    
    **CRITICAL FORMATTING REQUIREMENTS:**
    You MUST use this EXACT structure with numbered sections and precise titles:
    
    **PROFESSIONAL PROFILE: {name.upper()}**
    
    ### 1. Overview – Current Title and Organization
    [Enhanced content here]
    
    ### 2. Background – Work History, Notable Achievements
    [Enhanced bullet points with - prefix]
    
    ### 3. Education – Degrees and Institutions
    [Enhanced content here]
    
    ### 4. Recent Mentions – News, Public Appearances, Online Presence
    [Enhanced bullet points with - prefix]
    
    ### 5. Social Profiles
    [Enhanced content here - include LinkedIn, Instagram, Facebook, Twitter]
    
    ### 6. Personality Detail – Myers-Briggs Assessment
    [Enhanced content here]
    
    ### 7. Myers-Briggs Personality Assessment Summary
    [Enhanced content here]
    
    ### 8. Sales Opportunity: Potential Talking Points
    [Enhanced bullet points with - prefix]
    
    ---
    
    **{company.upper()}: CORPORATE PROFILE**
    
    ### 1. Overview – Description, Mission, Founding Details, HQ
    [Enhanced content here]
    
    ### 2. Products & Services – Key Offerings and Markets Served
    [Enhanced bullet points with - prefix]
    
    ### 3. Leadership – Key Executives and Founders
    [Enhanced content here]
    
    ### 4. Market & Competitors – Industry, Position, Key Competitors
    [Enhanced content here]
    
    ### 5. Recent News – Major Announcements or Deals
    [Enhanced bullet points with - prefix]
    
    ### 6. Company Fun Facts
    [Enhanced content here]
    
    ---
    polishprompt = f"""
    ...
    
    --- STRATEGIC INTELLIGENCE SECTION ---
    
    ## 9. Pain Points – {title} at {company}
    - [Enhanced bullet points with - prefix, 5 specific pain points]
    
    ## 10. SBA Financing Interest – Benefits for {name} & Clients
    - [Enhanced bullet points with - prefix, 5 specific benefits]
    
    ## 11. Key Insights – Deep, Non-Obvious Intelligence
    - [Enhanced bullet points with - prefix, 3 critical insights]
    
    ## 12. Final Note – Strategic Summary
    [One paragraph synthesizing the above into actionable intelligence]
    
    ---
    """
    
    **Instructions:**
    - Use the EXACT section numbers and titles shown above
    - Expand each section with rich, professional language
    - Keep all facts and citations from the original
    - Add bullet points with - prefix where appropriate
    - Make it sales-ready and action-oriented
    - Do NOT change section titles or numbering
    - Do NOT add or remove sections
    
    **Raw Profile to Polish:**
    
    {raw_profile}
    
    **Remember: Maintain EXACT section structure while enhancing the content!**"""
        
        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": "You are a professional business profile writer. You MUST follow the exact formatting structure provided in the prompt, including all section numbers and titles exactly as specified."},
                    {"role": "user", "content": polish_prompt}
                ],
                temperature=0.5,  # Lower temp for more consistent formatting
                max_tokens=4000
            )
            
            return response.choices[0].message.content
        
        except Exception as e:
            print(f"❌ Polishing error: {e}")
            return None
        
    def build_enhanced_query(self, contact):
        """Build enhanced query with all available contact data"""
        name = contact.get('name', '')
        title = contact.get('title', '')
        company = contact.get('company', '')
        email = contact.get('email', '')
        phone = contact.get('phone', '')
        linkedin_url = contact.get('linkedin_url', '')
        
        # Build context section
        context = f"""{name}, {title} at {company}
Email: {email}
Phone: {phone}"""
        
        if linkedin_url:
            context += f"\nLinkedIn Profile: {linkedin_url}"
            context += f"\n\n**CRITICAL: Use this LinkedIn profile ({linkedin_url}) as PRIMARY source for work history and education.**"
        
        query = f"""{context}

You are a professional profile-building assistant. Generate up-to-date profile using public web sources and LinkedIn.

For the person ({name}), structure the profile as:

1. Overview – Current title and organization
2. Background – Work history, notable achievements  
3. Education – Degrees and institutions
4. Recent Mentions – Any news, public appearances, LinkedIn posts, or online presence
5. Social Profiles – LinkedIn, Instagram, Facebook, Twitter
6. Personality Detail – Myers-Briggs assessment (inferred from public data)
7. Myers-Briggs Personality Assessment Summary
8. Sales Opportunity: Potential Talking Points

For the company ({company}), structure the profile as:

1. Overview – Description, mission, founding details, and HQ
2. Products & Services – Key offerings and markets served
3. Leadership – Key executives and founders
4. Market & Competitors – Industry, position, key competitors
5. Recent News – Major announcements, deals, or product launches
6. Company Fun Facts

STRATEGIC INTELLIGENCE SECTION:

Pain Points: Provide 5 specific pain points that someone in {name}'s role ({title}) would face in their day-to-day work. Consider industry challenges, role-specific frustrations, and market conditions.

SBA Financing Interest: Provide 5 specific points about how SBA loans and owner-occupied commercial real estate financing could benefit {name} or their clients:
- Benefits of SBA financing
- Owner-occupied vs leasing advantages
- Cash flow and tax benefits
- Building equity vs paying rent
- Lower down payment requirements (10% vs 30%)

Key Insights: Provide 3 critical non-obvious insights about this person, their profession, or their company that would be valuable in a business conversation.

IMPORTANT: Find the correct {company} where {name} works as {title}. If {company} is in commercial real estate or mortgage banking, emphasize their deal flow and client types."""
        
        return query
    
    def call_perplexity(self, query):
        """Call Perplexity API with sonar-pro model"""
        
        url = "https://api.perplexity.ai/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {self.perplexity_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "sonar-pro",
            "messages": [
                {
                    "role": "user",
                    "content": query
                }
            ]
        }
        
        try:
            print("\n⏳ Calling Perplexity API (sonar-pro model)...")
            response = requests.post(url, json=payload, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                print("✅ API call successful!")
                return data['choices'][0]['message']['content']
            else:
                print(f"❌ API Error {response.status_code}")
                print(f"Response: {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Request error: {e}")
            return None


if __name__ == "__main__":
    # Test with a sample contact
    test_contact = {
        'id': 1,
        'name': 'John Doe',
        'title': 'Vice President',
        'company': 'Sample Company',
        'email': 'john@example.com',
        'phone': '555-1234',
        'linkedin_url': 'https://linkedin.com/in/johndoe'
    }
    
    enricher = EnhancedEnrichment()
    result = enricher.enrich_contact(test_contact)
    
    if result:
        print("\n🎉 Test completed successfully!")
        
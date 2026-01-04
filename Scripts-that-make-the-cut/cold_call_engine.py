#!/usr/bin/env python3
"""
=============================================================================
APEX COLD CALL ENGINE - Minimal Data Contact Handling
=============================================================================
Location: apps/backend/intelligence/cold_call/cold_call_engine.py

Handles contacts where you only have:
- Name
- Phone/Mobile
- Maybe LinkedIn
- Maybe company/title

Features:
- Quick scoring based on available data
- LinkedIn lookup suggestions
- Priority queue management
- Promotion to full contact after enrichment

Usage:
    from apps.backend.intelligence.cold_call.cold_call_engine import ColdCallEngine
    
    engine = ColdCallEngine(user_id='default')
    engine.add_to_queue(name, phone, linkedin_url, company, title, source)
    queue = engine.get_prioritized_queue()
=============================================================================
"""

import json
import os
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional

DATABASE = os.getenv('DATABASE_URL', '/Users/chrisrabenold/projects/apex/apex.db')

# Import scoring engine
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scoring.scoring_engine import ApexScoringEngine


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


class ColdCallEngine:
    """
    Manage cold call queue for minimal-data contacts.
    """
    
    def __init__(self, user_id: str = 'default'):
        self.user_id = user_id
        self.scorer = ApexScoringEngine(user_id)
    
    # =========================================================================
    # QUEUE MANAGEMENT
    # =========================================================================
    
    def add_to_queue(
        self,
        name: str,
        phone: str = None,
        mobile: str = None,
        email: str = None,
        linkedin_url: str = None,
        company: str = None,
        title: str = None,
        source: str = 'manual',
        source_context: str = None,
        notes: str = None
    ) -> Dict:
        """
        Add a contact to the cold call queue.
        Auto-scores based on available title/company.
        """
        # Quick score
        quick_result = self.scorer.quick_score(name, title or '', company or '')
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO cold_call_queue 
            (user_id, name, phone, mobile, email, linkedin_url, company, title,
             source, source_context, notes, quick_fit_score, quick_fit_reason, priority)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            self.user_id,
            name,
            phone,
            mobile,
            email,
            linkedin_url,
            company,
            title,
            source,
            source_context,
            notes,
            quick_result['quick_fit_score'],
            f"Title: {quick_result.get('title_match', 'N/A')}, Company: {quick_result.get('company_match', 'N/A')}",
            quick_result['priority']
        ))
        
        queue_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'queue_id': queue_id,
            'quick_score': quick_result,
        }
    
    def add_batch(self, contacts: List[Dict]) -> Dict:
        """
        Add multiple contacts to queue.
        
        Each contact dict should have:
        - name (required)
        - phone, mobile, email, linkedin_url, company, title (optional)
        - source, source_context, notes (optional)
        """
        results = []
        for contact in contacts:
            result = self.add_to_queue(
                name=contact.get('name', ''),
                phone=contact.get('phone'),
                mobile=contact.get('mobile'),
                email=contact.get('email'),
                linkedin_url=contact.get('linkedin_url'),
                company=contact.get('company'),
                title=contact.get('title'),
                source=contact.get('source', 'batch'),
                source_context=contact.get('source_context'),
                notes=contact.get('notes')
            )
            results.append(result)
        
        return {
            'success': True,
            'added': len([r for r in results if r['success']]),
            'total': len(contacts)
        }
    
    def get_prioritized_queue(self, limit: int = 50, status: str = None) -> List[Dict]:
        """
        Get cold call queue sorted by priority.
        """
        conn = get_db()
        cursor = conn.cursor()
        
        query = '''
            SELECT * FROM cold_call_queue 
            WHERE user_id = ?
        '''
        params = [self.user_id]
        
        if status:
            query += ' AND status = ?'
            params.append(status)
        
        query += ' ORDER BY priority ASC, quick_fit_score DESC, created_at ASC LIMIT ?'
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
    
    def get_queue_stats(self) -> Dict:
        """Get queue statistics."""
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new,
                SUM(CASE WHEN status = 'attempted' THEN 1 ELSE 0 END) as attempted,
                SUM(CASE WHEN status = 'connected' THEN 1 ELSE 0 END) as connected,
                SUM(CASE WHEN status = 'meeting_set' THEN 1 ELSE 0 END) as meeting_set,
                SUM(CASE WHEN priority = 1 THEN 1 ELSE 0 END) as high_priority,
                SUM(CASE WHEN priority = 2 THEN 1 ELSE 0 END) as medium_priority,
                SUM(CASE WHEN priority = 3 THEN 1 ELSE 0 END) as low_priority,
                AVG(quick_fit_score) as avg_score
            FROM cold_call_queue
            WHERE user_id = ?
        ''', (self.user_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        return dict(row) if row else {}
    
    # =========================================================================
    # STATUS UPDATES
    # =========================================================================
    
    def log_attempt(self, queue_id: int, outcome: str = None, notes: str = None) -> bool:
        """Log a call attempt."""
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE cold_call_queue
            SET status = 'attempted',
                attempts = attempts + 1,
                last_attempt = ?,
                outcome = COALESCE(?, outcome),
                notes = COALESCE(?, notes),
                updated_at = ?
            WHERE id = ? AND user_id = ?
        ''', (
            datetime.now().isoformat(),
            outcome,
            notes,
            datetime.now().isoformat(),
            queue_id,
            self.user_id
        ))
        
        conn.commit()
        conn.close()
        return True
    
    def update_status(self, queue_id: int, status: str, notes: str = None) -> bool:
        """Update queue item status."""
        valid_statuses = ['new', 'attempted', 'connected', 'meeting_set', 'not_interested', 'enriched']
        if status not in valid_statuses:
            return False
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE cold_call_queue
            SET status = ?,
                notes = COALESCE(?, notes),
                updated_at = ?
            WHERE id = ? AND user_id = ?
        ''', (status, notes, datetime.now().isoformat(), queue_id, self.user_id))
        
        conn.commit()
        conn.close()
        return True
    
    # =========================================================================
    # PROMOTION TO FULL CONTACT
    # =========================================================================
    
    def promote_to_contact(self, queue_id: int) -> Dict:
        """
        Promote a cold call queue item to full contact.
        Creates entry in contacts table and links it.
        """
        conn = get_db()
        cursor = conn.cursor()
        
        # Get queue item
        cursor.execute('SELECT * FROM cold_call_queue WHERE id = ? AND user_id = ?', 
                      (queue_id, self.user_id))
        item = cursor.fetchone()
        
        if not item:
            conn.close()
            return {'success': False, 'error': 'Queue item not found'}
        
        item = dict(item)
        
        # Check if already promoted
        if item.get('contact_id'):
            conn.close()
            return {'success': False, 'error': 'Already promoted', 'contact_id': item['contact_id']}
        
        # Create contact
        cursor.execute('''
            INSERT INTO contacts (name, email, phone, mobile_phone, company, title, linkedin_url, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            item['name'],
            item['email'],
            item['phone'],
            item['mobile'],
            item['company'],
            item['title'],
            item['linkedin_url'],
            f"cold_call_queue:{item['source']}"
        ))
        
        contact_id = cursor.lastrowid
        
        # Link back to queue
        cursor.execute('''
            UPDATE cold_call_queue
            SET contact_id = ?, status = 'enriched', updated_at = ?
            WHERE id = ?
        ''', (contact_id, datetime.now().isoformat(), queue_id))
        
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'contact_id': contact_id,
            'message': f"Promoted to contact #{contact_id}. Ready for enrichment."
        }
    
    # =========================================================================
    # LINKEDIN LOOKUP HELPER
    # =========================================================================
    
    def generate_linkedin_search(self, queue_id: int = None, name: str = None, 
                                  company: str = None, title: str = None) -> str:
        """
        Generate LinkedIn search URL for finding a contact.
        """
        if queue_id:
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('SELECT name, company, title FROM cold_call_queue WHERE id = ?', (queue_id,))
            row = cursor.fetchone()
            conn.close()
            
            if row:
                name = row['name']
                company = row['company']
                title = row['title']
        
        search_parts = []
        if name:
            search_parts.append(name)
        if company:
            search_parts.append(company)
        if title:
            search_parts.append(title)
        
        query = ' '.join(search_parts)
        encoded = query.replace(' ', '%20')
        
        return f"https://www.linkedin.com/search/results/people/?keywords={encoded}"


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def add_to_cold_queue(name: str, phone: str = None, company: str = None, 
                      title: str = None, user_id: str = 'default', **kwargs) -> Dict:
    """Convenience function to add to cold call queue."""
    engine = ColdCallEngine(user_id)
    return engine.add_to_queue(name, phone, company=company, title=title, **kwargs)


def get_cold_queue(user_id: str = 'default', limit: int = 50) -> List[Dict]:
    """Convenience function to get cold call queue."""
    engine = ColdCallEngine(user_id)
    return engine.get_prioritized_queue(limit)


# =============================================================================
# CLI
# =============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("APEX COLD CALL ENGINE")
    print("=" * 60)
    
    engine = ColdCallEngine()
    
    # Test add
    result = engine.add_to_queue(
        name="John Smith",
        phone="555-123-4567",
        company="ABC Properties",
        title="Senior Vice President",
        source="linkedin",
        source_context="Found on ICSC group"
    )
    
    print(f"Added: {result}")
    
    # Get queue
    queue = engine.get_prioritized_queue(limit=10)
    print(f"\nQueue ({len(queue)} items):")
    for item in queue:
        print(f"  [{item['priority']}] {item['name']} - {item['title']} at {item['company']} (Score: {item['quick_fit_score']})")
    
    # Stats
    stats = engine.get_queue_stats()
    print(f"\nStats: {stats}")

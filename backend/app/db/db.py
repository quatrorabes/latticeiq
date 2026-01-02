"""
Database Module - Supabase Client Initialization

Provides a singleton Supabase client instance for the application.
"""

import os
from functools import lru_cache
from supabase import create_client, Client
import logging

logger = logging.getLogger(__name__)

# Environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")  # Service role key


@lru_cache()
def get_supabase() -> Client:
    """
    Get or create Supabase client instance.
    
    Uses @lru_cache to ensure only one client is created (singleton pattern).
    
    Returns:
        Supabase Client instance
    
    Raises:
        ValueError: If SUPABASE_URL or SUPABASE_KEY not set
    """
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL environment variable not set")
    if not SUPABASE_KEY:
        raise ValueError("SUPABASE_KEY environment variable not set")
    
    logger.info(f"Creating Supabase client for {SUPABASE_URL}")
    
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    return client


def get_supabase_client() -> Client:
    """Alias for get_supabase() - for dependency injection compatibility."""
    return get_supabase()

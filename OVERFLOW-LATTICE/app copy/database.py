#!/usr/bin/env python3
# ============================================================================
# FILE: backend/app/database.py
# ============================================================================
"""Database session management using Supabase + SQLAlchemy"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool

# Supabase PostgreSQL connection string
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/latticeiq"
)

# Create SQLAlchemy engine (use NullPool for serverless)
engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool,  # Important for Render free tier
    echo=False,
    connect_args={"connect_timeout": 10}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    """Dependency: Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

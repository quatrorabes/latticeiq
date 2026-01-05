#!/usr/bin/env python3
"""Authentication: Extract user from JWT"""

from fastapi import Depends, HTTPException, Header, status
from jose import JWTError, jwt
import os
from app.models import User

# Use Supabase JWT secret
JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET") or os.getenv("JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"


async def get_current_user(
    authorization: str = Header(None)
) -> User:
    """Extract and validate user from JWT token."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header"
        )
    
    try:
        # Handle "Bearer <token>" format
        token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
        
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM], options={"verify_aud": False})
        
        user_id = payload.get("sub")
        email = payload.get("email")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID"
            )
        
        return User(id=user_id, email=email)
        
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token"
        )

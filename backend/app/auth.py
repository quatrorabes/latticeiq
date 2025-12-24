#!/usr/bin/env python3

#!/usr/bin/env python3
# ============================================================================
# FILE: backend/app/auth.py
# ============================================================================
"""Authentication: Extract user from JWT"""

from fastapi import Depends, HTTPException, Header, status
from jose import JWTError, jwt
import os
from app.models import User

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"


async def get_current_user(
	authorization: str = Header(None)
) -> User:
	"""Extract and validate JWT user"""
	if not authorization:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Missing authorization header"
		)
		
	try:
		scheme, token = authorization.split(" ", 1)
		if scheme.lower() != "bearer":
			raise ValueError("Invalid scheme")
			
		payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
		user_id = payload.get("sub")
		email = payload.get("email")
		
		if not user_id or not email:
			raise ValueError("Missing required claims")
			
		# Return user object (in production, fetch from DB)
		return User(id=user_id, email=email)

	except JWTError as e:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Invalid or expired token"
		)
	except Exception as e:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Authentication failed"
		)
		
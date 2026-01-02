"""
Fields Module - Contact field value retrieval.

This module provides unified access to contact field values,
handling both denormalized columns and JSONB fallback.
"""

from .field_accessor import FieldAccessor

__all__ = ["FieldAccessor"]

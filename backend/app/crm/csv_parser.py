#!/usr/bin/env python3


# ============================================================================
# FILE: backend/crm/csv_parser.py
# ============================================================================
"""CSV parsing and validation for contact imports"""

import csv
import re
from io import StringIO, BytesIO
from typing import List, Tuple, Dict, Any
from uuid import UUID
from pydantic import BaseModel, EmailStr, validator
from typing import Optional



class CSVContact(BaseModel):
	"""Validated CSV contact row"""
	first_name: str
	last_name: str
	email: str
	phone: Optional[str] = None
	company: Optional[str] = None
	title: Optional[str] = None
	linkedin_url: Optional[str] = None
	custom_fields: Dict[str, Any] = {}
	
	@validator('email')
	def validate_email(cls, v):
		if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', v):
			raise ValueError('Invalid email format')
		return v.lower()
	
	@validator('phone')
	def validate_phone(cls, v):
		"""Relaxed phone validation - accept any format with at least 3 digits"""
		if v:
			# Remove all non-digit characters except + - ( )
			v = re.sub(r'[^\d+\-()]', '', v)
			# Extract just digits to check length
			digits_only = re.sub(r'[^\d]', '', v)
			if len(digits_only) < 3:
				raise ValueError('Phone too short')
		return v or None
	
	
class CSVParser:
	"""Parse and validate CSV files for contact imports"""
	
	REQUIRED_COLUMNS = ['email']
	OPTIONAL_COLUMNS = [
		'first_name', 'firstname', 'first name',
		'last_name', 'lastname', 'last name',
		'phone', 'mobile',
		'company', 'organization',
		'title', 'job_title',
		'linkedin_url', 'linkedin_profile'
	]
	
	def __init__(self, user_id: UUID):
		self.user_id = user_id
		
	def parse(self, file_content: bytes) -> Tuple[List[CSVContact], List[str]]:
		"""
		Parse CSV and return validated contacts + errors

		Returns:
			(validated_contacts, error_messages)
		"""
		try:
			text = file_content.decode('utf-8')
		except UnicodeDecodeError:
			text = file_content.decode('latin-1')
			
		reader = csv.DictReader(StringIO(text))
		if not reader.fieldnames:
			return [], ["CSV is empty"]
		
		# Normalize header names
		normalized_fieldnames = [h.lower().strip() for h in reader.fieldnames]
		
		# Check required columns
		has_email = any('email' in f for f in normalized_fieldnames)
		if not has_email:
			return [], ["CSV must contain 'email' column"]
		
		contacts = []
		errors = []
		
		for row_num, row in enumerate(reader, start=2):
			try:
				# Normalize row keys
				normalized_row = {k.lower().strip(): v for k, v in row.items()}
				
				# Extract fields
				email = None
				for key in normalized_row:
					if 'email' in key:
						email = normalized_row[key].strip()
						break
					
				if not email:
					errors.append(f"Row {row_num}: Missing email")
					continue
				
				first_name = self._get_field(normalized_row, ['first_name', 'firstname', 'first name'], '')
				last_name = self._get_field(normalized_row, ['last_name', 'lastname', 'last name'], '')
				phone = self._get_field(normalized_row, ['phone', 'mobile'], None)
				company = self._get_field(normalized_row, ['company', 'organization'], None)
				title = self._get_field(normalized_row, ['title', 'job_title'], None)
				linkedin_url = self._get_field(normalized_row, ['linkedin_url', 'linkedin_profile'], None)
				
				contact = CSVContact(
					first_name=first_name or "Unknown",
					last_name=last_name or "",
					email=email,
					phone=phone,
					company=company,
					title=title,
					linkedin_url=linkedin_url,
				)
				contacts.append(contact)
				
			except ValueError as e:
				errors.append(f"Row {row_num}: {str(e)}")
			except Exception as e:
				errors.append(f"Row {row_num}: {str(e)}")
				
		return contacts, errors
	
	@staticmethod
	def _get_field(row: Dict[str, str], keys: List[str], default=None) -> Optional[str]:
		"""Get field value from row by multiple possible keys"""
		for key in keys:
			if key in row and row[key].strip():
				return row[key].strip()
		return default
	
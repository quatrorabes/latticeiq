"""
LatticeIQ Enrichment V3 - Parallel Multi-Query Architecture
"""
from .parallel_enricher import ParallelEnricher
from .query_templates import ENRICHMENT_QUERIES, EnrichmentQuery, ContactContext
from .synthesizer import EnrichmentSynthesizer

__all__ = [
    "ParallelEnricher",
    "EnrichmentSynthesizer", 
    "ENRICHMENT_QUERIES",
    "EnrichmentQuery",
    "ContactContext"
]
__version__ = "3.0.0"

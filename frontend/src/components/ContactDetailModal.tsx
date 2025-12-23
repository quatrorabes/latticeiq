// At the top of ContactDetailModal.tsx, update the interface:
interface EnrichmentData {
  objection_handlers?: string[];
  // ... other fields
  [key: string]: unknown;
}

// Then fix line 197 (add type to i parameter):
{items.map((item: string, i: number) => (

// And fix lines 207-211:
{(enrichmentData as EnrichmentData).objection_handlers && (
  <div>
    <h4>Objection Handlers</h4>
    {((enrichmentData as EnrichmentData).objection_handlers || []).map((handler: string, i: number) => (

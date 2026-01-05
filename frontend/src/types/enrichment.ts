// frontend/src/types/enrichment.ts

export interface EnrichmentBullet {
  text: string;
  evidence?: string | null;
  strength?: number | null;
}

export interface ContactProfileBox {
  headline?: string | null;
  role_summary?: string | null;
  seniority?: string | null;
  background_bullets: EnrichmentBullet[];
}

export interface CompanyProfileBox {
  one_liner?: string | null;
  industry?: string | null;
  size_segment?: string | null;
  region?: string | null;
  key_products_or_services: EnrichmentBullet[];
}

export interface CurrentFocusBox {
  strategic_initiatives: EnrichmentBullet[];
  recent_projects: EnrichmentBullet[];
  primary_kpis: EnrichmentBullet[];
}

export interface BuyingSignalsBox {
  recent_news: EnrichmentBullet[];
  hiring_signals: EnrichmentBullet[];
  tech_changes: EnrichmentBullet[];
  timing_triggers: EnrichmentBullet[];
}

export interface RisksAndObjectionsBox {
  risk_bullets: EnrichmentBullet[];
  likely_objections: EnrichmentBullet[];
  landmines: EnrichmentBullet[];
}

export interface MessagingBox {
  cold_openers: EnrichmentBullet[];
  value_props: EnrichmentBullet[];
  call_to_action_ideas: EnrichmentBullet[];
}

export interface EnrichmentMeta {
  generated_at: string;
  source: "quick" | "deep";
  model?: string | null;
  provider?: string | null;
  confidence_score?: number | null;
  version: number;
}

export interface UnifiedEnrichmentResult {
  contact_id: string;
  contact_profile: ContactProfileBox;
  company_profile: CompanyProfileBox;
  current_focus: CurrentFocusBox;
  buying_signals: BuyingSignalsBox;
  risks_and_objections: RisksAndObjectionsBox;
  messaging: MessagingBox;
  meta: EnrichmentMeta;
}

Field Name,Category,Data Type,Status,Description
id,Core Identifiers,"UUID / string, primary key",EXISTS,See Core Identifiers
userid,Core Identifiers,"UUID, foreign key to auth.users",EXISTS,See Core Identifiers
firstname,Personal Information,text,EXISTS,See Personal Information
lastname,Personal Information,text,EXISTS,See Personal Information
email,Personal Information,"text, unique",EXISTS,See Personal Information
phone,Personal Information,"text, nullable",EXISTS,See Personal Information
mobile,Personal Information,"text, nullable",EXISTS,See Personal Information
company,Company Information,"text, nullable",EXISTS,See Company Information
title,Company Information,"text, nullable",EXISTS,See Company Information
vertical,Company Information,"text, nullable (industry e.g., SaaS, Finance)",EXISTS,See Company Information
linkedinurl,Company Information,"text, nullable",EXISTS,See Company Information
enrichmentstatus,Enrichment Status & Data,"text (pending, processing, completed, failed)",EXISTS,See Enrichment Status & Data
enrichmentdata,Enrichment Status & Data,"jsonb, nullable (raw sections from Perplexity)",EXISTS,See Enrichment Status & Data
enrichedat,Enrichment Status & Data,"timestamp, nullable",EXISTS,See Enrichment Status & Data
icpmatch,Qualification Fields - ICP Match,"numeric, score (0-100)",EXISTS,See Qualification Fields - ICP Match
icp_match_contact,Qualification Fields - ICP Match,numeric (breakdown component),EXISTS,See Qualification Fields - ICP Match
icp_match_data,Qualification Fields - ICP Match,numeric (breakdown component),EXISTS,See Qualification Fields - ICP Match
icp_match_profile,Qualification Fields - ICP Match,numeric (breakdown component),EXISTS,See Qualification Fields - ICP Match
apexscore,Qualification Fields - APEX,numeric (0-100),EXISTS,See Qualification Fields - APEX
matchtier,Qualification Fields - APEX,"text (High, Medium, Low)",EXISTS,See Qualification Fields - APEX
mdcpscore,Qualification Fields - MDCP,numeric (0-100),EXISTS,See Qualification Fields - MDCP
mdcp_hot_score,Qualification Fields - MDCP,numeric,EXISTS,See Qualification Fields - MDCP
mdcp_money_score,Qualification Fields - MDCP,numeric,EXISTS,See Qualification Fields - MDCP
mdcp_decision_maker_score,Qualification Fields - MDCP,numeric,EXISTS,See Qualification Fields - MDCP
mdcp_champion_score,Qualification Fields - MDCP,numeric,EXISTS,See Qualification Fields - MDCP
mdcp_process_score,Qualification Fields - MDCP,numeric,EXISTS,See Qualification Fields - MDCP
bant_score,Qualification Fields - BANT,numeric (0-100),EXISTS,See Qualification Fields - BANT
bant_budget_confirmed,Qualification Fields - BANT,boolean,EXISTS,See Qualification Fields - BANT
bant_authority_level,Qualification Fields - BANT,"text (C-level, Director, Manager)",EXISTS,See Qualification Fields - BANT
bant_need_documented,Qualification Fields - BANT,boolean,EXISTS,See Qualification Fields - BANT
bant_timeline_set,Qualification Fields - BANT,boolean,EXISTS,See Qualification Fields - BANT
spice_score,Qualification Fields - SPICE,numeric (0-100),EXISTS,See Qualification Fields - SPICE
spice_situation_documented,Qualification Fields - SPICE,boolean,EXISTS,See Qualification Fields - SPICE
spice_problem_identified,Qualification Fields - SPICE,boolean,EXISTS,See Qualification Fields - SPICE
spice_implication_found,Qualification Fields - SPICE,boolean,EXISTS,See Qualification Fields - SPICE
spice_consequence_assessed,Qualification Fields - SPICE,boolean,EXISTS,See Qualification Fields - SPICE
spice_decision_economic,Qualification Fields - SPICE,boolean,EXISTS,See Qualification Fields - SPICE
inferred_title,AI-Inferred Fields,"text, nullable",EXISTS,See AI-Inferred Fields
inferred_company_website,AI-Inferred Fields,"text, nullable",EXISTS,See AI-Inferred Fields
inferred_location,AI-Inferred Fields,"text, nullable",EXISTS,See AI-Inferred Fields
personatype,AI-Inferred Fields,"text, nullable (Decision-maker, Influencer, etc.)",EXISTS,See AI-Inferred Fields
talkingpoints,AI-Inferred Fields,"text array, nullable",EXISTS,See AI-Inferred Fields
unified_qualification_score,Operational Fields,numeric (weighted combo),EXISTS,See Operational Fields
rss_score,Operational Fields,numeric (RSS framework),EXISTS,See Operational Fields
notes,Operational Fields,"text, nullable",EXISTS,See Operational Fields
createdat,Operational Fields,timestamp,EXISTS,See Operational Fields
updatedat,Operational Fields,timestamp,EXISTS,See Operational Fields

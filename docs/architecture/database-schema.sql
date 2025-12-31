


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_crm_integrations_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_crm_integrations_timestamp"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bant_configuration" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "budget_weight" integer DEFAULT 25,
    "authority_weight" integer DEFAULT 25,
    "need_weight" integer DEFAULT 25,
    "timeline_weight" integer DEFAULT 25,
    "hot_threshold" integer DEFAULT 71,
    "warm_threshold" integer DEFAULT 40,
    "budget_min_amount" integer DEFAULT 10000,
    "budget_max_amount" integer DEFAULT 1000000,
    "authority_levels" "text" DEFAULT ''::"text",
    "need_pain_points" "text" DEFAULT ''::"text",
    "timeline_urgency_min" integer DEFAULT 7,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bant_configuration" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."competitive_positioning" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "company_name" character varying(255),
    "market_position" character varying(100),
    "key_value_props" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."competitive_positioning" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."competitor_attribute_ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "competitor_id" "uuid" NOT NULL,
    "attribute_id" "uuid" NOT NULL,
    "our_rating" integer,
    "competitor_rating" integer,
    "comments" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."competitor_attribute_ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."competitor_ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "attribute_id" "uuid" NOT NULL,
    "competitor_id" "uuid" NOT NULL,
    "rating" integer,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "competitor_ratings_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."competitor_ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."competitors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "competitive_positioning_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "strength_areas" "jsonb" DEFAULT '{}'::"jsonb",
    "weakness_areas" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."competitors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "mdcp_score" integer,
    "mdcp_tier" character varying(20),
    "mdcp_breakdown" "jsonb" DEFAULT '{}'::"jsonb",
    "bant_score" integer,
    "bant_tier" character varying(20),
    "bant_breakdown" "jsonb" DEFAULT '{}'::"jsonb",
    "spice_score" integer,
    "spice_tier" character varying(20),
    "spice_breakdown" "jsonb" DEFAULT '{}'::"jsonb",
    "custom_scores" "jsonb" DEFAULT '{}'::"jsonb",
    "primary_score" integer,
    "primary_tier" character varying(20),
    "calculated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contact_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid",
    "user_id" "uuid",
    "email" character varying(255),
    "first_name" character varying(100),
    "last_name" character varying(100),
    "company" character varying(255),
    "job_title" character varying(100),
    "phone" character varying(20),
    "linkedin_url" character varying(255),
    "website" character varying(255),
    "vertical" character varying(100),
    "persona_type" character varying(100),
    "annual_revenue" numeric,
    "enrichment_status" character varying(20) DEFAULT 'pending'::character varying,
    "enrichment_data" "jsonb",
    "enriched_at" timestamp with time zone,
    "apex_score" numeric,
    "mdc_score" numeric,
    "rss_score" numeric,
    "mdcp_score" numeric,
    "bant_score" numeric,
    "spice_score" numeric,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "crm_type" "text",
    "external_id" "text",
    "lifecycle_stage" "text",
    "lead_status" "text",
    "mdcp_tier" "text",
    "bant_tier" "text",
    "spice_tier" "text",
    "last_scored_at" timestamp without time zone,
    "title" "text",
    "overall_score" numeric(5,2),
    CONSTRAINT "contacts_enrichment_status_check" CHECK ((("enrichment_status")::"text" = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'enriching'::character varying])::"text"[])))
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_credentials" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "crm_type" character varying(50) NOT NULL,
    "api_key" character varying(500) NOT NULL,
    "api_url" character varying(500),
    "workspace_id" character varying(500),
    "instance_url" character varying(500),
    "other_config" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."crm_credentials" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."crm_credentials_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."crm_credentials_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."crm_credentials_id_seq" OWNED BY "public"."crm_credentials"."id";



CREATE TABLE IF NOT EXISTS "public"."crm_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "crm_type" "text" NOT NULL,
    "api_key" "text" NOT NULL,
    "api_url" "text",
    "import_filters" "jsonb" DEFAULT '{}'::"jsonb",
    "required_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "auto_sync_enabled" boolean DEFAULT false,
    "sync_frequency_hours" integer DEFAULT 24,
    "test_status" "text" DEFAULT 'untested'::"text",
    "is_active" boolean DEFAULT true,
    "last_test_at" timestamp without time zone,
    "last_sync_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."crm_integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_framework_configuration" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "custom_framework_id" "uuid" NOT NULL,
    "hot_threshold" integer DEFAULT 71,
    "warm_threshold" integer DEFAULT 40,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."custom_framework_configuration" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_frameworks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "framework_name" character varying(255) NOT NULL,
    "description" "text",
    "created_by" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."custom_frameworks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."differentiation_attributes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "differentiator_id" "uuid" NOT NULL,
    "attribute_name" character varying(255),
    "importance_weight" integer DEFAULT 50,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."differentiation_attributes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."differentiators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "competitive_positioning_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "impact_level" character varying(20),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."differentiators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dnc_list" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "email" "text",
    "phone" "text",
    "reason" "text",
    "created_at" timestamp without time zone
);


ALTER TABLE "public"."dnc_list" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."framework_fields" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "custom_framework_id" "uuid" NOT NULL,
    "field_name" character varying(255) NOT NULL,
    "field_type" character varying(50) NOT NULL,
    "weight" integer DEFAULT 10,
    "is_negative" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."framework_fields" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."icp_behavioral" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "buying_behavior" "jsonb" DEFAULT '{}'::"jsonb",
    "engagement_level" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."icp_behavioral" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."icp_definition" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "target_industries" "text" DEFAULT ''::"text",
    "min_company_size" integer DEFAULT 1,
    "max_company_size" integer DEFAULT 10000,
    "target_job_titles" "text" DEFAULT ''::"text",
    "seniority_levels" "text" DEFAULT ''::"text",
    "min_revenue_millions" integer DEFAULT 0,
    "max_revenue_millions" integer DEFAULT 10000,
    "target_geographies" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."icp_definition" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."icp_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "firmographic" "jsonb",
    "demographic" "jsonb",
    "behavioral" "jsonb",
    "outcomes" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."icp_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."icp_demographic" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "age_groups" "jsonb" DEFAULT '{}'::"jsonb",
    "departments" "jsonb" DEFAULT '{}'::"jsonb",
    "personas" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."icp_demographic" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."icp_firmographic" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "industry" "jsonb" DEFAULT '{}'::"jsonb",
    "company_size" "jsonb" DEFAULT '{}'::"jsonb",
    "geographic_region" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."icp_firmographic" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."icp_outcomes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "desired_outcomes" "jsonb" DEFAULT '{}'::"jsonb",
    "success_metrics" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."icp_outcomes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."icp_settings" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."icp_settings" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."icp_settings_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."icp_settings_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."icp_settings_id_seq" OWNED BY "public"."icp_settings"."id";



CREATE TABLE IF NOT EXISTS "public"."import_jobs" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "crm_type" "text",
    "status" "text",
    "total_contacts" integer,
    "imported_contacts" integer,
    "skipped_contacts" integer,
    "error_message" "text",
    "metadata" "jsonb",
    "created_at" timestamp without time zone,
    "completed_at" timestamp without time zone
);


ALTER TABLE "public"."import_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_logs" (
    "id" "uuid" NOT NULL,
    "job_id" "uuid",
    "contact_id" "uuid",
    "email" "text",
    "status" "text",
    "reason" "text",
    "created_at" timestamp without time zone
);


ALTER TABLE "public"."import_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_routing_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "rule_name" character varying(255),
    "criteria" "jsonb",
    "assignment_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lead_routing_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mdcp_configuration" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "money_weight" integer DEFAULT 25,
    "decision_maker_weight" integer DEFAULT 25,
    "champion_weight" integer DEFAULT 25,
    "process_weight" integer DEFAULT 25,
    "hot_threshold" integer DEFAULT 71,
    "warm_threshold" integer DEFAULT 40,
    "money_min_revenue" integer DEFAULT 1000000,
    "money_max_revenue" integer DEFAULT 100000000,
    "decision_maker_titles" "text" DEFAULT ''::"text",
    "champion_engagement_min" integer DEFAULT 7,
    "process_max_days" integer DEFAULT 90,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."mdcp_configuration" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "organization_type" character varying(100),
    "maturity_level" character varying(50),
    "employee_count" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organization_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "product_name" character varying(255) NOT NULL,
    "description" "text",
    "target_use_cases" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."products_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_frameworks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "framework_type" character varying(50) NOT NULL,
    "is_active" boolean DEFAULT true,
    "is_primary" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profile_frameworks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_status_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "status_from" character varying(20),
    "status_to" character varying(20),
    "reason" "text",
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profile_status_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid",
    "profile_name" character varying(255) NOT NULL,
    "vertical" character varying(100),
    "description" "text",
    "primary_framework" character varying(50) DEFAULT 'MDCP'::character varying,
    "status" character varying(20) DEFAULT 'Active'::character varying,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."score_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "mdcp_score" integer,
    "bant_score" integer,
    "spice_score" integer,
    "primary_score" integer,
    "reason" character varying(255),
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."score_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scoring_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scoring_framework_id" "uuid",
    "profile_id" "uuid",
    "config_name" character varying(255),
    "configuration" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scoring_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scoring_configuration" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "framework_type" character varying(50),
    "weights" "jsonb" DEFAULT '{}'::"jsonb",
    "thresholds" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scoring_configuration" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scoring_frameworks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "category" character varying(100),
    "is_builtin" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scoring_frameworks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scoring_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scoring_configuration_id" "uuid",
    "rule_name" character varying(255),
    "condition" "jsonb",
    "points_awarded" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scoring_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spice_configuration" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "situation_weight" integer DEFAULT 20,
    "problem_weight" integer DEFAULT 20,
    "implication_weight" integer DEFAULT 20,
    "consequence_weight" integer DEFAULT 20,
    "economic_weight" integer DEFAULT 20,
    "hot_threshold" integer DEFAULT 71,
    "warm_threshold" integer DEFAULT 40,
    "situation_indicators" "text" DEFAULT ''::"text",
    "problem_keywords" "text" DEFAULT ''::"text",
    "implication_min_severity" integer DEFAULT 7,
    "consequence_indicators" "text" DEFAULT ''::"text",
    "economic_min_roi" integer DEFAULT 100000,
    "economic_max_roi" integer DEFAULT 10000000,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."spice_configuration" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "status" character varying(20) DEFAULT 'Active'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."workspaces" OWNER TO "postgres";


ALTER TABLE ONLY "public"."crm_credentials" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."crm_credentials_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."icp_settings" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."icp_settings_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."bant_configuration"
    ADD CONSTRAINT "bant_configuration_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bant_configuration"
    ADD CONSTRAINT "bant_configuration_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."competitive_positioning"
    ADD CONSTRAINT "competitive_positioning_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."competitor_attribute_ratings"
    ADD CONSTRAINT "competitor_attribute_ratings_competitor_id_attribute_id_key" UNIQUE ("competitor_id", "attribute_id");



ALTER TABLE ONLY "public"."competitor_attribute_ratings"
    ADD CONSTRAINT "competitor_attribute_ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."competitor_ratings"
    ADD CONSTRAINT "competitor_ratings_attribute_id_competitor_id_key" UNIQUE ("attribute_id", "competitor_id");



ALTER TABLE ONLY "public"."competitor_ratings"
    ADD CONSTRAINT "competitor_ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."competitors"
    ADD CONSTRAINT "competitors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_scores"
    ADD CONSTRAINT "contact_scores_contact_id_profile_id_key" UNIQUE ("contact_id", "profile_id");



ALTER TABLE ONLY "public"."contact_scores"
    ADD CONSTRAINT "contact_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_credentials"
    ADD CONSTRAINT "crm_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_credentials"
    ADD CONSTRAINT "crm_credentials_user_id_crm_type_key" UNIQUE ("user_id", "crm_type");



ALTER TABLE ONLY "public"."crm_integrations"
    ADD CONSTRAINT "crm_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_integrations"
    ADD CONSTRAINT "crm_integrations_user_id_crm_type_key" UNIQUE ("user_id", "crm_type");



ALTER TABLE ONLY "public"."custom_framework_configuration"
    ADD CONSTRAINT "custom_framework_configuratio_profile_id_custom_framework_i_key" UNIQUE ("profile_id", "custom_framework_id");



ALTER TABLE ONLY "public"."custom_framework_configuration"
    ADD CONSTRAINT "custom_framework_configuration_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_frameworks"
    ADD CONSTRAINT "custom_frameworks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_frameworks"
    ADD CONSTRAINT "custom_frameworks_profile_id_framework_name_key" UNIQUE ("profile_id", "framework_name");



ALTER TABLE ONLY "public"."differentiation_attributes"
    ADD CONSTRAINT "differentiation_attributes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."differentiators"
    ADD CONSTRAINT "differentiators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dnc_list"
    ADD CONSTRAINT "dnc_list_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."framework_fields"
    ADD CONSTRAINT "framework_fields_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."icp_behavioral"
    ADD CONSTRAINT "icp_behavioral_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."icp_definition"
    ADD CONSTRAINT "icp_definition_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."icp_definition"
    ADD CONSTRAINT "icp_definition_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."icp_definitions"
    ADD CONSTRAINT "icp_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."icp_demographic"
    ADD CONSTRAINT "icp_demographic_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."icp_firmographic"
    ADD CONSTRAINT "icp_firmographic_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."icp_outcomes"
    ADD CONSTRAINT "icp_outcomes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."icp_settings"
    ADD CONSTRAINT "icp_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."icp_settings"
    ADD CONSTRAINT "icp_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_logs"
    ADD CONSTRAINT "import_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_routing_rules"
    ADD CONSTRAINT "lead_routing_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mdcp_configuration"
    ADD CONSTRAINT "mdcp_configuration_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mdcp_configuration"
    ADD CONSTRAINT "mdcp_configuration_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."organization_profiles"
    ADD CONSTRAINT "organization_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products_services"
    ADD CONSTRAINT "products_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_frameworks"
    ADD CONSTRAINT "profile_frameworks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_frameworks"
    ADD CONSTRAINT "profile_frameworks_profile_id_framework_type_key" UNIQUE ("profile_id", "framework_type");



ALTER TABLE ONLY "public"."profile_status_audit"
    ADD CONSTRAINT "profile_status_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_profile_name_key" UNIQUE ("user_id", "profile_name");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_workspace_id_user_id_profile_name_key" UNIQUE ("workspace_id", "user_id", "profile_name");



ALTER TABLE ONLY "public"."score_history"
    ADD CONSTRAINT "score_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scoring_configs"
    ADD CONSTRAINT "scoring_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scoring_configuration"
    ADD CONSTRAINT "scoring_configuration_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scoring_frameworks"
    ADD CONSTRAINT "scoring_frameworks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scoring_rules"
    ADD CONSTRAINT "scoring_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spice_configuration"
    ADD CONSTRAINT "spice_configuration_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spice_configuration"
    ADD CONSTRAINT "spice_configuration_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_owner_id_name_key" UNIQUE ("owner_id", "name");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_competitive_positioning_profile_id" ON "public"."competitive_positioning" USING "btree" ("profile_id");



CREATE INDEX "idx_competitor_attribute_ratings_attribute_id" ON "public"."competitor_attribute_ratings" USING "btree" ("attribute_id");



CREATE INDEX "idx_competitor_attribute_ratings_competitor_id" ON "public"."competitor_attribute_ratings" USING "btree" ("competitor_id");



CREATE INDEX "idx_competitors_competitive_positioning_id" ON "public"."competitors" USING "btree" ("competitive_positioning_id");



CREATE INDEX "idx_contact_scores_contact_id" ON "public"."contact_scores" USING "btree" ("contact_id");



CREATE INDEX "idx_contact_scores_profile_id" ON "public"."contact_scores" USING "btree" ("profile_id");



CREATE INDEX "idx_contacts_bant_tier" ON "public"."contacts" USING "btree" ("bant_tier");



CREATE INDEX "idx_contacts_email" ON "public"."contacts" USING "btree" ("email");



CREATE INDEX "idx_contacts_enrichment_status" ON "public"."contacts" USING "btree" ("enrichment_status");



CREATE INDEX "idx_contacts_mdcp_tier" ON "public"."contacts" USING "btree" ("mdcp_tier");



CREATE INDEX "idx_contacts_scores" ON "public"."contacts" USING "btree" ("mdcp_score", "bant_score", "spice_score");



CREATE INDEX "idx_contacts_spice_tier" ON "public"."contacts" USING "btree" ("spice_tier");



CREATE INDEX "idx_contacts_user_id" ON "public"."contacts" USING "btree" ("user_id");



CREATE INDEX "idx_contacts_workspace_id" ON "public"."contacts" USING "btree" ("workspace_id");



CREATE INDEX "idx_crm_credentials_type" ON "public"."crm_credentials" USING "btree" ("crm_type");



CREATE INDEX "idx_crm_credentials_user_id" ON "public"."crm_credentials" USING "btree" ("user_id");



CREATE INDEX "idx_differentiation_attributes_differentiator_id" ON "public"."differentiation_attributes" USING "btree" ("differentiator_id");



CREATE INDEX "idx_differentiators_competitive_positioning_id" ON "public"."differentiators" USING "btree" ("competitive_positioning_id");



CREATE INDEX "idx_framework_fields_custom_framework_id" ON "public"."framework_fields" USING "btree" ("custom_framework_id");



CREATE INDEX "idx_icp_behavioral_profile_id" ON "public"."icp_behavioral" USING "btree" ("profile_id");



CREATE INDEX "idx_icp_demographic_profile_id" ON "public"."icp_demographic" USING "btree" ("profile_id");



CREATE INDEX "idx_icp_firmographic_profile_id" ON "public"."icp_firmographic" USING "btree" ("profile_id");



CREATE INDEX "idx_icp_outcomes_profile_id" ON "public"."icp_outcomes" USING "btree" ("profile_id");



CREATE INDEX "idx_icp_settings_user_id" ON "public"."icp_settings" USING "btree" ("user_id");



CREATE INDEX "idx_lead_routing_rules_profile_id" ON "public"."lead_routing_rules" USING "btree" ("profile_id");



CREATE INDEX "idx_organization_profiles_profile_id" ON "public"."organization_profiles" USING "btree" ("profile_id");



CREATE INDEX "idx_products_services_profile_id" ON "public"."products_services" USING "btree" ("profile_id");



CREATE INDEX "idx_profile_frameworks_profile_id" ON "public"."profile_frameworks" USING "btree" ("profile_id");



CREATE INDEX "idx_profile_status_audit_profile_id" ON "public"."profile_status_audit" USING "btree" ("profile_id");



CREATE INDEX "idx_profiles_user_id" ON "public"."profiles" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_workspace_id" ON "public"."profiles" USING "btree" ("workspace_id");



CREATE INDEX "idx_score_history_contact_id" ON "public"."score_history" USING "btree" ("contact_id");



CREATE INDEX "idx_score_history_profile_id" ON "public"."score_history" USING "btree" ("profile_id");



CREATE INDEX "idx_scoring_configs_profile_id" ON "public"."scoring_configs" USING "btree" ("profile_id");



CREATE INDEX "idx_scoring_configuration_profile_id" ON "public"."scoring_configuration" USING "btree" ("profile_id");



CREATE INDEX "idx_scoring_rules_scoring_configuration_id" ON "public"."scoring_rules" USING "btree" ("scoring_configuration_id");



CREATE INDEX "idx_workspaces_owner_id" ON "public"."workspaces" USING "btree" ("owner_id");



ALTER TABLE ONLY "public"."bant_configuration"
    ADD CONSTRAINT "bant_configuration_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."competitive_positioning"
    ADD CONSTRAINT "competitive_positioning_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."competitor_attribute_ratings"
    ADD CONSTRAINT "competitor_attribute_ratings_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "public"."differentiation_attributes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."competitor_attribute_ratings"
    ADD CONSTRAINT "competitor_attribute_ratings_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."competitors"
    ADD CONSTRAINT "competitors_competitive_positioning_id_fkey" FOREIGN KEY ("competitive_positioning_id") REFERENCES "public"."competitive_positioning"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_scores"
    ADD CONSTRAINT "contact_scores_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_scores"
    ADD CONSTRAINT "contact_scores_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_credentials"
    ADD CONSTRAINT "crm_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_integrations"
    ADD CONSTRAINT "crm_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_framework_configuration"
    ADD CONSTRAINT "custom_framework_configuration_custom_framework_id_fkey" FOREIGN KEY ("custom_framework_id") REFERENCES "public"."custom_frameworks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_framework_configuration"
    ADD CONSTRAINT "custom_framework_configuration_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_frameworks"
    ADD CONSTRAINT "custom_frameworks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_frameworks"
    ADD CONSTRAINT "custom_frameworks_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."differentiation_attributes"
    ADD CONSTRAINT "differentiation_attributes_differentiator_id_fkey" FOREIGN KEY ("differentiator_id") REFERENCES "public"."differentiators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."differentiators"
    ADD CONSTRAINT "differentiators_competitive_positioning_id_fkey" FOREIGN KEY ("competitive_positioning_id") REFERENCES "public"."competitive_positioning"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."framework_fields"
    ADD CONSTRAINT "framework_fields_custom_framework_id_fkey" FOREIGN KEY ("custom_framework_id") REFERENCES "public"."custom_frameworks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."icp_behavioral"
    ADD CONSTRAINT "icp_behavioral_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."icp_definition"
    ADD CONSTRAINT "icp_definition_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."icp_definitions"
    ADD CONSTRAINT "icp_definitions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."icp_demographic"
    ADD CONSTRAINT "icp_demographic_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."icp_firmographic"
    ADD CONSTRAINT "icp_firmographic_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."icp_outcomes"
    ADD CONSTRAINT "icp_outcomes_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."icp_settings"
    ADD CONSTRAINT "icp_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_logs"
    ADD CONSTRAINT "import_logs_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id");



ALTER TABLE ONLY "public"."lead_routing_rules"
    ADD CONSTRAINT "lead_routing_rules_assignment_user_id_fkey" FOREIGN KEY ("assignment_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lead_routing_rules"
    ADD CONSTRAINT "lead_routing_rules_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mdcp_configuration"
    ADD CONSTRAINT "mdcp_configuration_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_profiles"
    ADD CONSTRAINT "organization_profiles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products_services"
    ADD CONSTRAINT "products_services_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_frameworks"
    ADD CONSTRAINT "profile_frameworks_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_status_audit"
    ADD CONSTRAINT "profile_status_audit_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profile_status_audit"
    ADD CONSTRAINT "profile_status_audit_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."score_history"
    ADD CONSTRAINT "score_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."score_history"
    ADD CONSTRAINT "score_history_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."score_history"
    ADD CONSTRAINT "score_history_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scoring_configs"
    ADD CONSTRAINT "scoring_configs_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scoring_configs"
    ADD CONSTRAINT "scoring_configs_scoring_framework_id_fkey" FOREIGN KEY ("scoring_framework_id") REFERENCES "public"."scoring_frameworks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scoring_configuration"
    ADD CONSTRAINT "scoring_configuration_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scoring_rules"
    ADD CONSTRAINT "scoring_rules_scoring_configuration_id_fkey" FOREIGN KEY ("scoring_configuration_id") REFERENCES "public"."scoring_configuration"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spice_configuration"
    ADD CONSTRAINT "spice_configuration_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can delete own CRM credentials" ON "public"."crm_credentials" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own CRM credentials" ON "public"."crm_credentials" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own ICP settings" ON "public"."icp_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own CRM credentials" ON "public"."crm_credentials" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own ICP settings" ON "public"."icp_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own CRM credentials" ON "public"."crm_credentials" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own ICP settings" ON "public"."icp_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."competitive_positioning" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."competitor_attribute_ratings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."competitor_ratings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."competitors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_credentials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_integrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crm_integrations_users_can_delete_own" ON "public"."crm_integrations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "crm_integrations_users_can_insert_own" ON "public"."crm_integrations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "crm_integrations_users_can_read_own" ON "public"."crm_integrations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "crm_integrations_users_can_update_own" ON "public"."crm_integrations" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."differentiation_attributes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."differentiators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."icp_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_frameworks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_user_delete" ON "public"."profiles" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "profiles_user_insert" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "profiles_user_select" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "profiles_user_update" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."score_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workspaces_owner_delete" ON "public"."workspaces" FOR DELETE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "workspaces_owner_insert" ON "public"."workspaces" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "workspaces_owner_select" ON "public"."workspaces" FOR SELECT USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "workspaces_owner_update" ON "public"."workspaces" FOR UPDATE USING (("auth"."uid"() = "owner_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_crm_integrations_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_crm_integrations_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_crm_integrations_timestamp"() TO "service_role";


















GRANT ALL ON TABLE "public"."bant_configuration" TO "anon";
GRANT ALL ON TABLE "public"."bant_configuration" TO "authenticated";
GRANT ALL ON TABLE "public"."bant_configuration" TO "service_role";



GRANT ALL ON TABLE "public"."competitive_positioning" TO "anon";
GRANT ALL ON TABLE "public"."competitive_positioning" TO "authenticated";
GRANT ALL ON TABLE "public"."competitive_positioning" TO "service_role";



GRANT ALL ON TABLE "public"."competitor_attribute_ratings" TO "anon";
GRANT ALL ON TABLE "public"."competitor_attribute_ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."competitor_attribute_ratings" TO "service_role";



GRANT ALL ON TABLE "public"."competitor_ratings" TO "anon";
GRANT ALL ON TABLE "public"."competitor_ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."competitor_ratings" TO "service_role";



GRANT ALL ON TABLE "public"."competitors" TO "anon";
GRANT ALL ON TABLE "public"."competitors" TO "authenticated";
GRANT ALL ON TABLE "public"."competitors" TO "service_role";



GRANT ALL ON TABLE "public"."contact_scores" TO "anon";
GRANT ALL ON TABLE "public"."contact_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_scores" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."crm_credentials" TO "anon";
GRANT ALL ON TABLE "public"."crm_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_credentials" TO "service_role";



GRANT ALL ON SEQUENCE "public"."crm_credentials_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."crm_credentials_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."crm_credentials_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."crm_integrations" TO "anon";
GRANT ALL ON TABLE "public"."crm_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."custom_framework_configuration" TO "anon";
GRANT ALL ON TABLE "public"."custom_framework_configuration" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_framework_configuration" TO "service_role";



GRANT ALL ON TABLE "public"."custom_frameworks" TO "anon";
GRANT ALL ON TABLE "public"."custom_frameworks" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_frameworks" TO "service_role";



GRANT ALL ON TABLE "public"."differentiation_attributes" TO "anon";
GRANT ALL ON TABLE "public"."differentiation_attributes" TO "authenticated";
GRANT ALL ON TABLE "public"."differentiation_attributes" TO "service_role";



GRANT ALL ON TABLE "public"."differentiators" TO "anon";
GRANT ALL ON TABLE "public"."differentiators" TO "authenticated";
GRANT ALL ON TABLE "public"."differentiators" TO "service_role";



GRANT ALL ON TABLE "public"."dnc_list" TO "anon";
GRANT ALL ON TABLE "public"."dnc_list" TO "authenticated";
GRANT ALL ON TABLE "public"."dnc_list" TO "service_role";



GRANT ALL ON TABLE "public"."framework_fields" TO "anon";
GRANT ALL ON TABLE "public"."framework_fields" TO "authenticated";
GRANT ALL ON TABLE "public"."framework_fields" TO "service_role";



GRANT ALL ON TABLE "public"."icp_behavioral" TO "anon";
GRANT ALL ON TABLE "public"."icp_behavioral" TO "authenticated";
GRANT ALL ON TABLE "public"."icp_behavioral" TO "service_role";



GRANT ALL ON TABLE "public"."icp_definition" TO "anon";
GRANT ALL ON TABLE "public"."icp_definition" TO "authenticated";
GRANT ALL ON TABLE "public"."icp_definition" TO "service_role";



GRANT ALL ON TABLE "public"."icp_definitions" TO "anon";
GRANT ALL ON TABLE "public"."icp_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."icp_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."icp_demographic" TO "anon";
GRANT ALL ON TABLE "public"."icp_demographic" TO "authenticated";
GRANT ALL ON TABLE "public"."icp_demographic" TO "service_role";



GRANT ALL ON TABLE "public"."icp_firmographic" TO "anon";
GRANT ALL ON TABLE "public"."icp_firmographic" TO "authenticated";
GRANT ALL ON TABLE "public"."icp_firmographic" TO "service_role";



GRANT ALL ON TABLE "public"."icp_outcomes" TO "anon";
GRANT ALL ON TABLE "public"."icp_outcomes" TO "authenticated";
GRANT ALL ON TABLE "public"."icp_outcomes" TO "service_role";



GRANT ALL ON TABLE "public"."icp_settings" TO "anon";
GRANT ALL ON TABLE "public"."icp_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."icp_settings" TO "service_role";



GRANT ALL ON SEQUENCE "public"."icp_settings_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."icp_settings_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."icp_settings_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."import_jobs" TO "anon";
GRANT ALL ON TABLE "public"."import_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."import_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."import_logs" TO "anon";
GRANT ALL ON TABLE "public"."import_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."import_logs" TO "service_role";



GRANT ALL ON TABLE "public"."lead_routing_rules" TO "anon";
GRANT ALL ON TABLE "public"."lead_routing_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_routing_rules" TO "service_role";



GRANT ALL ON TABLE "public"."mdcp_configuration" TO "anon";
GRANT ALL ON TABLE "public"."mdcp_configuration" TO "authenticated";
GRANT ALL ON TABLE "public"."mdcp_configuration" TO "service_role";



GRANT ALL ON TABLE "public"."organization_profiles" TO "anon";
GRANT ALL ON TABLE "public"."organization_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."products_services" TO "anon";
GRANT ALL ON TABLE "public"."products_services" TO "authenticated";
GRANT ALL ON TABLE "public"."products_services" TO "service_role";



GRANT ALL ON TABLE "public"."profile_frameworks" TO "anon";
GRANT ALL ON TABLE "public"."profile_frameworks" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_frameworks" TO "service_role";



GRANT ALL ON TABLE "public"."profile_status_audit" TO "anon";
GRANT ALL ON TABLE "public"."profile_status_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_status_audit" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."score_history" TO "anon";
GRANT ALL ON TABLE "public"."score_history" TO "authenticated";
GRANT ALL ON TABLE "public"."score_history" TO "service_role";



GRANT ALL ON TABLE "public"."scoring_configs" TO "anon";
GRANT ALL ON TABLE "public"."scoring_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."scoring_configs" TO "service_role";



GRANT ALL ON TABLE "public"."scoring_configuration" TO "anon";
GRANT ALL ON TABLE "public"."scoring_configuration" TO "authenticated";
GRANT ALL ON TABLE "public"."scoring_configuration" TO "service_role";



GRANT ALL ON TABLE "public"."scoring_frameworks" TO "anon";
GRANT ALL ON TABLE "public"."scoring_frameworks" TO "authenticated";
GRANT ALL ON TABLE "public"."scoring_frameworks" TO "service_role";



GRANT ALL ON TABLE "public"."scoring_rules" TO "anon";
GRANT ALL ON TABLE "public"."scoring_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."scoring_rules" TO "service_role";



GRANT ALL ON TABLE "public"."spice_configuration" TO "anon";
GRANT ALL ON TABLE "public"."spice_configuration" TO "authenticated";
GRANT ALL ON TABLE "public"."spice_configuration" TO "service_role";



GRANT ALL ON TABLE "public"."workspaces" TO "anon";
GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."workspaces" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































-- Add the owner-scoped creation registry to the supported Supabase budget.
-- Run after a verified snapshot/restore rehearsal, as the schema owner.
-- Existing financial rows are checked inside the transaction and never modified.
BEGIN;
-- Supabase SQL Editor may already have started a READ COMMITTED transaction.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='20s';
DO $$
BEGIN
    IF (SELECT array_agg(version ORDER BY version) FROM ai_money_v2.schema_version) IS DISTINCT FROM ARRAY[2] THEN
        RAISE EXCEPTION 'Unsupported budget version';
    END IF;
    IF (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='ai_money_v2') IS DISTINCT FROM current_user THEN
        RAISE EXCEPTION 'Run as the budget schema owner';
    END IF;
END $$;
CREATE TEMP TABLE release_data_guard (table_name text PRIMARY KEY, row_count bigint, digest text) ON COMMIT DROP;
DO $$
DECLARE name text; amount bigint; digest text;
BEGIN
    FOREACH name IN ARRAY ARRAY['accounts','categories','transactions','finance_users','import_batches','import_identities','bot_drafts','schema_version'] LOOP
        EXECUTE format('SELECT count(*), md5(coalesce(string_agg(to_jsonb(t)::text,chr(10) ORDER BY to_jsonb(t)::text),'''')) FROM %I.%I t','ai_money_v2',name) INTO amount,digest;
        INSERT INTO release_data_guard VALUES(name,amount,digest);
    END LOOP;
END $$;
CREATE TABLE IF NOT EXISTS ai_money_v2.entity_creations (
    user_id bigint NOT NULL,
    kind varchar(32) NOT NULL,
    client_id varchar(64) NOT NULL,
    fingerprint varchar(64) NOT NULL,
    object_id varchar(36) NOT NULL,
    PRIMARY KEY (user_id,kind,client_id)
);
ALTER TABLE ai_money_v2.entity_creations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE ai_money_v2.entity_creations FROM PUBLIC, anon, authenticated;
DO $$
DECLARE shape text[]; primary_columns name[];
BEGIN
    SELECT array_agg(attname||':'||format_type(atttypid,atttypmod)||':'||attnotnull::text ORDER BY attnum)
      INTO shape FROM pg_attribute
      WHERE attrelid='ai_money_v2.entity_creations'::regclass AND attnum>0 AND NOT attisdropped;
    IF shape IS DISTINCT FROM ARRAY['user_id:bigint:true','kind:character varying(32):true','client_id:character varying(64):true','fingerprint:character varying(64):true','object_id:character varying(36):true'] THEN
        RAISE EXCEPTION 'Unexpected creation registry definition';
    END IF;
    SELECT array_agg(a.attname ORDER BY k.ordinality) INTO primary_columns
      FROM pg_constraint c CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY k(attnum,ordinality)
      JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum
      WHERE c.conrelid='ai_money_v2.entity_creations'::regclass AND c.contype='p';
    IF primary_columns IS DISTINCT FROM ARRAY['user_id','kind','client_id']::name[] THEN
        RAISE EXCEPTION 'Unexpected creation registry primary key';
    END IF;
    IF NOT (SELECT relrowsecurity AND pg_get_userbyid(relowner)=current_user FROM pg_class WHERE oid='ai_money_v2.entity_creations'::regclass)
       OR has_table_privilege('anon','ai_money_v2.entity_creations','SELECT')
       OR has_table_privilege('authenticated','ai_money_v2.entity_creations','SELECT') THEN
        RAISE EXCEPTION 'Unexpected creation registry access';
    END IF;
END $$;
DO $$
DECLARE original record; amount bigint; digest text;
BEGIN
    FOR original IN SELECT * FROM release_data_guard LOOP
        EXECUTE format('SELECT count(*), md5(coalesce(string_agg(to_jsonb(t)::text,chr(10) ORDER BY to_jsonb(t)::text),'''')) FROM %I.%I t','ai_money_v2',original.table_name) INTO amount,digest;
        IF amount IS DISTINCT FROM original.row_count OR digest IS DISTINCT FROM original.digest THEN
            RAISE EXCEPTION 'Existing budget changed; rolling back';
        END IF;
    END LOOP;
END $$;
COMMIT;
SELECT c.relrowsecurity AS registry_rls,
       has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
       has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_select,
       pg_get_userbyid(c.relowner)=current_user AS owned_by_app_schema_owner
FROM pg_class c WHERE c.oid='ai_money_v2.entity_creations'::regclass;

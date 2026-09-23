-- Cookbook import commit helper for shared Seramet staging/production.
-- The Edge Function performs authorization and deterministic matching.
-- This SQL helper performs one recipe commit atomically.

CREATE UNIQUE INDEX IF NOT EXISTS idx_cookbook_content_source_reference_unique
  ON public.cookbook_recipe_content_versions (tenant_id, source_reference)
  WHERE source_reference IS NOT NULL;

CREATE OR REPLACE FUNCTION public.commit_cookbook_recipe_v1(
  p_tenant_id text,
  p_actor_id text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_stamp text := COALESCE(NULLIF(p_payload->>'stamp',''), now()::text);
  v_source_reference text := NULLIF(p_payload->>'sourceReference','');
  v_file_hash text := NULLIF(p_payload->>'fileHash','');
  v_importer_version text := NULLIF(p_payload->>'importerVersion','');
  v_menu jsonb := COALESCE(p_payload->'menu','{}'::jsonb);
  v_recipe jsonb := COALESCE(p_payload->'recipe','{}'::jsonb);
  v_version jsonb := COALESCE(p_payload->'version','{}'::jsonb);
  v_content jsonb := COALESCE(p_payload->'content','{}'::jsonb);
  v_unit jsonb;
  v_item jsonb;
  v_component jsonb;
  v_menu_id text := NULLIF(v_menu->>'id','');
  v_recipe_id text := NULLIF(v_recipe->>'id','');
  v_version_id text := NULLIF(v_version->>'id','');
  v_version_number integer;
  v_revision integer;
  v_correlation_id text := gen_random_uuid()::text;
  v_existing_content_id text;
BEGIN
  IF p_tenant_id IS NULL OR p_actor_id IS NULL OR v_source_reference IS NULL
     OR v_menu_id IS NULL OR v_recipe_id IS NULL OR v_version_id IS NULL THEN
    RAISE EXCEPTION 'Cookbook import payload is incomplete';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tenants WHERE id=p_tenant_id AND active=1
  ) THEN
    RAISE EXCEPTION 'Tenant is not active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE tenant_id=p_tenant_id AND id=p_actor_id AND active=1
  ) THEN
    RAISE EXCEPTION 'Seramet actor is not active';
  END IF;

  SELECT id INTO v_existing_content_id
  FROM cookbook_recipe_content_versions
  WHERE tenant_id=p_tenant_id AND source_reference=v_source_reference
  LIMIT 1;

  IF v_existing_content_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status','skipped',
      'reason','already_imported',
      'recipeId',v_recipe_id,
      'sourceReference',v_source_reference
    );
  END IF;

  FOR v_unit IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'units','[]'::jsonb))
  LOOP
    IF COALESCE((v_unit->>'create')::boolean,false) THEN
      INSERT INTO unit_definitions
        (tenant_id,id,code,name,symbol,dimension,base_scale_numerator,base_scale_denominator,
         active,created_at,updated_at)
      VALUES
        (p_tenant_id,
         v_unit->>'id',
         v_unit->>'code',
         v_unit->>'name',
         v_unit->>'symbol',
         v_unit->>'dimension',
         COALESCE((v_unit->>'baseScaleNumerator')::integer,1),
         COALESCE((v_unit->>'baseScaleDenominator')::integer,1),
         1,v_stamp,v_stamp)
      ON CONFLICT (tenant_id,code) DO NOTHING;
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'inventory','[]'::jsonb))
  LOOP
    IF COALESCE((v_item->>'create')::boolean,false) THEN
      INSERT INTO inventory_items
        (tenant_id,id,sku,name,unit,active,payload_json,code,description,base_unit_id,
         purchase_unit_id,storage_unit_id,issue_unit_id,track_inventory,track_expiry,updated_at)
      VALUES
        (p_tenant_id,
         v_item->>'id',
         v_item->>'sku',
         v_item->>'name',
         v_item->>'unitCode',
         1,
         jsonb_build_object(
           'source','COOKBOOK_IMPORT',
           'sourceReference',v_source_reference
         )::text,
         v_item->>'code',
         NULLIF(v_item->>'description',''),
         v_item->>'unitId',
         v_item->>'unitId',
         v_item->>'unitId',
         v_item->>'unitId',
         1,0,v_stamp)
      ON CONFLICT (tenant_id,sku) DO NOTHING;
    END IF;
  END LOOP;

  IF COALESCE((v_menu->>'create')::boolean,false) THEN
    INSERT INTO menu_catalog_items
      (tenant_id,id,code,sku,name,category_code,description,selling_price_minor,currency,
       service_charge_applicable,station_id,recipe_reference,modifier_group_reference,barcode,
       sellable,active,payload_json,created_at,updated_at)
    VALUES
      (p_tenant_id,
       v_menu_id,
       v_menu->>'code',
       NULL,
       v_menu->>'name',
       COALESCE(NULLIF(v_menu->>'categoryCode',''),'COOKBOOK'),
       NULLIF(v_menu->>'description',''),
       0,
       COALESCE(NULLIF(v_menu->>'currency',''),'KES'),
       0,NULL,v_recipe_id,NULL,NULL,
       0,1,
       jsonb_build_object(
         'source','COOKBOOK_IMPORT',
         'cookbookOnly',true,
         'sourceReference',v_source_reference
       )::text,
       v_stamp,v_stamp)
    ON CONFLICT (tenant_id,id) DO NOTHING;
  END IF;

  IF COALESCE((v_recipe->>'create')::boolean,false) THEN
    INSERT INTO recipes
      (tenant_id,id,menu_item_id,yield_minor,active,payload_json,name,branch_override_id,
       production_item_id,current_version_id,updated_at)
    VALUES
      (p_tenant_id,
       v_recipe_id,
       v_menu_id,
       (v_version->>'yieldQuantityMicro')::bigint,
       0,
       jsonb_build_object(
         'source','COOKBOOK_IMPORT',
         'sourceReference',v_source_reference
       )::text,
       v_recipe->>'name',
       NULL,NULL,NULL,v_stamp)
    ON CONFLICT (tenant_id,id) DO NOTHING;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM recipes
    WHERE tenant_id=p_tenant_id AND id=v_recipe_id AND menu_item_id=v_menu_id
  ) THEN
    RAISE EXCEPTION 'Resolved Seramet recipe/menu link is invalid';
  END IF;

  SELECT COALESCE(MAX(version),0)+1 INTO v_version_number
  FROM recipe_versions
  WHERE tenant_id=p_tenant_id AND recipe_id=v_recipe_id;

  INSERT INTO recipe_versions
    (tenant_id,id,recipe_id,version,yield_quantity_minor,yield_unit_id,effective_from,
     effective_to,active,packaging_cost_minor,production_overhead_minor,created_by,created_at)
  VALUES
    (p_tenant_id,
     v_version_id,
     v_recipe_id,
     v_version_number,
     (v_version->>'yieldQuantityMicro')::bigint,
     v_version->>'yieldUnitId',
     v_stamp,
     NULL,
     0,0,0,p_actor_id,v_stamp);

  FOR v_component IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'components','[]'::jsonb))
  LOOP
    INSERT INTO recipe_version_components
      (tenant_id,id,recipe_version_id,inventory_item_id,sub_recipe_id,quantity_minor,
       unit_id,waste_factor_bps,optional,station_id)
    VALUES
      (p_tenant_id,
       COALESCE(NULLIF(v_component->>'id',''),gen_random_uuid()::text),
       v_version_id,
       v_component->>'inventoryItemId',
       NULL,
       (v_component->>'quantityMicro')::bigint,
       v_component->>'unitId',
       0,0,NULL);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM recipe_version_components
    WHERE tenant_id=p_tenant_id AND recipe_version_id=v_version_id
  ) THEN
    RAISE EXCEPTION 'Recipe version requires at least one component';
  END IF;

  SELECT COALESCE(MAX(revision),0)+1 INTO v_revision
  FROM cookbook_recipe_content_versions
  WHERE tenant_id=p_tenant_id AND recipe_version_id=v_version_id;

  INSERT INTO cookbook_recipe_content_versions
    (tenant_id,id,recipe_id,recipe_version_id,revision,status,prep_minutes,cook_minutes,
     portion_label,image_url,chef_notes,method_json,media_json,source_document,
     source_reference,change_summary,created_by,created_at)
  VALUES
    (p_tenant_id,
     gen_random_uuid()::text,
     v_recipe_id,
     v_version_id,
     v_revision,
     'PUBLISHED',
     COALESCE((v_content->>'prepMinutes')::integer,0),
     COALESCE((v_content->>'cookMinutes')::integer,0),
     NULLIF(v_content->>'portionLabel',''),
     NULLIF(v_content->>'imageUrl',''),
     NULLIF(v_content->>'chefNotes',''),
     COALESCE(v_content->'method','[]'::jsonb)::text,
     COALESCE(v_content->'media','[]'::jsonb)::text,
     NULLIF(v_content->>'sourceDocument',''),
     v_source_reference,
     COALESCE(NULLIF(v_content->>'changeSummary',''),'Imported from reviewed cookbook'),
     p_actor_id,
     v_stamp);

  UPDATE recipe_versions
  SET active=0,effective_to=v_stamp
  WHERE tenant_id=p_tenant_id
    AND recipe_id=v_recipe_id
    AND id<>v_version_id
    AND active=1;

  UPDATE recipe_versions
  SET active=1,effective_to=NULL
  WHERE tenant_id=p_tenant_id AND id=v_version_id;

  UPDATE recipes
  SET current_version_id=v_version_id,
      yield_minor=(v_version->>'yieldQuantityMicro')::bigint,
      active=1,
      updated_at=v_stamp
  WHERE tenant_id=p_tenant_id AND id=v_recipe_id;

  UPDATE menu_catalog_items
  SET recipe_reference=COALESCE(recipe_reference,v_recipe_id),
      updated_at=v_stamp
  WHERE tenant_id=p_tenant_id AND id=v_menu_id;

  INSERT INTO audit_events
    (tenant_id,id,branch_id,actor_id,device_id,action,entity_type,entity_id,before_hash,
     after_hash,reason,correlation_id,session_id,ip_hash,metadata_json,created_at)
  VALUES
    (p_tenant_id,gen_random_uuid()::text,NULL,p_actor_id,NULL,
     'COOKBOOK_RECIPE_IMPORTED','RECIPE_VERSION',v_version_id,NULL,NULL,
     'Reviewed cookbook import',v_correlation_id,NULL,NULL,
     jsonb_build_object(
       'fileHash',v_file_hash,
       'importerVersion',v_importer_version,
       'sourceReference',v_source_reference,
       'recipeId',v_recipe_id,
       'version',v_version_number
     )::text,
     v_stamp);

  INSERT INTO inventory_recalculation_events
    (tenant_id,id,branch_id,event_type,entity_type,entity_id,idempotency_key,status,
     correlation_id,payload_json,created_at)
  VALUES
    (p_tenant_id,gen_random_uuid()::text,NULL,
     'RECIPE_VERSION_CHANGED','RECIPE',v_recipe_id,
     'inventory-recalc:cookbook-import:'||v_source_reference,
     'PENDING',v_correlation_id,'{}',v_stamp)
  ON CONFLICT (tenant_id,idempotency_key) DO NOTHING;

  RETURN jsonb_build_object(
    'status','imported',
    'recipeId',v_recipe_id,
    'menuItemId',v_menu_id,
    'recipeVersionId',v_version_id,
    'version',v_version_number,
    'sourceReference',v_source_reference
  );
END;
$$;

REVOKE ALL ON FUNCTION public.commit_cookbook_recipe_v1(text,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_cookbook_recipe_v1(text,text,jsonb)
  TO service_role;

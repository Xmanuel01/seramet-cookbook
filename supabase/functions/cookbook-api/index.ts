import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

type SerametContext = {
  tenantId: string
  userId: string
  email: string | null
  name: string
  roleCodes: string[]
  permissions: string[]
  branches: Array<{ id: string; name: string; code: string }>
}

type CookbookContentInput = {
  prepMinutes?: number
  cookMinutes?: number
  portionLabel?: string | null
  imageUrl?: string | null
  chefNotes?: string | null
  method?: string[]
  media?: unknown[]
  sourceDocument?: string | null
  sourceReference?: string | null
  changeSummary?: string | null
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return null
  const next = value.trim()
  if (!next) return null
  return next.slice(0, max)
}

function nonNegativeInteger(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value !== "string" || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function displayQuantity(value: unknown) {
  const number = Number(value || 0) / 1_000_000
  if (!Number.isFinite(number)) return "0"
  return Number.isInteger(number) ? String(number) : number.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")
}

function titleFromCode(value: unknown) {
  const text = String(value || "Main Dishes").trim()
  if (!text) return "Main Dishes"
  return text
    .toLowerCase()
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function readDefaultKey(envName: string, legacyName: string) {
  const raw = Deno.env.get(envName)
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed?.default === "string" && parsed.default) return parsed.default
    } catch {
      // Fall back to the legacy hosted-function variable.
    }
  }
  return Deno.env.get(legacyName) || ""
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
const publishableKey = readDefaultKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY")
const secretKey = readDefaultKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY")

if (!supabaseUrl || !publishableKey || !secretKey) {
  throw new Error("Supabase function environment is incomplete")
}

const admin = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function authenticate(req: Request): Promise<SerametContext> {
  const authorization = req.headers.get("Authorization") || ""
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : ""
  if (!token) throw Object.assign(new Error("Authentication required"), { status: 401 })

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: authData, error: authError } = await authClient.auth.getUser(token)
  if (authError || !authData.user) {
    throw Object.assign(new Error("Invalid or expired session"), { status: 401 })
  }

  const { data: identity, error: identityError } = await admin
    .from("identity_accounts")
    .select("tenant_id,user_id,email")
    .eq("provider", "supabase")
    .eq("subject", authData.user.id)
    .limit(1)
    .maybeSingle()

  if (identityError) throw identityError
  if (!identity) {
    throw Object.assign(
      new Error("This Supabase account is not linked to a Seramet user."),
      { status: 403 },
    )
  }

  const [{ data: user, error: userError }, { data: roleLinks, error: roleError }] =
    await Promise.all([
      admin
        .from("users")
        .select("name,active,employment_status")
        .eq("tenant_id", identity.tenant_id)
        .eq("id", identity.user_id)
        .maybeSingle(),
      admin
        .from("user_roles")
        .select("role_id")
        .eq("tenant_id", identity.tenant_id)
        .eq("user_id", identity.user_id),
    ])

  if (userError) throw userError
  if (roleError) throw roleError
  if (!user || Number(user.active) !== 1 || user.employment_status === "TERMINATED") {
    throw Object.assign(new Error("Your Seramet user is not active."), { status: 403 })
  }

  const roleIds = [...new Set((roleLinks || []).map((row) => String(row.role_id)))]
  let roleCodes: string[] = []
  let permissions: string[] = []

  if (roleIds.length > 0) {
    const [{ data: roles, error: rolesError }, { data: permissionRows, error: permissionsError }] =
      await Promise.all([
        admin
          .from("roles")
          .select("id,code,active")
          .eq("tenant_id", identity.tenant_id)
          .in("id", roleIds),
        admin
          .from("role_permissions")
          .select("role_id,permission_code")
          .eq("tenant_id", identity.tenant_id)
          .in("role_id", roleIds),
      ])
    if (rolesError) throw rolesError
    if (permissionsError) throw permissionsError

    const activeRoleIds = new Set(
      (roles || []).filter((role) => Number(role.active) === 1).map((role) => String(role.id)),
    )
    roleCodes = (roles || [])
      .filter((role) => activeRoleIds.has(String(role.id)))
      .map((role) => String(role.code))
    permissions = [
      ...new Set(
        (permissionRows || [])
          .filter((row) => activeRoleIds.has(String(row.role_id)))
          .map((row) => String(row.permission_code)),
      ),
    ]
  }

  const allBranches = permissions.includes("scope.branches.all")
  let branchRows: Array<{ id: string; name: string; code: string }> = []

  if (allBranches) {
    const { data, error } = await admin
      .from("branches")
      .select("id,name,code")
      .eq("tenant_id", identity.tenant_id)
      .eq("active", 1)
      .order("name")
    if (error) throw error
    branchRows = (data || []).map((branch) => ({
      id: String(branch.id),
      name: String(branch.name),
      code: String(branch.code),
    }))
  } else {
    const { data: assignments, error: assignmentsError } = await admin
      .from("user_branches")
      .select("branch_id")
      .eq("tenant_id", identity.tenant_id)
      .eq("user_id", identity.user_id)
    if (assignmentsError) throw assignmentsError

    const branchIds = [...new Set((assignments || []).map((row) => String(row.branch_id)))]
    if (branchIds.length > 0) {
      const { data, error } = await admin
        .from("branches")
        .select("id,name,code")
        .eq("tenant_id", identity.tenant_id)
        .eq("active", 1)
        .in("id", branchIds)
        .order("name")
      if (error) throw error
      branchRows = (data || []).map((branch) => ({
        id: String(branch.id),
        name: String(branch.name),
        code: String(branch.code),
      }))
    }
  }

  return {
    tenantId: String(identity.tenant_id),
    userId: String(identity.user_id),
    email: identity.email ? String(identity.email) : authData.user.email || null,
    name: String(user.name),
    roleCodes,
    permissions,
    branches: branchRows,
  }
}

function requirePermission(context: SerametContext, permission: string) {
  if (!context.permissions.includes(permission)) {
    throw Object.assign(new Error("Your Seramet role does not permit this cookbook action."), {
      status: 403,
    })
  }
}

function canSeeBranch(context: SerametContext, branchId: string | null | undefined) {
  if (!branchId) return true
  if (context.permissions.includes("scope.branches.all")) return true
  return context.branches.some((branch) => branch.id === branchId)
}

async function profile(context: SerametContext) {
  requirePermission(context, "cookbook.view")

  const { data: tenant, error } = await admin
    .from("tenants")
    .select("trading_name,legal_name")
    .eq("id", context.tenantId)
    .maybeSingle()
  if (error) throw error

  const canManage = context.permissions.includes("cookbook.manage")
  const canPublish = context.permissions.includes("cookbook.publish")
  const role: "admin" | "editor" | "viewer" =
    context.roleCodes.includes("ACCOUNT_OWNER") || context.roleCodes.includes("TENANT_ADMINISTRATOR")
      ? "admin"
      : canManage
        ? "editor"
        : "viewer"

  return {
    id: context.tenantId,
    name: String(tenant?.trading_name || tenant?.legal_name || "Seramet"),
    role,
    userId: context.userId,
    userName: context.name,
    permissions: context.permissions,
    canManage,
    canPublish,
    branches: context.branches,
  }
}

async function loadRecipes(context: SerametContext, onlyRecipeId?: string) {
  requirePermission(context, "cookbook.view")

  let recipeQuery = admin
    .from("recipes")
    .select("id,menu_item_id,yield_minor,active,payload_json,name,branch_override_id,production_item_id,current_version_id")
    .eq("tenant_id", context.tenantId)
    .eq("active", 1)

  if (onlyRecipeId) recipeQuery = recipeQuery.eq("id", onlyRecipeId)

  const { data: rawRecipes, error: recipeError } = await recipeQuery.order("name")
  if (recipeError) throw recipeError

  const recipes = (rawRecipes || []).filter((recipe) =>
    canSeeBranch(context, recipe.branch_override_id ? String(recipe.branch_override_id) : null),
  )

  if (recipes.length === 0) return []

  const recipeIds = recipes.map((recipe) => String(recipe.id))
  const menuIds = [...new Set(recipes.map((recipe) => String(recipe.menu_item_id)).filter(Boolean))]
  const versionIds = [
    ...new Set(recipes.map((recipe) => recipe.current_version_id ? String(recipe.current_version_id) : "").filter(Boolean)),
  ]

  const menuPromise = menuIds.length
    ? admin
        .from("menu_catalog_items")
        .select("id,name,category_code,description,recipe_reference")
        .eq("tenant_id", context.tenantId)
        .in("id", menuIds)
    : Promise.resolve({ data: [], error: null } as const)

  const versionsPromise = versionIds.length
    ? admin
        .from("recipe_versions")
        .select("id,recipe_id,version,yield_quantity_minor,yield_unit_id,active")
        .eq("tenant_id", context.tenantId)
        .in("id", versionIds)
    : Promise.resolve({ data: [], error: null } as const)

  const versionComponentsPromise = versionIds.length
    ? admin
        .from("recipe_version_components")
        .select("id,recipe_version_id,inventory_item_id,sub_recipe_id,quantity_minor,unit_id,optional")
        .eq("tenant_id", context.tenantId)
        .in("recipe_version_id", versionIds)
    : Promise.resolve({ data: [], error: null } as const)

  const legacyComponentsPromise = admin
    .from("recipe_components")
    .select("id,recipe_id,inventory_item_id,quantity_minor")
    .eq("tenant_id", context.tenantId)
    .in("recipe_id", recipeIds)

  const cookbookPromise = versionIds.length
    ? admin
        .from("cookbook_recipe_content_versions")
        .select("id,recipe_id,recipe_version_id,revision,status,prep_minutes,cook_minutes,portion_label,image_url,chef_notes,method_json,media_json")
        .eq("tenant_id", context.tenantId)
        .in("recipe_version_id", versionIds)
        .order("revision", { ascending: false })
    : Promise.resolve({ data: [], error: null } as const)

  const [menuResult, versionsResult, versionComponentsResult, legacyComponentsResult, cookbookResult] =
    await Promise.all([
      menuPromise,
      versionsPromise,
      versionComponentsPromise,
      legacyComponentsPromise,
      cookbookPromise,
    ])

  for (const result of [
    menuResult,
    versionsResult,
    versionComponentsResult,
    legacyComponentsResult,
    cookbookResult,
  ]) {
    if (result.error) throw result.error
  }

  const menuMap = new Map((menuResult.data || []).map((row) => [String(row.id), row]))
  const versionMap = new Map((versionsResult.data || []).map((row) => [String(row.id), row]))
  const latestContentMap = new Map<string, any>()
  for (const row of cookbookResult.data || []) {
    const key = String(row.recipe_version_id)
    if (!latestContentMap.has(key)) latestContentMap.set(key, row)
  }

  const versionComponents = versionComponentsResult.data || []
  const legacyComponents = legacyComponentsResult.data || []

  const inventoryIds = [
    ...new Set([
      ...versionComponents.map((row) => row.inventory_item_id ? String(row.inventory_item_id) : "").filter(Boolean),
      ...legacyComponents.map((row) => row.inventory_item_id ? String(row.inventory_item_id) : "").filter(Boolean),
    ]),
  ]
  const componentUnitIds = [
    ...new Set(versionComponents.map((row) => row.unit_id ? String(row.unit_id) : "").filter(Boolean)),
  ]
  const yieldUnitIds = [
    ...new Set((versionsResult.data || []).map((row) => row.yield_unit_id ? String(row.yield_unit_id) : "").filter(Boolean)),
  ]

  const inventoryResult = inventoryIds.length
    ? await admin
        .from("inventory_items")
        .select("id,name,base_unit_id,unit")
        .eq("tenant_id", context.tenantId)
        .in("id", inventoryIds)
    : { data: [], error: null }

  if (inventoryResult.error) throw inventoryResult.error
  const inventoryMap = new Map((inventoryResult.data || []).map((row) => [String(row.id), row]))

  const legacyUnitIds = [
    ...new Set(
      (inventoryResult.data || [])
        .map((row) => row.base_unit_id ? String(row.base_unit_id) : row.unit ? String(row.unit) : "")
        .filter(Boolean),
    ),
  ]
  const unitIds = [...new Set([...componentUnitIds, ...yieldUnitIds, ...legacyUnitIds])]
  const unitsResult = unitIds.length
    ? await admin
        .from("unit_definitions")
        .select("id,code,name,symbol")
        .eq("tenant_id", context.tenantId)
        .in("id", unitIds)
    : { data: [], error: null }

  if (unitsResult.error) throw unitsResult.error
  const unitMap = new Map((unitsResult.data || []).map((row) => [String(row.id), row]))
  const recipeNameMap = new Map(
    recipes.map((recipe) => [
      String(recipe.id),
      String(recipe.name || menuMap.get(String(recipe.menu_item_id))?.name || "Sub-recipe"),
    ]),
  )

  return recipes.map((recipe, index) => {
    const id = String(recipe.id)
    const menu = menuMap.get(String(recipe.menu_item_id))
    const versionId = recipe.current_version_id ? String(recipe.current_version_id) : null
    const version = versionId ? versionMap.get(versionId) : null
    const content = versionId ? latestContentMap.get(versionId) : null

    const activeComponents = versionId
      ? versionComponents.filter((component) => String(component.recipe_version_id) === versionId)
      : []

    const legacy = legacyComponents.filter((component) => String(component.recipe_id) === id)
    const componentRows = activeComponents.length > 0 ? activeComponents : legacy

    const ingredients = componentRows.map((component: any) => {
      const inventoryId = component.inventory_item_id ? String(component.inventory_item_id) : null
      const inventory = inventoryId ? inventoryMap.get(inventoryId) : null
      const unitId =
        component.unit_id
          ? String(component.unit_id)
          : inventory?.base_unit_id
            ? String(inventory.base_unit_id)
            : inventory?.unit
              ? String(inventory.unit)
              : ""
      const unit = unitId ? unitMap.get(unitId) : null
      const unitLabel = String(unit?.symbol || unit?.code || unit?.name || "").trim()
      const subRecipeId = component.sub_recipe_id ? String(component.sub_recipe_id) : null

      return {
        id: String(component.id),
        name: String(inventory?.name || (subRecipeId ? recipeNameMap.get(subRecipeId) : null) || "Recipe component"),
        quantity: `${displayQuantity(component.quantity_minor)}${unitLabel ? " " + unitLabel : ""}`,
      }
    })

    const yieldMicro = version?.yield_quantity_minor ?? recipe.yield_minor ?? 1_000_000
    const yieldQuantity = Math.max(0.000001, Number(yieldMicro) / 1_000_000)
    const yieldUnitId = version?.yield_unit_id ? String(version.yield_unit_id) : ""
    const yieldUnit = yieldUnitId ? unitMap.get(yieldUnitId) : null
    const yieldLabel = String(yieldUnit?.symbol || yieldUnit?.code || yieldUnit?.name || "").trim()

    const gradients = [
      "linear-gradient(135deg, #2e756c 0%, #5d9f7a 48%, #d7b56f 100%)",
      "linear-gradient(135deg, #8a5b34 0%, #ca925d 46%, #50734a 100%)",
      "linear-gradient(135deg, #673127 0%, #a54c34 52%, #cf805c 100%)",
    ]

    return {
      id,
      name: String(recipe.name || menu?.name || "Unnamed recipe"),
      category: titleFromCode(menu?.category_code),
      description: String(menu?.description || ""),
      portions: yieldQuantity,
      portionSize:
        String(content?.portion_label || "").trim() ||
        `${displayQuantity(yieldMicro)}${yieldLabel ? " " + yieldLabel : ""}`,
      prepMinutes: nonNegativeInteger(content?.prep_minutes),
      cookMinutes: nonNegativeInteger(content?.cook_minutes),
      image: String(content?.image_url || gradients[index % gradients.length]),
      ingredients,
      method: parseJsonArray(content?.method_json).filter((step) => typeof step === "string"),
      notes: String(content?.chef_notes || ""),
      published: content?.status === "PUBLISHED",
      version: Number(version?.version || 1),
      recipeVersionId: versionId,
      menuItemId: String(recipe.menu_item_id),
      branchOverrideId: recipe.branch_override_id ? String(recipe.branch_override_id) : null,
      contentRevision: Number(content?.revision || 0),
      serametItemId: recipe.production_item_id ? String(recipe.production_item_id) : null,
    }
  })
}

async function saveContent(
  context: SerametContext,
  recipeId: string,
  recipeVersionId: string,
  content: CookbookContentInput,
  publish: boolean,
) {
  requirePermission(context, publish ? "cookbook.publish" : "cookbook.manage")
  if (!publish) requirePermission(context, "cookbook.manage")

  const { data: recipe, error: recipeError } = await admin
    .from("recipes")
    .select("id,branch_override_id,current_version_id")
    .eq("tenant_id", context.tenantId)
    .eq("id", recipeId)
    .eq("active", 1)
    .maybeSingle()
  if (recipeError) throw recipeError
  if (!recipe) throw Object.assign(new Error("Recipe not found."), { status: 404 })
  if (!canSeeBranch(context, recipe.branch_override_id ? String(recipe.branch_override_id) : null)) {
    throw Object.assign(new Error("This recipe is outside your Seramet branch scope."), { status: 403 })
  }
  if (String(recipe.current_version_id || "") !== recipeVersionId) {
    throw Object.assign(
      new Error("The recipe version changed in Seramet. Reload before saving cookbook content."),
      { status: 409 },
    )
  }

  const { data: version, error: versionError } = await admin
    .from("recipe_versions")
    .select("id")
    .eq("tenant_id", context.tenantId)
    .eq("id", recipeVersionId)
    .eq("recipe_id", recipeId)
    .maybeSingle()
  if (versionError) throw versionError
  if (!version) throw Object.assign(new Error("Recipe version not found."), { status: 404 })

  const { data: previous, error: previousError } = await admin
    .from("cookbook_recipe_content_versions")
    .select("revision")
    .eq("tenant_id", context.tenantId)
    .eq("recipe_version_id", recipeVersionId)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (previousError) throw previousError

  const method = Array.isArray(content.method)
    ? content.method
        .filter((step): step is string => typeof step === "string")
        .map((step) => step.trim())
        .filter(Boolean)
        .slice(0, 100)
        .map((step) => step.slice(0, 4000))
    : []

  const media = Array.isArray(content.media) ? content.media.slice(0, 30) : []
  const stamp = new Date().toISOString()

  const { error: insertError } = await admin
    .from("cookbook_recipe_content_versions")
    .insert({
      tenant_id: context.tenantId,
      id: crypto.randomUUID(),
      recipe_id: recipeId,
      recipe_version_id: recipeVersionId,
      revision: Number(previous?.revision || 0) + 1,
      status: publish ? "PUBLISHED" : "DRAFT",
      prep_minutes: nonNegativeInteger(content.prepMinutes),
      cook_minutes: nonNegativeInteger(content.cookMinutes),
      portion_label: cleanText(content.portionLabel, 120),
      image_url: cleanText(content.imageUrl, 1000),
      chef_notes: cleanText(content.chefNotes, 8000),
      method_json: JSON.stringify(method),
      media_json: JSON.stringify(media),
      source_document: cleanText(content.sourceDocument, 300),
      source_reference: cleanText(content.sourceReference, 500),
      change_summary: cleanText(content.changeSummary, 500),
      created_by: context.userId,
      created_at: stamp,
    })

  if (insertError) throw insertError

  const refreshed = await loadRecipes(context, recipeId)
  if (!refreshed[0]) throw new Error("Recipe was saved but could not be reloaded.")
  return refreshed[0]
}


function normalizeLookup(value: unknown) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function importIssue(code: string, message: string, severity: "info" | "review" | "blocked" = "review") {
  return { code, message, severity }
}

async function previewImport(context: SerametContext, body: any) {
  requirePermission(context, "cookbook.manage")

  const fileName = cleanText(body?.fileName, 255)
  const fileHash = cleanText(body?.fileHash, 128)
  const importerVersion = cleanText(body?.importerVersion, 80)
  const recipes = Array.isArray(body?.recipes) ? body.recipes : []

  if (!fileName || !fileHash || !/^[a-f0-9]{64}$/i.test(fileHash) || !importerVersion) {
    throw Object.assign(new Error("Import file metadata is invalid."), { status: 400 })
  }
  if (recipes.length === 0 || recipes.length > 300) {
    throw Object.assign(new Error("Cookbook preview must contain between 1 and 300 recipes."), { status: 400 })
  }

  const totalIngredients = recipes.reduce(
    (sum: number, recipe: any) => sum + (Array.isArray(recipe?.ingredients) ? recipe.ingredients.length : 0),
    0,
  )
  if (totalIngredients > 6000) {
    throw Object.assign(new Error("Cookbook contains too many ingredient rows for one review batch."), { status: 400 })
  }

  const [
    { data: recipeRows, error: recipesError },
    { data: menuRows, error: menuError },
    { data: inventoryRows, error: inventoryError },
    { data: unitRows, error: unitsError },
  ] = await Promise.all([
    admin
      .from("recipes")
      .select("id,name,menu_item_id,current_version_id")
      .eq("tenant_id", context.tenantId)
      .eq("active", 1),
    admin
      .from("menu_catalog_items")
      .select("id,name,recipe_reference")
      .eq("tenant_id", context.tenantId)
      .eq("active", 1),
    admin
      .from("inventory_items")
      .select("id,name,code,base_unit_id")
      .eq("tenant_id", context.tenantId)
      .eq("active", 1),
    admin
      .from("unit_definitions")
      .select("id,code")
      .eq("tenant_id", context.tenantId)
      .eq("active", 1),
  ])

  if (recipesError) throw recipesError
  if (menuError) throw menuError
  if (inventoryError) throw inventoryError
  if (unitsError) throw unitsError

  const recipeByName = new Map(
    (recipeRows || [])
      .filter((row) => normalizeLookup(row.name))
      .map((row) => [normalizeLookup(row.name), row]),
  )
  const menuByName = new Map(
    (menuRows || [])
      .filter((row) => normalizeLookup(row.name))
      .map((row) => [normalizeLookup(row.name), row]),
  )
  const inventoryByName = new Map(
    (inventoryRows || [])
      .filter((row) => normalizeLookup(row.name))
      .map((row) => [normalizeLookup(row.name), row]),
  )
  const configuredUnits = new Set((unitRows || []).map((row) => String(row.code).toUpperCase()))

  const rows = recipes.map((rawRecipe: any, recipeIndex: number) => {
    const name = cleanText(rawRecipe?.name, 200) || `Recipe ${recipeIndex + 1}`
    const category = cleanText(rawRecipe?.category, 120) || "Uncategorised"
    const key = normalizeLookup(name)
    const existingRecipe: any = recipeByName.get(key) || null
    const existingMenu: any = menuByName.get(key) || null
    const clientIssues = Array.isArray(rawRecipe?.issues)
      ? rawRecipe.issues.slice(0, 100).map((item: any) => ({
          code: cleanText(item?.code, 80) || "SOURCE_REVIEW",
          message: cleanText(item?.message, 500) || "Source requires review.",
          severity:
            item?.severity === "blocked" || item?.severity === "info"
              ? item.severity
              : "review",
        }))
      : []

    const ingredients = Array.isArray(rawRecipe?.ingredients) ? rawRecipe.ingredients.slice(0, 250) : []
    const ingredientMatches = ingredients.map((ingredient: any, ingredientIndex: number) => {
      const ingredientName = cleanText(ingredient?.name, 200) || `Ingredient ${ingredientIndex + 1}`
      const inventory: any = inventoryByName.get(normalizeLookup(ingredientName)) || null
      const unitCode = cleanText(ingredient?.quantity?.unitCode, 40)?.toUpperCase() || null

      if (unitCode && !configuredUnits.has(unitCode)) {
        clientIssues.push(importIssue(
          "UNIT_CREATE_CANDIDATE",
          `Unit ${unitCode} is not configured in this Seramet tenant yet; it will need mapping or controlled creation before commit.`,
          "info",
        ))
      }

      return {
        ingredientId: cleanText(ingredient?.id, 100) || `ingredient-${recipeIndex + 1}-${ingredientIndex + 1}`,
        inventoryItemId: inventory ? String(inventory.id) : null,
        match: inventory ? "existing" : "create-candidate",
      }
    })

    if (existingRecipe) {
      clientIssues.push(importIssue(
        "EXISTING_RECIPE_MATCH",
        "A Seramet recipe with this name already exists. Commit must create a new governed version instead of duplicating it.",
        "info",
      ))
    } else if (existingMenu) {
      clientIssues.push(importIssue(
        "EXISTING_MENU_MATCH",
        "A Seramet menu item with this name exists and can be linked to the imported recipe.",
        "info",
      ))
    }

    const hasBlocked = clientIssues.some((item: any) => item.severity === "blocked")
    const hasReview = clientIssues.some((item: any) => item.severity === "review")

    return {
      ...rawRecipe,
      name,
      category,
      issues: clientIssues,
      status: hasBlocked ? "blocked" : hasReview ? "review" : "ready",
      recipeId: existingRecipe ? String(existingRecipe.id) : null,
      menuItemId: existingRecipe
        ? String(existingRecipe.menu_item_id)
        : existingMenu
          ? String(existingMenu.id)
          : null,
      recipeMatch: existingRecipe
        ? "existing-recipe"
        : existingMenu
          ? "existing-menu"
          : "new",
      ingredientMatches,
    }
  })

  return {
    fileName,
    fileHash,
    importerVersion,
    recipeCount: rows.length,
    readyCount: rows.filter((row: any) => row.status === "ready").length,
    reviewCount: rows.filter((row: any) => row.status === "review").length,
    blockedCount: rows.filter((row: any) => row.status === "blocked").length,
    rows,
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return response({ ok: false, error: "Method not allowed" }, 405)

  try {
    const context = await authenticate(req)
    const body = await req.json().catch(() => ({}))
    const action = typeof body?.action === "string" ? body.action : ""

    if (action === "profile") {
      return response({ ok: true, data: await profile(context) })
    }

    if (action === "listRecipes") {
      return response({ ok: true, data: await loadRecipes(context) })
    }

    if (action === "previewImport") {
      return response({ ok: true, data: await previewImport(context, body) })
    }

    if (action === "getRecipe") {
      const recipeId = cleanText(body?.recipeId, 200)
      if (!recipeId) return response({ ok: false, error: "recipeId is required" }, 400)
      const rows = await loadRecipes(context, recipeId)
      if (!rows[0]) return response({ ok: false, error: "Recipe not found" }, 404)
      return response({ ok: true, data: rows[0] })
    }

    if (action === "saveContent" || action === "publishContent") {
      const recipeId = cleanText(body?.recipeId, 200)
      const recipeVersionId = cleanText(body?.recipeVersionId, 200)
      if (!recipeId || !recipeVersionId) {
        return response({ ok: false, error: "recipeId and recipeVersionId are required" }, 400)
      }
      const content =
        body?.content && typeof body.content === "object"
          ? (body.content as CookbookContentInput)
          : {}
      const saved = await saveContent(
        context,
        recipeId,
        recipeVersionId,
        content,
        action === "publishContent",
      )
      return response({ ok: true, data: saved })
    }

    return response({ ok: false, error: "Unknown cookbook action" }, 400)
  } catch (error) {
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status?: number }).status || 500)
        : 500
    const message = error instanceof Error ? error.message : "Cookbook service failed."
    console.error("cookbook-api", { status, message })
    return response({ ok: false, error: message }, status)
  }
})

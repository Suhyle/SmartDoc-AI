import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SOURCE_ORDER = [
  "PSC",
  "SSC",
  "UPSC",
  "Railway",
  "Banking",
] as const;

type SourceStatus = {
  source: string;
  success: boolean;
  dry_run: boolean;
  inserted: number;
  updated: number;
  duplicates: number;
  skipped: number;
  found: number;
  error: string | null;
};

function safeJsonParse(raw: string | null): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { error: raw };
  }
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getBankSourceName(sourceLabel: string): string | null {
  const label = sourceLabel.toLowerCase();
  if (label.includes("sbi")) return "SBI";
  if (label.includes("ibps")) return "IBPS";
  if (label.includes("rbi")) return "RBI";
  return null;
}

function normalizeSourceName(label: string | undefined): string | null {
  const value = String(label || "").trim();
  if (!value) return null;
  const upper = value.toUpperCase();
  if (upper.includes("PSC")) return "PSC";
  if (upper.includes("SSC")) return "SSC";
  if (upper.includes("UPSC")) return "UPSC";
  if (upper.includes("RAILWAY") || upper.includes("RRB") || upper.includes("CEN")) return "Railway";
  if (upper.includes("SBI")) return "SBI";
  if (upper.includes("IBPS")) return "IBPS";
  if (upper.includes("RBI")) return "RBI";
  return null;
}

function summarizeSourceStatus(payload: unknown, sourceName: string): SourceStatus {
  const object = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const entries = Array.isArray(object.sources) ? object.sources as Record<string, unknown>[] : [];

  const directSource = entries.find((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const label = String((entry as Record<string, unknown>).source ?? (entry as Record<string, unknown>).name ?? "");
    return normalizeSourceName(label) === sourceName || label.toLowerCase().includes(sourceName.toLowerCase());
  });

  const sourceMeta = directSource ?? object;
  const inserted = toNumber((sourceMeta as Record<string, unknown>).inserted ?? (sourceMeta as Record<string, unknown>).new_records ?? 0);
  const updated = toNumber((sourceMeta as Record<string, unknown>).updated ?? (sourceMeta as Record<string, unknown>).updated_records ?? 0);
  const duplicates = toNumber((sourceMeta as Record<string, unknown>).duplicate ?? (sourceMeta as Record<string, unknown>).duplicates ?? 0);
  const skipped = toNumber((sourceMeta as Record<string, unknown>).skipped ?? 0);
  const found = toNumber((sourceMeta as Record<string, unknown>).found ?? (sourceMeta as Record<string, unknown>).discovered ?? (sourceMeta as Record<string, unknown>).parsed ?? 0);
  const errorValue = (sourceMeta as Record<string, unknown>).error ?? (sourceMeta as Record<string, unknown>).message ?? null;
  const sourceErrors = Array.isArray((sourceMeta as Record<string, unknown>).errors)
    ? ((sourceMeta as Record<string, unknown>).errors as unknown[]).filter((value) => typeof value === "string" && value.trim())
    : [];
  const error = typeof errorValue === "string" && errorValue.trim()
    ? errorValue
    : sourceErrors.length ? sourceErrors.slice(0, 2).join("; ") : null;

  return {
    source: sourceName,
    success: (sourceMeta as Record<string, unknown>).success !== false && !error,
    dry_run: Boolean((sourceMeta as Record<string, unknown>).dry_run ?? true),
    inserted,
    updated,
    duplicates,
    skipped,
    found,
    error,
  };
}

function summarizePayload(sourceName: string, payload: unknown): SourceStatus[] {
  const object = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const entries = Array.isArray(object.sources) ? object.sources as Record<string, unknown>[] : [];

  if (!entries.length) {
    return [summarizeSourceStatus(payload, sourceName)];
  }

  const mapped: SourceStatus[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const rawSource = String((entry as Record<string, unknown>).source ?? (entry as Record<string, unknown>).name ?? "");
    const normalized = normalizeSourceName(rawSource) ?? getBankSourceName(rawSource) ?? sourceName;
    const entryErrors = Array.isArray((entry as Record<string, unknown>).errors)
      ? ((entry as Record<string, unknown>).errors as unknown[]).filter((value) => typeof value === "string" && value.trim())
      : [];
    const entryError = typeof (entry as Record<string, unknown>).error === "string" && String((entry as Record<string, unknown>).error).trim()
      ? String((entry as Record<string, unknown>).error)
      : typeof (entry as Record<string, unknown>).message === "string" && String((entry as Record<string, unknown>).message).trim()
        ? String((entry as Record<string, unknown>).message)
        : entryErrors.length ? entryErrors.slice(0, 2).join("; ") : null;
    mapped.push({
      source: normalized,
      success: (entry as Record<string, unknown>).success !== false && !entryError,
      dry_run: Boolean((entry as Record<string, unknown>).dry_run ?? true),
      inserted: toNumber((entry as Record<string, unknown>).inserted ?? 0),
      updated: toNumber((entry as Record<string, unknown>).updated ?? 0),
      duplicates: toNumber((entry as Record<string, unknown>).duplicate ?? (entry as Record<string, unknown>).duplicates ?? 0),
      skipped: toNumber((entry as Record<string, unknown>).skipped ?? 0),
      found: toNumber((entry as Record<string, unknown>).found ?? (entry as Record<string, unknown>).discovered ?? (entry as Record<string, unknown>).parsed ?? 0),
      error: entryError,
    });
  }

  const deduped = new Map<string, SourceStatus>();
  for (const item of mapped) {
    const existing = deduped.get(item.source);
    if (!existing) {
      deduped.set(item.source, item);
      continue;
    }
    deduped.set(item.source, {
      source: item.source,
      success: existing.success || item.success,
      dry_run: existing.dry_run || item.dry_run,
      inserted: existing.inserted + item.inserted,
      updated: existing.updated + item.updated,
      duplicates: existing.duplicates + item.duplicates,
      skipped: existing.skipped + item.skipped,
      found: existing.found + item.found,
      error: existing.error ?? item.error,
    });
  }
  return [...deduped.values()];
}

async function invokeFunction(functionName: string, dryRun: boolean): Promise<unknown> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return { success: false, error: "Supabase Edge credentials are not configured in this deployment." };
  }

  const url = new URL(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/${functionName}`);
  url.searchParams.set("dry_run", String(dryRun));

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dry_run: dryRun, trigger: "manual_refresh" }),
  });

  const text = await response.text();
  const payload = safeJsonParse(text);
  if (!response.ok) {
    const payloadObject = payload as Record<string, unknown>;
    const sourceErrors = Array.isArray(payloadObject?.errors)
      ? payloadObject.errors.filter((value) => typeof value === "string").slice(0, 3).join(" | ")
      : "";
    const message = typeof payloadObject?.error === "string"
      ? String(payloadObject.error)
      : typeof payloadObject?.message === "string"
        ? `${String(payloadObject.message)}${sourceErrors ? ` Details: ${sourceErrors}` : ""}`
        : `Remote source function ${functionName} returned HTTP ${response.status}.${sourceErrors ? ` Details: ${sourceErrors}` : ""}`;
    return { success: false, error: message };
  }
  return payload;
}

function getFunctionForSource(source: string): string {
  switch (source) {
    case "PSC":
      return "fetch-psc-notifications";
    case "SSC":
      return "fetch-ssc-notifications";
    case "UPSC":
      return "fetch-upsc-notifications";
    case "Railway":
      return "fetch-railway-notifications";
    default:
      return "fetch-banking-notifications";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Use POST to trigger an exam notifications refresh." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const dryRun = body.dry_run === true || body.mode === "dry_run";
  const sourceStatuses: SourceStatus[] = [];
  let deletedExpired = 0;

  for (const source of SOURCE_ORDER) {
    try {
      const result = await invokeFunction(getFunctionForSource(source), dryRun);
      const results = summarizePayload(source, result);
      for (const item of results) {
        sourceStatuses.push({
          ...item,
          dry_run: dryRun,
        });
      }
    } catch (error) {
      sourceStatuses.push({
        source,
        success: false,
        dry_run: dryRun,
        inserted: 0,
        updated: 0,
        duplicates: 0,
        skipped: 0,
        found: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!dryRun) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceRoleKey) {
      const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
      try {
        const { data, error } = await supabase.rpc("delete_expired_exam_notifications");
        if (error) {
          console.error("delete_expired_exam_notifications failed:", error.message);
        } else {
          deletedExpired = Number(data ?? 0);
        }
      } catch (error) {
        console.error("delete_expired_exam_notifications request failed:", error);
      }
    }
  }

  const flatStatuses = new Map<string, SourceStatus>();
  for (const item of sourceStatuses) {
    const existing = flatStatuses.get(item.source);
    if (!existing) {
      flatStatuses.set(item.source, item);
      continue;
    }
    flatStatuses.set(item.source, {
      source: item.source,
      success: existing.success || item.success,
      dry_run: dryRun,
      inserted: existing.inserted + item.inserted,
      updated: existing.updated + item.updated,
      duplicates: existing.duplicates + item.duplicates,
      skipped: existing.skipped + item.skipped,
      found: existing.found + item.found,
      error: existing.error ?? item.error,
    });
  }

  const statuses = [...flatStatuses.values()];
  const successCount = statuses.filter((status) => status.success).length;
  const failureCount = statuses.length - successCount;
  const response = {
    success: successCount > 0 || failureCount === 0,
    dry_run: dryRun,
    partial_failure: failureCount > 0 && successCount > 0,
    deleted_expired: deletedExpired,
    sources: Object.fromEntries(statuses.map((status) => [status.source, status])),
    message: successCount > 0
      ? (failureCount > 0 ? "Exam notifications refreshed; some official sources are currently unavailable or blocked." : "Exam notifications refreshed successfully.")
      : "Unable to refresh exam notifications from the available official sources.",
  };

  return new Response(JSON.stringify(response), {
    status: successCount > 0 ? 200 : 502,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

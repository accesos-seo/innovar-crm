/**
 * Centralized Supabase / network error handling.
 *
 * The previous pattern across the codebase was:
 *   if (error) { console.warn(error); return []; }
 *
 * That silently swallows real failures — the user sees "saved correctly"
 * even when the insert failed. This module replaces that pattern with
 * a structured, throw-based approach that React Query can capture and
 * surface as `isError`.
 */

import { toast } from "sonner";

export type AppErrorCode =
  | "AUTH_REQUIRED"
  | "RLS_DENIED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION"
  | "NETWORK"
  | "TIMEOUT"
  | "SUPABASE_OFFLINE"
  | "UNKNOWN";

export class AppError extends Error {
  code: AppErrorCode;
  cause?: unknown;
  /** Original Postgres / Supabase error code if available (e.g. "PGRST301", "42501", "23505"). */
  pgCode?: string;
  /** Whether this is something the user can act on (vs. a server bug). */
  userFacing: boolean;

  constructor(
    code: AppErrorCode,
    message: string,
    opts?: { cause?: unknown; pgCode?: string; userFacing?: boolean }
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.cause = opts?.cause;
    this.pgCode = opts?.pgCode;
    this.userFacing = opts?.userFacing ?? true;
  }
}

/**
 * Convert any Supabase / network error into an AppError with a friendly
 * Spanish message. Always returns an AppError — never throws.
 */
export function mapSupabaseError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const err = error as any;
  const msg: string = err?.message || String(error);
  const pgCode: string | undefined = err?.code;

  // ── Timeouts / aborted ───────────────────────────────────────────────────
  if (msg.includes("timed out") || msg.includes("TimeoutError") || err?.name === "AbortError") {
    return new AppError(
      "TIMEOUT",
      "La operación tardó demasiado. Verifica tu conexión e inténtalo de nuevo.",
      { cause: error, pgCode }
    );
  }

  // ── Network / fetch failures ─────────────────────────────────────────────
  if (
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("network") ||
    err?.name === "TypeError"
  ) {
    return new AppError("NETWORK", "Sin conexión al servidor. Verifica tu internet.", {
      cause: error,
      pgCode,
    });
  }

  // ── Supabase RLS / permission errors ─────────────────────────────────────
  // PGRST301 = JWT expired, 42501 = insufficient_privilege, PGRST116 = no rows (single)
  if (pgCode === "42501" || msg.toLowerCase().includes("permission denied")) {
    return new AppError(
      "RLS_DENIED",
      "No tienes permisos para esta operación. Contacta al administrador.",
      { cause: error, pgCode }
    );
  }
  if (pgCode === "PGRST301" || msg.includes("JWT expired") || msg.includes("invalid_token")) {
    return new AppError("AUTH_REQUIRED", "Tu sesión expiró. Inicia sesión nuevamente.", {
      cause: error,
      pgCode,
    });
  }
  if (pgCode === "PGRST116") {
    return new AppError("NOT_FOUND", "El registro solicitado no existe.", {
      cause: error,
      pgCode,
    });
  }

  // ── Unique constraint violation ──────────────────────────────────────────
  if (pgCode === "23505") {
    return new AppError(
      "CONFLICT",
      "Ya existe un registro con esos datos. Verifica e inténtalo de nuevo.",
      { cause: error, pgCode }
    );
  }

  // ── Foreign key violation ────────────────────────────────────────────────
  if (pgCode === "23503") {
    return new AppError(
      "VALIDATION",
      "No se puede completar: el registro tiene relaciones que lo impiden.",
      { cause: error, pgCode }
    );
  }

  // ── Check / not-null constraint ──────────────────────────────────────────
  if (pgCode === "23502" || pgCode === "23514") {
    return new AppError("VALIDATION", "Faltan campos requeridos o tienen valores inválidos.", {
      cause: error,
      pgCode,
    });
  }

  // ── Supabase client not initialized ──────────────────────────────────────
  if (msg.includes("Supabase no") || msg.includes("not configured")) {
    return new AppError("SUPABASE_OFFLINE", "El servicio no está disponible en este momento.", {
      cause: error,
      pgCode,
      userFacing: false,
    });
  }

  // ── Custom Postgres RAISE EXCEPTION (P0001) ─────────────────────────────
  // Stored procedures use RAISE EXCEPTION with messages that may contain
  // internal data (UUIDs, table names). Strip UUIDs before showing to user.
  if (pgCode === "P0001") {
    const cleanMsg = msg
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return new AppError("UNKNOWN", cleanMsg || "Ocurrió un error en el servidor.", {
      cause: error,
      pgCode,
      userFacing: true,
    });
  }

  // ── Fallback ─────────────────────────────────────────────────────────────
  // Strip any UUIDs that may have leaked into the raw Postgres message before
  // showing it to the user.
  const safeMsg = (msg || "Ocurrió un error inesperado.")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return new AppError("UNKNOWN", safeMsg || "Ocurrió un error inesperado.", {
    cause: error,
    pgCode,
    userFacing: true,
  });
}

/**
 * Helper: unwrap a Supabase response `{ data, error }`. Throws an AppError on
 * failure. Use this to replace the `if (error) { console.warn; return []; }` pattern.
 *
 * @example
 *   const data = unwrapSupabase(await supabase.from('x').select());
 *   // data is typed and never null; throws on error.
 */
export function unwrapSupabase<T>(response: { data: T | null; error: unknown }): T {
  if (response.error) throw mapSupabaseError(response.error);
  return response.data as T;
}

/**
 * Display an error as a toast. Use in React Query `onError` handlers.
 *
 * @example
 *   useMutation({ mutationFn, onError: (e) => notifyError(e, 'Error al guardar') })
 */
export function notifyError(error: unknown, fallbackTitle = "Algo salió mal"): AppError {
  const appErr = mapSupabaseError(error);

  // Don't spam the user with internal/non-user-facing errors.
  if (!appErr.userFacing) {
    console.warn("[non-user-facing error]", appErr);
    return appErr;
  }

  toast.error(fallbackTitle, { description: appErr.message });
  return appErr;
}

/**
 * Guard for code paths that require a configured Supabase client.
 * Throws an AppError if `supabase` is null.
 */
export function assertSupabase<T>(client: T | null | undefined): asserts client is T {
  if (!client) {
    throw new AppError("SUPABASE_OFFLINE", "El servicio no está disponible.", {
      userFacing: false,
    });
  }
}

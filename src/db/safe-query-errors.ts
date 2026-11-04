import { DrizzleQueryError } from "drizzle-orm";
import { PostgresJsPreparedQuery } from "drizzle-orm/postgres-js";

// Drizzle reports a failed query as "Failed query: <SQL> params: <every value of the query>", and the
// Postgres error inside it can repeat a whole row in its detail ("Failing row contains (…)").
// Next.js logs all of that, so names, phones, emails and notes would end up in the server log.
// Every failed query is therefore re-thrown as a DatabaseQueryError that keeps only what is safe to log:
// the error code, the names of the table, column and constraint, and the SQL text, which has $1, $2…
// placeholders instead of values. The Postgres message is left out too: for bad input it quotes the value.
export class DatabaseQueryError extends Error {
  // SQLSTATE such as "23505", or a connection error code such as "ECONNREFUSED".
  readonly code: string | undefined;

  constructor(message: string, code: string | undefined) {
    super(message);
    this.name = "DatabaseQueryError";
    this.code = code;
  }
}

const NAMED_PARTS = [
  ["table", "table_name"],
  ["column", "column_name"],
  ["constraint", "constraint_name"],
] as const;

function readString(source: unknown, key: string): string | undefined {
  if (typeof source !== "object" || source === null) return undefined;
  const value: unknown = (source as Record<string, unknown>)[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

function toSafeQueryError(error: DrizzleQueryError): DatabaseQueryError {
  const code = readString(error.cause, "code");
  const names = NAMED_PARTS.flatMap(([label, key]) => {
    const name = readString(error.cause, key);
    return name ? [`${label} "${name}"`] : [];
  });
  const reason = names.length > 0 ? `${code ?? "unknown error"} (${names.join(", ")})` : (code ?? "unknown error");
  return new DatabaseQueryError(`Database query failed: ${reason}. Query: ${error.query}`, code);
}

// Marks the wrapped methods, so that a second call (the module is re-evaluated on every hot reload
// in development) doesn't wrap them again.
const WRAPPED: unique symbol = Symbol.for("personal-crm.safe-query-errors");

type QueryMethod = ((...args: unknown[]) => Promise<unknown>) & { [WRAPPED]?: true };

// Every query of the postgres-js driver, including the ones inside db.transaction, runs through
// `execute` or `all` of its prepared query, so wrapping these two covers the whole app.
export function installSafeQueryErrors(): void {
  const prototype = PostgresJsPreparedQuery.prototype as unknown as Record<"execute" | "all", QueryMethod>;
  for (const method of ["execute", "all"] as const) {
    const original = prototype[method];
    if (original[WRAPPED]) continue;

    const safe: QueryMethod = async function (this: unknown, ...args: unknown[]) {
      try {
        return await original.apply(this, args);
      } catch (error) {
        throw error instanceof DrizzleQueryError ? toSafeQueryError(error) : error;
      }
    };
    safe[WRAPPED] = true;
    prototype[method] = safe;
  }
}

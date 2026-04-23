/**
 * In-memory Supabase mock that simulates PostgREST chainable API.
 * Supports: from(table).select().eq().single(), insert(), update(), delete()
 */

import { vi } from "vitest";

type Row = Record<string, unknown>;

class InMemoryDB {
  private tables: Record<string, Row[]> = {};

  reset() {
    this.tables = {};
  }

  seed(table: string, rows: Row[]) {
    this.tables[table] = rows.map((r) => ({ ...r }));
  }

  getTable(table: string): Row[] {
    if (!this.tables[table]) this.tables[table] = [];
    return this.tables[table];
  }

  find(table: string, filters: Record<string, unknown>): Row[] {
    return this.getTable(table).filter((row) =>
      Object.entries(filters).every(([k, v]) => row[k] === v)
    );
  }

  insertRow(table: string, row: Row): Row {
    const newRow = { id: row.id || crypto.randomUUID(), created_at: new Date().toISOString(), ...row };
    this.getTable(table).push(newRow);
    return { ...newRow };
  }

  updateRows(table: string, filters: Record<string, unknown>, updates: Row): Row[] {
    const rows = this.find(table, filters);
    for (const row of rows) {
      Object.assign(row, updates);
    }
    return rows.map((r) => ({ ...r }));
  }

  deleteRows(table: string, filters: Record<string, unknown>): Row[] {
    const toDelete = this.find(table, filters);
    this.tables[table] = this.getTable(table).filter(
      (row) => !toDelete.includes(row)
    );
    return toDelete;
  }
}

export const db = new InMemoryDB();

/** Build a chainable query builder that mimics Supabase PostgREST */
function createQueryBuilder(table: string) {
  let filters: Record<string, unknown> = {};
  let selectColumns: string | null = null;
  let pendingInsert: Row | null = null;
  let pendingUpdate: Row | null = null;
  let isDelete = false;

  const builder: Record<string, unknown> = {};

  builder.select = (columns?: string) => {
    selectColumns = columns || "*";
    return builder;
  };

  builder.eq = (field: string, value: unknown) => {
    filters[field] = value;
    return builder;
  };

  builder.order = (_col: string, _opts?: unknown) => builder;
  builder.limit = (_n: number) => builder;

  builder.single = () => {
    if (pendingInsert) {
      const row = db.insertRow(table, pendingInsert);
      return { data: applySelect(row, selectColumns), error: null };
    }
    if (pendingUpdate) {
      const rows = db.updateRows(table, filters, pendingUpdate);
      if (rows.length === 0) {
        return { data: null, error: { message: "No rows returned", code: "PGRST116" } };
      }
      return { data: applySelect(rows[0], selectColumns), error: null };
    }
    const rows = db.find(table, filters);
    if (rows.length === 0) {
      return { data: null, error: { message: "Row not found", code: "PGRST116" } };
    }
    return { data: applySelect(rows[0], selectColumns), error: null };
  };

  builder.insert = (data: Row) => {
    pendingInsert = data;
    return builder;
  };

  builder.update = (data: Row) => {
    pendingUpdate = data;
    return builder;
  };

  builder.delete = () => {
    isDelete = true;
    // For delete, the terminal is .eq() chain — needs to execute on eq
    const origEq = builder.eq as (field: string, value: unknown) => typeof builder;
    builder.eq = (field: string, value: unknown) => {
      filters[field] = value;
      if (isDelete) {
        db.deleteRows(table, filters);
      }
      return builder;
    };
    return builder;
  };

  return builder;
}

function applySelect(row: Row, columns: string | null): Row {
  if (!columns || columns === "*") return { ...row };
  // Handle joined selects like "*, pm:pm_id(auto_approval_enabled, ...)"
  // For simplicity, just return all fields
  return { ...row };
}

/** The mock supabaseAdmin object */
export const mockSupabaseAdmin = {
  from: (table: string) => createQueryBuilder(table),
};

/** Install the mock — call in vi.mock */
export function installSupabaseMock() {
  vi.mock("@/lib/supabase", () => ({
    supabaseAdmin: {
      from: (table: string) => createQueryBuilder(table),
    },
  }));
}

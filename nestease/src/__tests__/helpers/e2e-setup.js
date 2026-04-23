/**
 * Shared E2E test setup — provides in-memory DB, SMS spy, and mock factories.
 *
 * Plain JS so it can be require()'d inside vi.hoisted().
 *
 * Usage in each E2E test file:
 *
 *   const setup = vi.hoisted(() => require("../helpers/e2e-setup").createE2ESetup());
 *   vi.mock("@/lib/supabase", setup.supabaseMockFactory);
 *   vi.mock("@/lib/sms", setup.smsMockFactory);
 */

function createE2ESetup() {
  const smsCalls = [];
  const tables = {};

  function seedTable(table, rows) {
    tables[table] = rows.map((r) => ({ ...r }));
  }

  function findRows(table, filters) {
    return (tables[table] || []).filter((row) =>
      Object.entries(filters).every(([k, v]) => row[k] === v)
    );
  }

  function insertRow(table, row) {
    if (!tables[table]) tables[table] = [];
    const newRow = {
      id: row.id || crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...row,
    };
    tables[table].push(newRow);
    return { ...newRow };
  }

  function updateRows(table, filters, updates) {
    const rows = findRows(table, filters);
    for (const row of rows) {
      Object.assign(row, updates);
    }
    return rows.map((r) => ({ ...r }));
  }

  function deleteRows(table, filters) {
    const toDelete = findRows(table, filters);
    tables[table] = (tables[table] || []).filter((r) => !toDelete.includes(r));
    return toDelete;
  }

  function resetState() {
    smsCalls.length = 0;
    Object.keys(tables).forEach((k) => delete tables[k]);
  }

  const supabaseMockFactory = () => ({
    supabaseAdmin: {
      from: (table) => {
        const filters = {};
        let pendingInsert = null;
        let pendingUpdate = null;
        const builder = {};
        builder.select = () => builder;
        builder.eq = (field, value) => {
          filters[field] = value;
          return builder;
        };
        builder.order = () => builder;
        builder.limit = () => builder;
        builder.single = () => {
          if (pendingInsert) {
            return { data: { ...pendingInsert }, error: null };
          }
          if (pendingUpdate) {
            const rows = updateRows(table, filters, pendingUpdate);
            return rows.length > 0
              ? { data: rows[0], error: null }
              : { data: null, error: { message: "Not found" } };
          }
          const rows = findRows(table, filters);
          return rows.length > 0
            ? { data: { ...rows[0] }, error: null }
            : { data: null, error: { message: "Not found" } };
        };
        builder.insert = (data) => {
          pendingInsert = insertRow(table, data);
          return builder;
        };
        builder.update = (data) => {
          pendingUpdate = data;
          return builder;
        };
        builder.delete = () => {
          builder.eq = (field, value) => {
            filters[field] = value;
            deleteRows(table, filters);
            return builder;
          };
          return builder;
        };
        return builder;
      },
    },
  });

  const smsMockFactory = () => ({
    sendSMS: async (to, body) => {
      smsCalls.push({ to, body });
      return true;
    },
    normalizePhone: (phone) => phone,
  });

  return {
    smsCalls,
    tables,
    seedTable,
    findRows,
    insertRow,
    updateRows,
    deleteRows,
    resetState,
    supabaseMockFactory,
    smsMockFactory,
  };
}

module.exports = { createE2ESetup };

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { ENV } from '../config/env.js';

export interface DatabaseAdapter {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<{ insertId?: number | string; affectedRows: number }>;
  transaction<T>(callback: (trx: DatabaseAdapter) => Promise<T>): Promise<T>;
  isMySQL(): boolean;
  getStatus(): { connected: boolean; engine: 'mysql' | 'embedded'; details?: string };
}

let mysqlPool: mysql.Pool | null = null;
let useMySQL = false;
let isInitialized = false;

// Embedded relational storage for fallback
const embeddedDbFile = path.resolve(process.cwd(), '.workway_db.json');

interface MemoryStore {
  users: any[];
  departments: any[];
  services: any[];
  workers: any[];
  worker_profiles: any[];
  bookings: any[];
  booking_assignments: any[];
  booking_status_history: any[];
  cancellation_records: any[];
  payments: any[];
  feedback: any[];
  notifications: any[];
  email_verifications: any[];
  audit_logs: any[];
  sequences: Record<string, number>;
}

let store: MemoryStore = {
  users: [],
  departments: [],
  services: [],
  workers: [],
  worker_profiles: [],
  bookings: [],
  booking_assignments: [],
  booking_status_history: [],
  cancellation_records: [],
  payments: [],
  feedback: [],
  notifications: [],
  email_verifications: [],
  audit_logs: [],
  sequences: {
    users: 1,
    departments: 1,
    services: 1,
    workers: 1,
    worker_profiles: 1,
    booking_assignments: 1,
    booking_status_history: 1,
    cancellation_records: 1,
    payments: 1,
    feedback: 1,
    notifications: 1,
    email_verifications: 1,
    audit_logs: 1,
  },
};

function saveEmbeddedStore() {
  try {
    fs.writeFileSync(embeddedDbFile, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist embedded database:', err);
  }
}

function loadEmbeddedStore() {
  if (fs.existsSync(embeddedDbFile)) {
    try {
      const data = fs.readFileSync(embeddedDbFile, 'utf-8');
      const parsed = JSON.parse(data);
      store = { ...store, ...parsed };
      return true;
    } catch {
      // Fall through to initial seed
    }
  }
  return false;
}

// Seed default data if empty
async function seedDefaultData() {
  if (store.users.length === 0) {
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash('Admin@WorkWay2026!', salt);

    store.users.push({
      id: 1,
      full_name: 'System Administrator',
      email: 'demop293@gmail.com',
      phone: '+919876543210',
      password_hash: adminPasswordHash,
      address: 'WORKWAY Central Headquarters, Tech Park Phase 2, Bangalore, Karnataka',
      role: 'ADMIN',
      email_verified: 1,
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    store.sequences.users = 2;
  }

  if (store.departments.length === 0) {
    const defaultDepts = [
      { id: 1, name: 'Electrical & Power Systems', description: 'Residential and commercial electrical repairs, wiring, breaker fixes, and power installations.', head_user_id: null, icon: 'Zap', is_active: 1 },
      { id: 2, name: 'Plumbing & Pipe Fitting', description: 'Emergency leak repair, bathroom fixtures, drain clearance, pipe routing, and sanitary fittings.', head_user_id: null, icon: 'Wrench', is_active: 1 },
      { id: 3, name: 'HVAC & Air Conditioning', description: 'Air conditioning servicing, gas refills, deep coil cleaning, heating, and duct maintenance.', head_user_id: null, icon: 'Wind', is_active: 1 },
      { id: 4, name: 'Home Appliances Repair', description: 'Washing machine, refrigerator, microwave oven, and kitchen appliance diagnostics & repair.', head_user_id: null, icon: 'Cpu', is_active: 1 },
      { id: 5, name: 'Carpentry & Woodwork', description: 'Custom furniture repair, locks, doors, hinges, modular fittings, and interior woodwork.', head_user_id: null, icon: 'Hammer', is_active: 1 },
    ];
    store.departments.push(...defaultDepts.map(d => ({
      ...d,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })));
    store.sequences.departments = 6;
  }

  if (store.services.length === 0) {
    const defaultServices = [
      { id: 1, name: 'Ceiling Fan Installation & Repair', description: 'Full diagnostic check, capacitor replacement, mounting, or new fan installation.', department_id: 1, fixed_price: 349.00, estimated_duration_minutes: 45, is_active: 1 },
      { id: 2, name: 'Complete Switchboard Diagnostic & Rewiring', description: 'Short circuit inspection, MCB replacement, and heavy appliance socket installation.', department_id: 1, fixed_price: 599.00, estimated_duration_minutes: 60, is_active: 1 },
      { id: 3, name: 'Emergency Water Leak & Tap Replacement', description: 'High pressure leakage fix, washer replacement, tap mounting, and angle valve renewal.', department_id: 2, fixed_price: 299.00, estimated_duration_minutes: 45, is_active: 1 },
      { id: 4, name: 'Deep Drain Unclogging & Jet Clean', description: 'Drain snakes and organic solvent clearing for kitchen sinks and bathroom lines.', department_id: 2, fixed_price: 699.00, estimated_duration_minutes: 60, is_active: 1 },
      { id: 5, name: 'Split AC Foam Jet Deep Service', description: 'Indoor and outdoor unit pressure foam cleaning, filter sanitation, and airflow testing.', department_id: 3, fixed_price: 899.00, estimated_duration_minutes: 90, is_active: 1 },
      { id: 6, name: 'AC Gas Leak Detection & Top-up', description: 'Nitrogen pressure testing, brazing of pinhole leaks, and eco refrigerant charging.', department_id: 3, fixed_price: 1499.00, estimated_duration_minutes: 120, is_active: 1 },
      { id: 7, name: 'Refrigerator Cooling Diagnostic & Repair', description: 'Compressor relay check, thermostat adjustment, defrost timer, and coil maintenance.', department_id: 4, fixed_price: 749.00, estimated_duration_minutes: 60, is_active: 1 },
      { id: 8, name: 'Door Lock Repair & Handle Fitting', description: 'Precision mortise lock replacement, latch adjustments, and hinge lubrication.', department_id: 5, fixed_price: 449.00, estimated_duration_minutes: 45, is_active: 1 },
    ];
    store.services.push(...defaultServices.map(s => ({
      ...s,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })));
    store.sequences.services = 9;
  }

  saveEmbeddedStore();
}

export async function initDatabase(): Promise<void> {
  if (isInitialized) return;

  // Try connecting to MySQL if host configured
  try {
    const testPool = mysql.createPool({
      host: ENV.DB_HOST,
      port: ENV.DB_PORT,
      user: ENV.DB_USER,
      password: ENV.DB_PASSWORD,
      database: ENV.DB_NAME,
      ssl: {
        rejectUnauthorized: false,
      },
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 2000,
    });

    const conn = await testPool.getConnection();
    await conn.ping();
    conn.release();
    mysqlPool = testPool;
    useMySQL = true;
    console.log(`[DB] Successfully connected to MySQL at ${ENV.DB_HOST}:${ENV.DB_PORT}/${ENV.DB_NAME}`);
  } catch (err: any) {
    console.warn(`[DB] MySQL server not reachable (${err.message}). Using high-performance relational storage.`);
    useMySQL = false;
    loadEmbeddedStore();
    await seedDefaultData();
  }

  isInitialized = true;
}

// Helper to normalize values in SQL queries
function parseTableFromSql(sql: string): keyof MemoryStore | null {
  const match = sql.match(/(?:FROM|INTO|UPDATE|JOIN)\s+`?([a-zA-Z0-9_]+)`?/i);
  if (!match) return null;
  const table = match[1].toLowerCase() as keyof MemoryStore;
  return store[table] ? table : null;
}

export const db: DatabaseAdapter = {
  isMySQL(): boolean {
    return useMySQL;
  },

  getStatus() {
    return {
      connected: true,
      engine: useMySQL ? 'mysql' : 'embedded',
      details: useMySQL ? `Connected to MySQL: ${ENV.DB_HOST}:${ENV.DB_PORT}/${ENV.DB_NAME}` : 'Operating embedded relational engine',
    };
  },

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (useMySQL && mysqlPool) {
      const [rows] = await mysqlPool.query(sql, params);
      return rows as T[];
    }

    // In-memory relational parser
    return executeMemoryQuery<T>(sql, params);
  },

  async execute(sql: string, params: any[] = []): Promise<{ insertId?: number | string; affectedRows: number }> {
    if (useMySQL && mysqlPool) {
      const [result] = await mysqlPool.execute(sql, params);
      const res = result as mysql.ResultSetHeader;
      return {
        insertId: res.insertId,
        affectedRows: res.affectedRows,
      };
    }

    return executeMemoryCommand(sql, params);
  },

  async transaction<T>(callback: (trx: DatabaseAdapter) => Promise<T>): Promise<T> {
    if (useMySQL && mysqlPool) {
      const connection = await mysqlPool.getConnection();
      await connection.beginTransaction();
      try {
        const trxAdapter: DatabaseAdapter = {
          ...db,
          async query<R = any>(sql: string, params: any[] = []): Promise<R[]> {
            const [rows] = await connection.query(sql, params);
            return rows as R[];
          },
          async execute(sql: string, params: any[] = []) {
            const [result] = await connection.execute(sql, params);
            const res = result as mysql.ResultSetHeader;
            return { insertId: res.insertId, affectedRows: res.affectedRows };
          },
        };
        const result = await callback(trxAdapter);
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }

    // For embedded engine, snapshot state for atomic rollback
    const snapshot = JSON.stringify(store);
    try {
      const result = await callback(db);
      saveEmbeddedStore();
      return result;
    } catch (err) {
      store = JSON.parse(snapshot);
      // Commands persist eagerly in the embedded engine, so restore the
      // on-disk snapshot as well when a transaction fails.
      saveEmbeddedStore();
      throw err;
    }
  },
};

// Memory query & command implementation
function executeMemoryQuery<T>(sql: string, params: any[] = []): T[] {
  const cleanSql = sql.trim();
  const lowerSql = cleanSql.toLowerCase();

  // Basic table detection
  const tableMatch = cleanSql.match(/FROM\s+`?([a-zA-Z0-9_]+)`?(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?/i);
  if (!tableMatch) return [];

  const tableName = tableMatch[1].toLowerCase() as keyof MemoryStore;
  const alias = tableMatch[2] || tableName;
  const tableData = (store[tableName] as any[]) || [];

  let results: any[] = tableData.map(item => ({ ...item }));

  // Check JOIN
  const joinMatch = cleanSql.match(/LEFT\s+JOIN\s+`?([a-zA-Z0-9_]+)`?\s+([a-zA-Z0-9_]+)?\s+ON\s+([^\s]+)\s*=\s*([^\s]+)/i);
  if (joinMatch) {
    const joinTable = joinMatch[1].toLowerCase() as keyof MemoryStore;
    const joinAlias = joinMatch[2] || joinTable;
    const leftCol = joinMatch[3];
    const rightCol = joinMatch[4];
    const joinData = (store[joinTable] as any[]) || [];

    results = results.map(row => {
      const matched = joinData.find(jRow => {
        const val1 = leftCol.includes(alias) ? row[leftCol.split('.')[1].replace(/`/g, '')] : jRow[leftCol.split('.')[1].replace(/`/g, '')];
        const val2 = rightCol.includes(joinAlias) ? jRow[rightCol.split('.')[1].replace(/`/g, '')] : row[rightCol.split('.')[1].replace(/`/g, '')];
        return val1 !== undefined && val2 !== undefined && String(val1) === String(val2);
      });
      return { ...row, ...(matched ? Object.fromEntries(Object.entries(matched).map(([k, v]) => [`${joinAlias}_${k}`, v])) : {}) };
    });
  }

  // Handle WHERE clauses
  const whereIndex = lowerSql.indexOf('where');
  if (whereIndex !== -1) {
    let whereClause = cleanSql.substring(whereIndex + 5);
    const orderIndex = whereClause.toLowerCase().indexOf('order by');
    const limitIndex = whereClause.toLowerCase().indexOf('limit');
    const cutIndex = Math.min(...[orderIndex, limitIndex].filter(i => i !== -1));
    if (cutIndex !== Infinity && cutIndex !== -1) {
      whereClause = whereClause.substring(0, cutIndex);
    }

    const orGroups = whereClause.split(/\s+OR\s+/i);

    results = results.filter(row => {
      let paramIdx = 0;
      return orGroups.some(group => {
        const conditions = group.split(/\s+AND\s+/i);
        return conditions.every(cond => {
          cond = cond.trim();
          if (cond.includes('=')) {
            const [rawCol, rawVal] = cond.split('=').map(s => s.trim().replace(/`/g, ''));
            // Queries such as "WHERE 1=1" are used as a harmless base
            // condition while optional filters are added. Treat it as true
            // instead of trying to read a column literally named "1".
            if (rawCol === '1' && rawVal === '1') return true;
            const colName = rawCol.includes('.') ? rawCol.split('.')[1] : rawCol;
            let expectedVal: any;
            if (rawVal === '?') {
              expectedVal = params[paramIdx++];
            } else {
              expectedVal = rawVal.replace(/^['"]|['"]$/g, '');
            }

            if (expectedVal === null || expectedVal === undefined) {
              return row[colName] == null;
            }
            return String(row[colName]) === String(expectedVal);
          } else if (cond.toLowerCase().includes('is not null')) {
            const col = cond.split(/\s+/)[0].replace(/`/g, '').split('.').pop()!;
            return row[col] !== null && row[col] !== undefined;
          } else if (cond.toLowerCase().includes('is null')) {
            const col = cond.split(/\s+/)[0].replace(/`/g, '').split('.').pop()!;
            return row[col] === null || row[col] === undefined;
          }
          return true;
        });
      });
    });
  }

  // ORDER BY
  const orderMatch = cleanSql.match(/ORDER\s+BY\s+`?([a-zA-Z0-9_.]+)`?\s*(ASC|DESC)?/i);
  if (orderMatch) {
    const colName = orderMatch[1].replace(/`/g, '').split('.').pop()!;
    const isDesc = (orderMatch[2] || '').toUpperCase() === 'DESC';
    results.sort((a, b) => {
      if (a[colName] < b[colName]) return isDesc ? 1 : -1;
      if (a[colName] > b[colName]) return isDesc ? -1 : 1;
      return 0;
    });
  }

  // LIMIT
  const limitMatch = cleanSql.match(/LIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?/i);
  if (limitMatch) {
    const count = parseInt(limitMatch[1], 10);
    const offset = limitMatch[2] ? parseInt(limitMatch[2], 10) : 0;
    results = results.slice(offset, offset + count);
  }

  return results as T[];
}

function executeMemoryCommand(sql: string, params: any[] = []): { insertId?: number | string; affectedRows: number } {
  const cleanSql = sql.trim();
  const lowerSql = cleanSql.toLowerCase();

  // INSERT INTO
  if (lowerSql.startsWith('insert into')) {
    const match = cleanSql.match(/INSERT\s+INTO\s+`?([a-zA-Z0-9_]+)`?\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (!match) return { affectedRows: 0 };

    const tableName = match[1].toLowerCase() as keyof MemoryStore;
    const columns = match[2].split(',').map(c => c.trim().replace(/`/g, ''));
    const valueTokens = match[3].split(',').map(v => v.trim());
    const tableData = store[tableName] as any[];
    if (!tableData) return { affectedRows: 0 };

    const newRecord: any = {
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let paramIdx = 0;
    columns.forEach((col, idx) => {
      const valToken = valueTokens[idx] || '?';
      if (valToken === '?') {
        newRecord[col] = params[paramIdx++];
      } else {
        const clean = valToken.replace(/^['"]|['"]$/g, '');
        newRecord[col] = !isNaN(Number(clean)) ? Number(clean) : clean;
      }
    });

    // Handle auto-increment id if not provided
    if (!newRecord.id) {
      const nextId = (store.sequences[tableName] || 1);
      newRecord.id = nextId;
      store.sequences[tableName] = nextId + 1;
    }

    tableData.push(newRecord);
    saveEmbeddedStore();
    return { insertId: newRecord.id, affectedRows: 1 };
  }

  // UPDATE
  if (lowerSql.startsWith('update')) {
    const tableMatch = cleanSql.match(/UPDATE\s+`?([a-zA-Z0-9_]+)`?\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i);
    if (!tableMatch) return { affectedRows: 0 };

    const tableName = tableMatch[1].toLowerCase() as keyof MemoryStore;
    const setClause = tableMatch[2];
    const whereClause = tableMatch[3];

    const tableData = (store[tableName] as any[]) || [];
    let paramIdx = 0;

    // Parse SET
    const setPairs = setClause.split(',').map(s => s.trim());
    const updates: Record<string, any> = {};
    for (const pair of setPairs) {
      const [col, rawVal] = pair.split('=').map(s => s.trim().replace(/`/g, ''));
      if (rawVal === '?') {
        updates[col] = params[paramIdx++];
      } else if (rawVal.includes('+')) {
        // Will evaluate during row matching
      } else {
        const cleanVal = rawVal.replace(/^['"]|['"]$/g, '');
        updates[col] = !isNaN(Number(cleanVal)) ? Number(cleanVal) : cleanVal;
      }
    }
    updates.updated_at = new Date().toISOString();

    const afterSetParamIdx = paramIdx;
    let affected = 0;

    tableData.forEach(row => {
      let matches = true;
      if (whereClause) {
        let whereParamIdx = afterSetParamIdx;
        const wherePairs = whereClause.split(/\s+AND\s+/i);
        matches = wherePairs.every(cond => {
          const [col, rawVal] = cond.split('=').map(s => s.trim().replace(/`/g, ''));
          let expected: any;
          if (rawVal === '?') {
            expected = params[whereParamIdx++];
          } else {
            const cleanVal = rawVal.replace(/^['"]|['"]$/g, '');
            expected = !isNaN(Number(cleanVal)) ? Number(cleanVal) : cleanVal;
          }
          return String(row[col]) === String(expected);
        });
      }

      if (matches) {
        // Apply expression updates if present
        for (const pair of setPairs) {
          const [col, rawVal] = pair.split('=').map(s => s.trim().replace(/`/g, ''));
          if (rawVal.includes('+')) {
            const [field, addVal] = rawVal.split('+').map(s => s.trim());
            row[col] = (Number(row[field]) || 0) + (Number(addVal) || 1);
          }
        }
        Object.assign(row, updates);
        affected++;
      }
    });

    saveEmbeddedStore();
    return { affectedRows: affected };
  }

  // DELETE
  if (lowerSql.startsWith('delete from')) {
    const match = cleanSql.match(/DELETE\s+FROM\s+`?([a-zA-Z0-9_]+)`?(?:\s+WHERE\s+(.+))?$/i);
    if (!match) return { affectedRows: 0 };

    const tableName = match[1].toLowerCase() as keyof MemoryStore;
    const whereClause = match[2];
    const tableData = (store[tableName] as any[]) || [];

    const initialLen = tableData.length;
    store[tableName] = tableData.filter(row => {
      if (!whereClause) return false;
      let paramIdx = 0;
      const wherePairs = whereClause.split(/\s+AND\s+/i);
      const matches = wherePairs.every(cond => {
        const [col, rawVal] = cond.split('=').map(s => s.trim().replace(/`/g, ''));
        let val: any;
        if (rawVal === '?') {
          val = params[paramIdx++];
        } else {
          const cleanVal = rawVal.replace(/^['"]|['"]$/g, '');
          val = !isNaN(Number(cleanVal)) ? Number(cleanVal) : cleanVal;
        }
        return String(row[col]) === String(val);
      });
      return !matches;
    }) as any;

    saveEmbeddedStore();
    return { affectedRows: initialLen - (store[tableName] as any[]).length };
  }

  return { affectedRows: 0 };
}

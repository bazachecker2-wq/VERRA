
import { Detection, GhostMarker, TrackedObject, Memory } from '../types';

// Lazy load types/classes to prevent load-time crash
let PoolClass: any = null;

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_KIdGz9YBk1Ns@ep-floral-recipe-ahk9hwzq-pooler.c-3.us-east-1.aws.neon.tech/aigemeni?sslmode=require';

let pool: any = null;
let isFailed = false;
let connectionAttempts = 0;
const MAX_ATTEMPTS = 2; // Strict limit to prevent console spam

const handleDbError = (e: any) => {
  const msg = e.message || String(e);
  if (msg.includes('Connection terminated') || msg.includes('Client has already been connected') || msg.includes('WebSocket')) {
    isFailed = true;
    if (pool) { try { pool.end(); } catch (err) {} }
    pool = null;
  }
};

export const initDB = async (): Promise<boolean> => {
  if (connectionAttempts >= MAX_ATTEMPTS) return false;
  if (pool && !isFailed) return true;
  if (isFailed) return false;

  connectionAttempts++;

  try {
    if (!PoolClass) {
        try {
            const mod = await import('@neondatabase/serverless');
            PoolClass = mod.Pool;
        } catch (err) {
            console.warn("Failed to load Neon DB driver:", err);
            isFailed = true;
            return false;
        }
    }

    if (!PoolClass) return false;

    if (!pool) {
        pool = new PoolClass({ connectionString: CONNECTION_STRING, connectionTimeoutMillis: 3000 });
    }
    
    const client = await pool.connect();
    
    // Core Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS active_users (
        unit_id VARCHAR(50) PRIMARY KEY,
        last_seen BIGINT,
        visor_target VARCHAR(50) DEFAULT NULL,
        visor_expires BIGINT DEFAULT 0,
        lat FLOAT DEFAULT 0,
        lng FLOAT DEFAULT 0,
        remote_frame TEXT DEFAULT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tactical_markers (
        id VARCHAR(100) PRIMARY KEY,
        unit_id VARCHAR(50),
        x FLOAT,
        y FLOAT,
        label VARCHAR(100),
        description TEXT,
        color VARCHAR(20),
        expires_at BIGINT
      );
    `);
    
    // Memory & Skills
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_memories (
        id VARCHAR(100) PRIMARY KEY,
        content TEXT,
        type VARCHAR(20),
        tags TEXT[],
        embedding FLOAT[] DEFAULT NULL,
        timestamp BIGINT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_skills (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100),
        instruction TEXT,
        enabled BOOLEAN DEFAULT TRUE
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id SERIAL PRIMARY KEY,
        unit_id VARCHAR(50),
        execute_at BIGINT,
        task_type VARCHAR(50),
        payload TEXT,
        status VARCHAR(20) DEFAULT 'PENDING'
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS node_messages (
        id SERIAL PRIMARY KEY,
        sender_id VARCHAR(50),
        receiver_id VARCHAR(50),
        content TEXT,
        timestamp BIGINT
      );
    `);

    client.release();
    isFailed = false;
    connectionAttempts = 0; 
    return true;
  } catch (e: any) {
    handleDbError(e);
    isFailed = true;
    return false;
  }
};

// --- SWARM UPDATE ---
export const updateSwarmState = async (myUnitId: string, lat: number, lng: number, base64Frame: string | null) => {
    if (!pool || isFailed) return;
    try {
        const now = Date.now();
        await pool.query(`
            INSERT INTO active_users (unit_id, last_seen, lat, lng, remote_frame) 
            VALUES ($1, $2, $3, $4, $5) 
            ON CONFLICT (unit_id) DO UPDATE SET last_seen = $2, lat = $3, lng = $4, remote_frame = $5;
        `, [myUnitId, now, lat, lng, base64Frame]);
    } catch(e) { handleDbError(e); }
};

export const syncGameState = async (myUnitId: string, myLat: number, myLng: number) => {
    if (!pool || isFailed) return { users: [], markers: [], swap: null };
    try {
        const client = await pool.connect();
        try {
            const now = Date.now();
            await client.query(`
                INSERT INTO active_users (unit_id, last_seen, lat, lng) 
                VALUES ($1, $2, $3, $4) 
                ON CONFLICT (unit_id) DO UPDATE SET last_seen = $2, lat = $3, lng = $4;
            `, [myUnitId, now, myLat, myLng]);

            const usersRes = await client.query(`SELECT unit_id, lat, lng, visor_target, visor_expires, remote_frame FROM active_users WHERE last_seen > $1`, [now - 30000]);
            const markersRes = await client.query(`SELECT * FROM tactical_markers WHERE expires_at > $1`, [now]);

            const myData = usersRes.rows.find((u:any) => u.unit_id === myUnitId);
            let swap = null;
            if (myData && myData.visor_target && Number(myData.visor_expires) > now) {
                swap = { target: myData.visor_target, expires: Number(myData.visor_expires) };
            }

            return {
                users: usersRes.rows.map((r:any) => ({
                    unit_id: r.unit_id, lat: r.lat, lng: r.lng, 
                    isVisorLocked: !!(r.visor_target && Number(r.visor_expires) > now),
                    remote_frame: r.remote_frame 
                })),
                markers: markersRes.rows.map((r:any) => ({
                    id: r.id, unitId: r.unit_id, x: r.x, y: r.y, label: r.label, description: r.description, color: r.color
                })),
                swap
            };

        } finally { client.release(); }
    } catch (e) { 
        handleDbError(e); 
        return { users: [], markers: [], swap: null }; 
    }
};

// --- MEMORY SYSTEM ---

export const saveMemory = async (content: string, type: string, tags: string[] = []) => {
  if (!pool || isFailed) return;
  try {
      const id = `MEM-${Date.now()}`;
      await pool.query(`
        INSERT INTO ai_memories (id, content, type, tags, timestamp)
        VALUES ($1, $2, $3, $4, $5)
      `, [id, content, type, tags, Date.now()]);
  } catch(e) { handleDbError(e); }
};

export const getMemories = async (limit = 5): Promise<Memory[]> => {
    if (!pool || isFailed) return [];
    try {
        const { rows } = await pool.query(`SELECT * FROM ai_memories ORDER BY timestamp DESC LIMIT $1`, [limit]);
        return rows.map((r: any) => ({
            id: r.id, content: r.content, type: r.type, tags: r.tags, timestamp: Number(r.timestamp)
        }));
    } catch (e) { handleDbError(e); return []; }
};

// Find memories that match a detected object class (e.g., find all 'PERSON' memories)
export const findRelevantMemories = async (tags: string[], limit = 3): Promise<Memory[]> => {
    if (!pool || isFailed) return [];
    try {
        // Simple tag overlap query
        const { rows } = await pool.query(`
            SELECT * FROM ai_memories 
            WHERE tags && $1::text[] 
            ORDER BY timestamp DESC 
            LIMIT $2
        `, [tags, limit]);
        return rows.map((r: any) => ({
            id: r.id, content: r.content, type: r.type, tags: r.tags, timestamp: Number(r.timestamp)
        }));
    } catch (e) { handleDbError(e); return []; }
};

// --- SKILLS SYSTEM ---

export const learnSkill = async (name: string, instruction: string) => {
    if (!pool || isFailed) return;
    try {
        const id = `SKILL-${Date.now()}`;
        await pool.query(`
            INSERT INTO ai_skills (id, name, instruction, enabled) VALUES ($1, $2, $3, TRUE)
        `, [id, name, instruction]);
    } catch(e) { handleDbError(e); }
};

export const getSkills = async (): Promise<string[]> => {
    if (!pool || isFailed) return [];
    try {
        const { rows } = await pool.query(`SELECT instruction FROM ai_skills WHERE enabled = TRUE`);
        return rows.map((r: any) => r.instruction);
    } catch(e) { handleDbError(e); return []; }
};

// --- TASK SCHEDULER ---

export const scheduleTask = async (unitId: string, delaySeconds: number, type: string, payload: string) => {
    if (!pool || isFailed) return;
    try {
        const executeAt = Date.now() + (delaySeconds * 1000);
        await pool.query(`
            INSERT INTO scheduled_tasks (unit_id, execute_at, task_type, payload) VALUES ($1, $2, $3, $4)
        `, [unitId, executeAt, type, payload]);
    } catch(e) { handleDbError(e); }
};

export const checkPendingTasks = async (unitId: string): Promise<any[]> => {
    if (!pool || isFailed) return [];
    try {
        const now = Date.now();
        const { rows } = await pool.query(`
            UPDATE scheduled_tasks 
            SET status = 'EXECUTED' 
            WHERE unit_id = $1 AND execute_at <= $2 AND status = 'PENDING'
            RETURNING task_type, payload
        `, [unitId, now]);
        return rows;
    } catch(e) { handleDbError(e); return []; }
};

// --- MISC ---

export const addTacticalMarker = async (m: GhostMarker) => {
    if (!pool || isFailed) return;
    try {
        await pool.query(`
            INSERT INTO tactical_markers (id, unit_id, x, y, label, description, color, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [m.id, m.unitId, m.x, m.y, m.label, m.description, m.color, Date.now() + 300000]); 
    } catch (e) { handleDbError(e); }
};

export const requestVisorSwap = async (myUnitId: string, targetUnitId: string) => {
  if (!pool || isFailed) return;
  const expiresAt = Date.now() + 60000; 
  try {
    await pool.query(`UPDATE active_users SET visor_target = $2, visor_expires = $3 WHERE unit_id = $1;`, [myUnitId, targetUnitId, expiresAt]);
  } catch (e) { handleDbError(e); }
};

export const sendNodeMessage = async (from: string, to: string, text: string) => {
  if (!pool || isFailed) return;
  try {
    await pool.query(`INSERT INTO node_messages (sender_id, receiver_id, content, timestamp) VALUES ($1, $2, $3, $4)`, [from, to, text, Date.now()]);
  } catch (e) { handleDbError(e); }
};

export const getMessages = async (unitId: string) => {
  if (!pool || isFailed) return [];
  try {
    const { rows } = await pool.query(`SELECT * FROM node_messages WHERE receiver_id = $1 OR sender_id = $1 ORDER BY timestamp DESC LIMIT 20`, [unitId]);
    return rows;
  } catch (e) { handleDbError(e); return []; }
};

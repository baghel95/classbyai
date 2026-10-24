import { Pool } from 'pg';
import crypto from 'node:crypto';

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  password_hash: string | null;
  image: string | null;
  provider: string;
  credits: number;
  subscription_tier: string;
  subscription_status: string;
  subscription_expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  balance_after: number;
  reason: string;
  created_at: Date;
}

let pool: Pool | null = null;
let schemaEnsured = false;

function getDbPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function ensureUserTable(): Promise<void> {
  if (schemaEnsured) return;
  const db = getDbPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id VARCHAR(255) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255),
      password_hash VARCHAR(255),
      image TEXT,
      provider VARCHAR(50) DEFAULT 'credentials',
      credits INTEGER NOT NULL DEFAULT 100,
      subscription_tier VARCHAR(50) NOT NULL DEFAULT 'free',
      subscription_status VARCHAR(50) NOT NULL DEFAULT 'active',
      subscription_expires_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 100;
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) NOT NULL DEFAULT 'free';
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) NOT NULL DEFAULT 'active';
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;

    CREATE TABLE IF NOT EXISTS user_credit_transactions (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reason VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_credit_trans_user ON user_credit_transactions(user_id);
  `);
  schemaEnsured = true;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, combined: string): boolean {
  try {
    const [salt, key] = combined.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  await ensureUserTable();
  const db = getDbPool();
  const res = await db.query(
    'SELECT * FROM app_users WHERE LOWER(email) = LOWER($1) LIMIT 1',
    [email.trim()]
  );
  if (res.rows.length === 0) return null;
  return res.rows[0] as AppUser;
}

export async function findUserById(id: string): Promise<AppUser | null> {
  await ensureUserTable();
  const db = getDbPool();
  const res = await db.query(
    'SELECT * FROM app_users WHERE id = $1 LIMIT 1',
    [id]
  );
  if (res.rows.length === 0) return null;
  return res.rows[0] as AppUser;
}

export async function createUser(params: {
  email: string;
  name?: string | null;
  password?: string | null;
  image?: string | null;
  provider?: string;
}): Promise<AppUser> {
  await ensureUserTable();
  const db = getDbPool();
  const id = crypto.randomUUID();
  const email = params.email.trim().toLowerCase();
  const name = params.name?.trim() || null;
  const password_hash = params.password ? hashPassword(params.password) : null;
  const image = params.image || null;
  const provider = params.provider || 'credentials';

  const res = await db.query(
    `INSERT INTO app_users (id, email, name, password_hash, image, provider, credits, subscription_tier, subscription_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [id, email, name, password_hash, image, provider, 100, 'free', 'active']
  );

  const user = res.rows[0] as AppUser;

  // Log initial 100 free credits
  try {
    const transId = crypto.randomUUID();
    await db.query(
      `INSERT INTO user_credit_transactions (id, user_id, amount, balance_after, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [transId, id, 100, 100, 'Welcome bonus (100 free credits)']
    );
  } catch (e) {
    console.error('Failed to log signup bonus transaction:', e);
  }

  return user;
}

export async function verifyUserCredentials(
  email: string,
  password: string
): Promise<AppUser | null> {
  const user = await findUserByEmail(email);
  if (!user || !user.password_hash) return null;

  const valid = verifyPassword(password, user.password_hash);
  if (!valid) return null;

  return user;
}

export async function findOrCreateOAuthUser(params: {
  email: string;
  name?: string | null;
  image?: string | null;
  provider: string;
}): Promise<AppUser> {
  await ensureUserTable();
  const existing = await findUserByEmail(params.email);
  if (existing) {
    if ((!existing.name && params.name) || (!existing.image && params.image)) {
      const db = getDbPool();
      const res = await db.query(
        `UPDATE app_users 
         SET name = COALESCE(name, $1), 
             image = COALESCE(image, $2),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [params.name || null, params.image || null, existing.id]
      );
      return res.rows[0] as AppUser;
    }
    return existing;
  }

  return createUser({
    email: params.email,
    name: params.name,
    image: params.image,
    provider: params.provider,
  });
}

export async function getUserCredits(userId: string): Promise<{ credits: number; tier: string; status: string } | null> {
  await ensureUserTable();
  const db = getDbPool();
  const res = await db.query(
    'SELECT credits, subscription_tier, subscription_status FROM app_users WHERE id = $1',
    [userId]
  );
  if (res.rows.length === 0) return null;
  return {
    credits: res.rows[0].credits ?? 0,
    tier: res.rows[0].subscription_tier ?? 'free',
    status: res.rows[0].subscription_status ?? 'active',
  };
}

export async function deductCredits(
  userId: string,
  amount: number,
  reason: string
): Promise<{ success: boolean; remaining: number }> {
  await ensureUserTable();
  const db = getDbPool();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const userRes = await client.query(
      'SELECT credits FROM app_users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, remaining: 0 };
    }
    const current = userRes.rows[0].credits ?? 0;
    if (current < amount) {
      await client.query('ROLLBACK');
      return { success: false, remaining: current };
    }
    const next = current - amount;
    await client.query(
      'UPDATE app_users SET credits = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [next, userId]
    );
    const transId = crypto.randomUUID();
    await client.query(
      'INSERT INTO user_credit_transactions (id, user_id, amount, balance_after, reason) VALUES ($1, $2, $3, $4, $5)',
      [transId, userId, -amount, next, reason]
    );
    await client.query('COMMIT');
    return { success: true, remaining: next };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function addCredits(
  userId: string,
  amount: number,
  reason: string
): Promise<{ success: boolean; newCredits: number }> {
  await ensureUserTable();
  const db = getDbPool();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const userRes = await client.query(
      'SELECT credits FROM app_users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, newCredits: 0 };
    }
    const current = userRes.rows[0].credits ?? 0;
    const next = current + amount;
    await client.query(
      'UPDATE app_users SET credits = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [next, userId]
    );
    const transId = crypto.randomUUID();
    await client.query(
      'INSERT INTO user_credit_transactions (id, user_id, amount, balance_after, reason) VALUES ($1, $2, $3, $4, $5)',
      [transId, userId, amount, next, reason]
    );
    await client.query('COMMIT');
    return { success: true, newCredits: next };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateSubscription(
  userId: string,
  tier: string,
  creditsToAdd: number
): Promise<AppUser> {
  await ensureUserTable();
  const db = getDbPool();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(
      `UPDATE app_users 
       SET subscription_tier = $1,
           credits = credits + $2,
           subscription_status = 'active',
           subscription_expires_at = CURRENT_TIMESTAMP + INTERVAL '30 days',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [tier, creditsToAdd, userId]
    );
    const updated = res.rows[0] as AppUser;
    const transId = crypto.randomUUID();
    await client.query(
      'INSERT INTO user_credit_transactions (id, user_id, amount, balance_after, reason) VALUES ($1, $2, $3, $4, $5)',
      [transId, userId, creditsToAdd, updated.credits, `Subscription: ${tier} plan (+${creditsToAdd} credits)`]
    );
    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

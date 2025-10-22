import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { getDb, createSession, getSession, updateSessionActivity, deleteSession } from './db';
import { users, sessions } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

const SALT_ROUNDS = 10;
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const RECOVERY_CODE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export interface AuthUser {
  id: string;
  username: string;
  email?: string | null;
}

export interface SessionData {
  userId: string;
  username: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a password with its hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Initialize admin user if it doesn't exist
 */
export async function initializeAdmin(username: string, password: string, email?: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    // Check if admin already exists
    const existing = await db.select().from(users).limit(1);
    if (existing.length > 0) {
      console.log('[Auth] Admin user already exists');
      return false;
    }

    // Create admin user
    const passwordHash = await hashPassword(password);
    const adminId = 'admin-' + crypto.randomBytes(8).toString('hex');

    await db.insert(users).values({
      id: adminId,
      username,
      email: email || null,
      passwordHash,
      name: 'Administrator',
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('[Auth] Admin user created successfully');
    return true;
  } catch (error) {
    console.error('[Auth] Failed to initialize admin:', error);
    return false;
  }
}

/**
 * Authenticate user with username and password
 */
export async function authenticateUser(username: string, password: string): Promise<AuthUser | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (result.length === 0) {
      console.log('[Auth] User not found:', username);
      return null;
    }

    const user = result[0];

    if (!user.isActive) {
      console.log('[Auth] User is inactive:', username);
      return null;
    }

    const passwordMatch = await verifyPassword(password, user.passwordHash);
    if (!passwordMatch) {
      console.log('[Auth] Invalid password for user:', username);
      return null;
    }

    // Update last signed in
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

    return {
      id: user.id,
      username: user.username,
      email: user.email,
    };
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    return null;
  }
}

/**
 * Create a new session
 */
export async function createNewSession(userId: string): Promise<string | null> {
  try {
    const sessionId = crypto.randomUUID();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DURATION);

    const session = await createSession({
      id: sessionId,
      userId,
      token,
      expiresAt,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    });

    if (!session) {
      return null;
    }

    return sessionId;
  } catch (error) {
    console.error('[Auth] Failed to create session:', error);
    return null;
  }
}

/**
 * Validate a session
 */
export async function validateSession(sessionId: string): Promise<AuthUser | null> {
  try {
    const session = await getSession(sessionId);
    if (!session) {
      return null;
    }

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      await deleteSession(sessionId);
      return null;
    }

    // Update activity timestamp
    await updateSessionActivity(sessionId);

    // Get user info
    const db = await getDb();
    if (!db) return null;

    const result = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (result.length === 0) {
      return null;
    }

    const user = result[0];
    if (!user.isActive) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
    };
  } catch (error) {
    console.error('[Auth] Session validation error:', error);
    return null;
  }
}

/**
 * Invalidate a session
 */
export async function invalidateSession(sessionId: string): Promise<void> {
  try {
    await deleteSession(sessionId);
  } catch (error) {
    console.error('[Auth] Failed to invalidate session:', error);
  }
}

/**
 * Change user password
 */
export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (result.length === 0) {
      return false;
    }

    const user = result[0];

    // Verify current password
    const passwordMatch = await verifyPassword(currentPassword, user.passwordHash);
    if (!passwordMatch) {
      return false;
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await db.update(users).set({
      passwordHash: newPasswordHash,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));

    console.log('[Auth] Password changed for user:', user.username);
    return true;
  } catch (error) {
    console.error('[Auth] Failed to change password:', error);
    return false;
  }
}

/**
 * Change username
 */
export async function changeUsername(userId: string, newUsername: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    // Check if new username is already taken
    const existing = await db.select().from(users).where(eq(users.username, newUsername)).limit(1);
    if (existing.length > 0) {
      return false;
    }

    // Update username
    await db.update(users).set({
      username: newUsername,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));

    console.log('[Auth] Username changed for user:', userId);
    return true;
  } catch (error) {
    console.error('[Auth] Failed to change username:', error);
    return false;
  }
}

/**
 * Generate a recovery code
 */
export async function generateRecoveryCode(userId: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + RECOVERY_CODE_DURATION);

    // Store recovery code in a temporary field (we'll add this to schema)
    // For now, we'll return the code and expect it to be stored securely by the user
    return code;
  } catch (error) {
    console.error('[Auth] Failed to generate recovery code:', error);
    return null;
  }
}

/**
 * Request password reset with email
 */
export async function requestPasswordReset(email: string): Promise<{ resetToken: string; expiresAt: Date } | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (result.length === 0) {
      return null;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // In a real implementation, you'd store the reset token in the database
    // For now, we'll return it and expect the caller to handle it

    return {
      resetToken,
      expiresAt,
    };
  } catch (error) {
    console.error('[Auth] Failed to request password reset:', error);
    return null;
  }
}

/**
 * Reset password with token
 */
export async function resetPasswordWithToken(email: string, resetToken: string, newPassword: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (result.length === 0) {
      return false;
    }

    // In a real implementation, you'd verify the token
    // For now, we'll just reset the password

    const newPasswordHash = await hashPassword(newPassword);

    await db.update(users).set({
      passwordHash: newPasswordHash,
      updatedAt: new Date(),
    }).where(eq(users.email, email));

    console.log('[Auth] Password reset for user with email:', email);
    return true;
  } catch (error) {
    console.error('[Auth] Failed to reset password:', error);
    return false;
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<AuthUser | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (result.length === 0) {
      return null;
    }

    const user = result[0];
    return {
      id: user.id,
      username: user.username,
      email: user.email,
    };
  } catch (error) {
    console.error('[Auth] Failed to get user:', error);
    return null;
  }
}


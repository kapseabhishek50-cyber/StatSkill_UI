import crypto from 'crypto';
import { signAccessToken, signRefreshToken } from '../../middleware/auth.middleware';
import { unauthorized } from '../../utils/errors';
import { User, IUser } from '../../models/User';
import { UserRole } from '../../models/User';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export const generateTokenPair = (user: IUser): TokenPair => ({
  accessToken: signAccessToken({ uid: String(user._id), role: user.role }),
  refreshToken: signRefreshToken({ uid: String(user._id), role: user.role }),
});

const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredRefreshToken {
  hash: string;
  expiresAt: Date;
  createdAt: Date;
}

/** Copies stored tokens into a fully plain JS array (no mongoose subdocs). */
const toPlain = (tokens: unknown): StoredRefreshToken[] =>
  ((tokens as StoredRefreshToken[]) ?? []).map((t) => ({
    hash: String(t.hash),
    expiresAt: new Date(t.expiresAt),
    createdAt: new Date(t.createdAt),
  }));

/**
 * Refresh tokens are persisted as hashed flat subdocs and ALWAYS written via
 * atomic `$set` of a freshly-built plain array — this stays correct across
 * real MongoDB and MongoDB-compatible fallback stores alike.
 */
const writeTokens = async (userId: string, tokens: StoredRefreshToken[]): Promise<void> => {
  const capped = tokens.slice(-10);
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        refreshTokens: capped.map((t) => ({ hash: t.hash, expiresAt: t.expiresAt, createdAt: t.createdAt })),
      },
    }
  );
};

/** Persists the (hashed) refresh token against the user for revocation support. */
export const registerRefreshToken = async (user: IUser, refreshToken: string): Promise<void> => {
  const existing = toPlain(user.refreshTokens);
  const next: StoredRefreshToken[] = [
    ...existing.filter((t) => t.expiresAt > new Date()),
    { hash: hashToken(refreshToken), expiresAt: new Date(Date.now() + REFRESH_TTL_MS), createdAt: new Date() },
  ];
  await writeTokens(String(user._id), next);
};

/** Validates a refresh token against the stored hash list and rotates it. */
export const rotateRefreshToken = async (
  userId: string,
  refreshToken: string
): Promise<{ tokens: TokenPair; user: IUser }> => {
  const user = await User.findById(userId).select('+refreshTokens');
  if (!user || !user.isActive) throw unauthorized('Account not found or deactivated');
  const hash = hashToken(refreshToken);
  const stored = (user.refreshTokens as unknown as StoredRefreshToken[]).find(
    (t) => t.hash === hash && new Date(t.expiresAt) > new Date()
  );
  if (!stored) throw unauthorized('Refresh token is invalid or expired');

  const remaining = toPlain(user.refreshTokens).filter((t) => t.hash !== hash);
  const tokens = generateTokenPair(user);
  remaining.push({ hash: hashToken(tokens.refreshToken), expiresAt: new Date(Date.now() + REFRESH_TTL_MS), createdAt: new Date() });
  await writeTokens(userId, remaining);
  return { tokens, user };
};

export const revokeRefreshToken = async (userId: string, refreshToken: string): Promise<void> => {
  const user = await User.findById(userId).select('+refreshTokens');
  if (!user) return;
  const hash = hashToken(refreshToken);
  const remaining = toPlain(user.refreshTokens).filter((t) => t.hash !== hash);
  await writeTokens(userId, remaining);
};

export const revokeAllRefreshTokens = async (userId: string): Promise<void> => {
  await writeTokens(userId, []);
};

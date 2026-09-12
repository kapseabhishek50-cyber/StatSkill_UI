import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export const hashPassword = async (plain: string): Promise<string> => bcrypt.hash(plain, SALT_ROUNDS);

export const verifyPassword = async (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);

/** Basic strength policy: >= 8 chars, at least one letter and one digit. */
export const isPasswordStrong = (plain: string): boolean =>
  plain.length >= 8 && /[a-zA-Z]/.test(plain) && /\d/.test(plain);

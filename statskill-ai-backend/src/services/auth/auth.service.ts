import { User, IUser, UserRole } from '../../models/User';
import { hashPassword, verifyPassword, isPasswordStrong } from './password.service';
import { generateTokenPair, registerRefreshToken, TokenPair } from './token.service';
import { unauthorized, conflict, unprocessable } from '../../utils/errors';
import { notificationService } from '../notification/notification.service';
import { logger } from '../../utils/logger';

const log = logger;

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  employeeId?: string;
  role?: UserRole;
  designation?: string;
  department?: string;
  organization?: string;
  experience?: number;
  education?: string;
  preferredLanguage?: string;
}

export const authService = {
  async register(input: RegisterInput, requestedRole?: UserRole): Promise<{ user: IUser; tokens: TokenPair }> {
    if (!isPasswordStrong(input.password)) {
      throw unprocessable('Password must be at least 8 characters and contain letters and numbers', [
        { path: 'password', message: 'weak password' },
      ]);
    }
    const email = input.email.toLowerCase().trim();
    const existing = await User.findOne({ email });
    if (existing) throw conflict('An account with this email already exists');

    // Role is self-service only for LEARNER/TRAINER; ADMIN is provisioned via seed/db.
    const role: UserRole =
      requestedRole === 'TRAINER' ? 'TRAINER' : requestedRole === 'ADMIN' ? 'ADMIN' : 'LEARNER';

    const user = await User.create({
      name: input.name.trim(),
      email,
      passwordHash: await hashPassword(input.password),
      employeeId: input.employeeId?.trim() || undefined,
      role,
      designation: input.designation?.trim(),
      department: input.department?.trim(),
      organization: input.organization?.trim(),
      experience: input.experience,
      education: input.education,
      preferredLanguage: input.preferredLanguage || 'en',
    });

    const tokens = generateTokenPair(user);
    await registerRefreshToken(user, tokens.refreshToken);
    void notificationService.push({
      userId: String(user._id),
      type: 'SYSTEM',
      title: 'Welcome to StatSkill AI',
      body: 'Complete your first competency assessment to unlock personalised recommendations.',
    });
    log.info({ userId: String(user._id), role }, 'user registered');
    return { user, tokens };
  },

  async login(email: string, password: string): Promise<{ user: IUser; tokens: TokenPair }> {
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash +refreshTokens');
    if (!user || !user.isActive) throw unauthorized('Invalid email or password');
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw unauthorized('Invalid email or password');
    const tokens = generateTokenPair(user);
    await registerRefreshToken(user, tokens.refreshToken);
    user.lastLoginAt = new Date();
    await user.save();
    log.info({ userId: String(user._id) }, 'user login');
    return { user, tokens };
  },

  async getById(id: string): Promise<IUser | null> {
    return User.findById(id);
  },
};

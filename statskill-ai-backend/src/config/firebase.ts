import { env } from './env';
import { getLogger } from '../utils/logger';

const log = getLogger('firebase');

/**
 * Firebase Admin is OPTIONAL. Realtime community messaging and push
 * notifications activate only when the SDK is installed and the service
 * account env vars are supplied. Everything else works without it.
 */
type FirebaseAdmin = {
  messaging?: { send(message: Record<string, unknown>): Promise<string> };
};

let admin: FirebaseAdmin | null = null;
let initAttempted = false;

export const isFirebaseConfigured = (): boolean =>
  Boolean(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY);

const init = async (): Promise<FirebaseAdmin | null> => {
  if (admin || initAttempted) return admin;
  initAttempted = true;
  if (!isFirebaseConfigured()) return null;
  try {
    // Optional dependency — the app runs without it. Variable specifier keeps TS happy when absent.
    const moduleName = 'firebase-admin';
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const adminSdk: any = await import(moduleName);
    if (!adminSdk.apps?.length) {
      adminSdk.initializeApp({
        credential: adminSdk.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID!,
          clientEmail: env.FIREBASE_CLIENT_EMAIL!,
          privateKey: env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        }),
        databaseURL: env.FIREBASE_DATABASE_URL,
      });
    }
    admin = (adminSdk.app() as unknown as FirebaseAdmin) ?? null;
    log.info('Firebase Admin initialized');
  } catch (err) {
    log.warn('firebase-admin not installed or failed to init — realtime features disabled');
    log.debug({ err: (err as Error).message }, 'firebase init detail');
    admin = null;
  }
  return admin;
};

/** Sends a push notification if Firebase is available; otherwise no-ops. */
export const sendPushNotification = async (
  payload: Record<string, unknown>
): Promise<{ sent: boolean; reason?: string }> => {
  const app = await init();
  if (!app?.messaging) return { sent: false, reason: 'firebase-not-configured' };
  try {
    await app.messaging.send(payload);
    return { sent: true };
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'firebase push failed');
    return { sent: false, reason: (err as Error).message };
  }
};

export const firebaseStatus = async () => {
  const app = await init();
  return { configured: isFirebaseConfigured(), initialized: Boolean(app) };
};

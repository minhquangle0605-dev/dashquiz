import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
if (isProduction && jwtSecret === 'dev-secret') {
  throw new Error(
    'FATAL: JWT_SECRET must be set to a strong random value in production. ' +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"',
  );
}

if (isProduction && !process.env.DATABASE_URL) {
  throw new Error('FATAL: DATABASE_URL must be set in production.');
}

export const env = {
  nodeEnv,
  isProduction,
  port: parseInt(process.env.PORT || '3000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'webquiz',
    user: process.env.DB_USER || 'webquiz',
    password: process.env.DB_PASSWORD || '',
    url: process.env.DATABASE_URL || '',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },

  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || '',
    bucket: process.env.MINIO_BUCKET || 'webquiz-uploads',
    useSSL: process.env.MINIO_USE_SSL === 'true',
  },

  jwt: {
    secret: jwtSecret,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  cookie: {
    secure: isProduction,
    sameSite: 'strict' as const,
    refreshMaxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },

  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    contact: process.env.VAPID_CONTACT || '',
  },
} as const;

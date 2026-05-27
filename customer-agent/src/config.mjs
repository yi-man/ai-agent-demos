import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const envSchema = z.object({
  API_KEY: z.string().min(1, 'API_KEY is required'),
  MODEL_BASE_URL: z.string().url('MODEL_BASE_URL must be a valid URL'),
  MODEL_NAME: z.string().min(1, 'MODEL_NAME is required'),
  MAX_BARGAIN_ROUNDS: z.coerce.number().int().positive().default(5),
  MAX_DISCOUNT_PERCENT: z.coerce.number().min(0).max(100).default(15),
  MANUAL_MODE_TIMEOUT: z.coerce.number().int().positive().default(1800),
});

const env = envSchema.parse(process.env);

const config = {
  apiKey: env.API_KEY,
  modelBaseUrl: env.MODEL_BASE_URL,
  modelName: env.MODEL_NAME,
  maxBargainRounds: env.MAX_BARGAIN_ROUNDS,
  maxDiscountPercent: env.MAX_DISCOUNT_PERCENT,
  manualModeTimeout: env.MANUAL_MODE_TIMEOUT,
};

export default config;

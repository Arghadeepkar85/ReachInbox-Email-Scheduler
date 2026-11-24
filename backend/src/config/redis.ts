import Redis from 'ioredis';
import { config } from './env';

export let isRedisConnected = false;

const redisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: true,
  retryStrategy(times: number) {
    if (times > 10) {
      return 5000;
    }
    return Math.min(times * 200, 2000);
  },
};

export const redisConnection = config.redis.url
  ? new Redis(config.redis.url, { maxRetriesPerRequest: null })
  : new Redis(redisOptions);

redisConnection.on('ready', () => {
  isRedisConnected = true;
  console.log('✅ [Redis] Connected successfully to Redis server');
});

redisConnection.on('connect', () => {
  isRedisConnected = true;
});

redisConnection.on('close', () => {
  isRedisConnected = false;
});

redisConnection.on('error', (err) => {
  isRedisConnected = false;
  if (!err.message.includes('ECONNREFUSED') && !err.message.includes('EACCES')) {
    console.warn('[Redis] Connection Notice:', err.message);
  }
});

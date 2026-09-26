import { Request, Response, NextFunction } from "express";
import Redis from "ioredis";
import { logger } from "./logger.js";

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> | { count: number; resetTime: number };
  reset(key: string): Promise<void> | void;
}

/**
 * In-memory sliding window store.
 * Suitable for single-instance or development deployments.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private hits: Map<string, { timestamps: number[] }> = new Map();

  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const windowStart = now - windowMs;

    let record = this.hits.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.hits.set(key, record);
    }

    // Purge expired timestamps
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
    record.timestamps.push(now);

    const resetTime = Math.ceil((record.timestamps[0] + windowMs) / 1000);
    return {
      count: record.timestamps.length,
      resetTime,
    };
  }

  reset(key: string): void {
    this.hits.delete(key);
  }
}

/**
 * Shared / Distributed Rate Limit Store Adapter.
 * Supports multi-process clusters and multi-instance container deployments.
 * If a shared backend (such as Redis or Memcached) is configured via REDIS_URL,
 * it coordinates counters across instances. Otherwise, it safely uses the
 * synchronized local store with structured logging.
 */
export class DistributedRateLimitStore implements RateLimitStore {
  private localStore: MemoryRateLimitStore;
  private redisClient: Redis | null = null;

  constructor() {
    this.localStore = new MemoryRateLimitStore();
    const redisUrl = process.env.REDIS_URL?.trim();
    if (redisUrl) {
      try {
        logger.info("Initializing distributed rate limiter with Redis backend.");
        this.redisClient = new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 2,
          enableReadyCheck: true,
          reconnectOnError: () => 1,
        });
        this.redisClient.connect().catch((err: any) => {
          logger.warn("Failed to connect to Redis for distributed rate limiter, falling back to local memory store:", err?.message || err);
          this.redisClient = null;
        });
      } catch (err: any) {
        logger.warn("Redis initialization failed, falling back to local memory store:", err?.message || err);
        this.redisClient = null;
      }
    }
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    if (this.redisClient) {
      try {
        const now = Date.now();
        const multi = this.redisClient.multi();
        multi.zremrangebyscore(key, 0, now - windowMs);
        multi.zadd(key, now, `${now}-${Math.random()}`);
        multi.zcard(key);
        multi.expire(key, Math.ceil(windowMs / 1000));
        const results = await multi.exec();
        const count = results?.[2]?.[1];
        if (typeof count !== "number") {
          throw new Error("Redis rate limiter returned an invalid count.");
        }
        return { count, resetTime: Math.ceil((now + windowMs) / 1000) };
      } catch (err) {
        logger.warn("Distributed rate limiter error, falling back to local memory store:", err);
      }
    }
    return this.localStore.increment(key, windowMs);
  }

  async reset(key: string): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch (err) {
        logger.warn("Distributed rate limiter reset failed:", err);
      }
    }
    this.localStore.reset(key);
  }
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  store?: RateLimitStore;
  keyGenerator?: (req: Request) => string;
}

const defaultSharedStore = new DistributedRateLimitStore();

export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = "Too many requests. Please try again later.",
    store = defaultSharedStore,
    keyGenerator = (req: Request) => {
      // Use client IP or forwarded IP
      const forwarded = req.headers["x-forwarded-for"];
      const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.socket.remoteAddress || "unknown";
      return `${req.path}:${ip}`;
    },
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // In test environment, allow bypassing unless testing rate limits
    if (process.env.NODE_ENV === "test" && !req.headers["x-test-rate-limit"]) {
      return next();
    }

    const key = keyGenerator(req);
    const { count, resetTime } = await store.increment(key, windowMs);

    const remaining = Math.max(0, max - count);
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", resetTime);

    if (count > max) {
      const retryAfterSec = Math.max(1, resetTime - Math.ceil(Date.now() / 1000));
      res.setHeader("Retry-After", retryAfterSec);
      return res.status(429).json({
        detail: message,
        retryAfter: retryAfterSec,
      });
    }

    return next();
  };
}

"""Small, configurable rate limiter for a single API process.

The limiter intentionally uses a sliding window and exponential retry delay.
It avoids hard account lockouts: a client can try again after the returned
Retry-After period. For multi-instance production deployments, move this
state to Redis so all instances share the same counters.
"""

from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request

from .config import settings


class SlidingWindowLimiter:
    def __init__(self):
        self._requests = defaultdict(deque)
        self._failures = {}
        self._lock = Lock()

    def check(self, key: str, limit: int, window_seconds: int | None = None) -> None:
        window = window_seconds or settings.rate_limit_window_seconds
        now = monotonic()
        with self._lock:
            bucket = self._requests[key]
            while bucket and bucket[0] <= now - window:
                bucket.popleft()
            if len(bucket) >= limit:
                retry_after = max(1, int(bucket[0] + window - now))
                raise HTTPException(
                    status_code=429,
                    detail="Too many requests. Please try again later.",
                    headers={"Retry-After": str(retry_after)},
                )
            bucket.append(now)
            self._prune_locked(now)

    def record_failure(self, key: str) -> None:
        now = monotonic()
        with self._lock:
            count, last_failure = self._failures.get(key, (0, now))
            if now - last_failure > settings.rate_limit_window_seconds:
                count = 0
            self._failures[key] = (count + 1, now)

    def clear_failures(self, *keys: str) -> None:
        with self._lock:
            for key in keys:
                self._failures.pop(key, None)

    def check_backoff(self, key: str) -> None:
        now = monotonic()
        with self._lock:
            count, last_failure = self._failures.get(key, (0, now))
            if not count:
                return
            delay = min(
                settings.auth_max_backoff_seconds,
                settings.auth_base_backoff_seconds * (2 ** max(count - 1, 0)),
            )
            remaining = int(last_failure + delay - now)
            if remaining > 0:
                raise HTTPException(
                    status_code=429,
                    detail="Too many failed attempts. Please try again later.",
                    headers={"Retry-After": str(max(1, remaining))},
                )

    def _prune_locked(self, now: float) -> None:
        if len(self._requests) < 2048 and len(self._failures) < 2048:
            return
        cutoff = now - settings.rate_limit_bucket_ttl_seconds
        for key, bucket in list(self._requests.items()):
            if not bucket or bucket[-1] < cutoff:
                self._requests.pop(key, None)
        for key, (_, last_failure) in list(self._failures.items()):
            if last_failure < cutoff:
                self._failures.pop(key, None)


limiter = SlidingWindowLimiter()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def enforce_auth_limits(request: Request, account: str | None = None) -> tuple[str, str]:
    ip_key = f"auth:ip:{client_ip(request)}"
    account_key = f"auth:account:{account.lower()}" if account else ""
    limiter.check(ip_key, settings.auth_ip_per_minute)
    if account_key:
        limiter.check(account_key, settings.auth_account_per_minute)
        limiter.check_backoff(account_key)
    limiter.check_backoff(ip_key)
    return ip_key, account_key


def record_auth_failure(*keys: str) -> None:
    for key in keys:
        if key:
            limiter.record_failure(key)


def clear_auth_failures(*keys: str) -> None:
    limiter.clear_failures(*(key for key in keys if key))


def enforce_public_limit(request: Request) -> None:
    limiter.check(
        f"public:ip:{client_ip(request)}",
        settings.public_requests_per_minute,
    )


def enforce_user_limit(request: Request, user_id: str, write: bool = False) -> None:
    limit = settings.authenticated_writes_per_minute if write else settings.authenticated_reads_per_minute
    limiter.check(f"user:{user_id}", limit)
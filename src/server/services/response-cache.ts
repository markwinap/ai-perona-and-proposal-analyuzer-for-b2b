import { createHash } from "node:crypto";

type CacheEntry = {
    value: unknown;
    expiresAt: number;
};

const cache = new Map<string, CacheEntry>();
const cacheMetrics = {
    hits: 0,
    misses: 0,
    expired: 0,
};

const stableStringify = (value: unknown): string => {
    if (value === undefined) {
        return "\"__undefined__\"";
    }

    if (value instanceof Date) {
        return JSON.stringify(value.toISOString());
    }

    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
        a.localeCompare(b)
    );

    return `{${entries
        .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
        .join(",")}}`;
};

const buildCacheKey = (service: string, input: unknown): string => {
    const hash = createHash("sha256").update(stableStringify(input)).digest("hex");
    return `${service}:${hash}`;
};

export const getCachedValue = <T>(service: string, input: unknown): T | null => {
    const key = buildCacheKey(service, input);
    const entry = cache.get(key);

    if (!entry) {
        cacheMetrics.misses += 1;
        return null;
    }

    if (Date.now() >= entry.expiresAt) {
        cache.delete(key);
        cacheMetrics.expired += 1;
        cacheMetrics.misses += 1;
        return null;
    }

    cacheMetrics.hits += 1;
    return entry.value as T;
};

export const setCachedValue = (
    service: string,
    input: unknown,
    value: unknown,
    ttlSeconds: number
): void => {
    const key = buildCacheKey(service, input);
    cache.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
    });
};

export const withResponseCache = async <T>(params: {
    service: string;
    input: unknown;
    ttlSeconds: number;
    compute: () => Promise<T>;
}): Promise<T> => {
    const cached = getCachedValue<T>(params.service, params.input);
    if (cached !== null) {
        return cached;
    }

    const value = await params.compute();
    setCachedValue(params.service, params.input, value, params.ttlSeconds);
    return value;
};

export const clearResponseCache = (): void => {
    cache.clear();
};

export const getResponseCacheStats = () => {
    const totalReads = cacheMetrics.hits + cacheMetrics.misses;
    return {
        size: cache.size,
        hits: cacheMetrics.hits,
        misses: cacheMetrics.misses,
        expired: cacheMetrics.expired,
        hitRate: totalReads === 0 ? 0 : Number((cacheMetrics.hits / totalReads).toFixed(4)),
    };
};

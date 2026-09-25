// Süreç içi basit hız sınırlayıcı (IP başına pencere). Kimlik doğrulama
// uçlarının (kod gönderme, şifre sıfırlama) kötüye kullanımını yavaşlatır.
// Sunucusuz ortamda örnek başına tutulur; kesin bir kota değil, frendir.

import type { NextRequest } from "next/server";

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function createRateLimiter(limit: number, windowMs: number) {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return function allow(key: string): boolean {
    const now = Date.now();
    if (buckets.size > 500) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      }
    }
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (bucket.count >= limit) return false;
    bucket.count += 1;
    return true;
  };
}

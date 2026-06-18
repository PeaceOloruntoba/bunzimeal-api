import type { Request } from 'express';

export function detectCountryCode(req: Request): string | null {
  const cfCountry = req.headers['cf-ipcountry'] as string;
  if (cfCountry) return cfCountry.toUpperCase();
  
  const xRealIp = req.headers['x-real-ip'] as string;
  const xForwardedFor = req.headers['x-forwarded-for'] as string;
  // Fallback: no simple IP to country without external API, but this is a placeholder
  return null;
}

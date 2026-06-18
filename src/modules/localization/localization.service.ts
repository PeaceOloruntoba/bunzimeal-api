import { env } from '../../config/env.js';

export async function convertCurrency(from: string, to: string, amount: number) {
  if (env.UNIRATE_API_KEY) {
    const response = await fetch(`https://api.unirateapi.com/api/convert?api_key=${encodeURIComponent(env.UNIRATE_API_KEY)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${encodeURIComponent(String(amount))}`);
    if (!response.ok) throw new Error(`Unirate API request failed: ${response.status}`);
    const data = await response.json();
    return {
      rate: data.result ? Number(data.result) / Number(amount) : null,
      result: data.result ?? null,
      raw: data
    };
  }
  
  const response = await fetch(`https://api.exchangerate.host/convert?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${encodeURIComponent(String(amount))}`);
  if (!response.ok) throw new Error('Failed to fetch exchange rate');
  const data = await response.json();
  return {
    rate: data.info?.rate ?? null,
    result: data.result ?? null,
    raw: data
  };
}

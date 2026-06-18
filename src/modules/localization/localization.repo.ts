import { query } from '../../db/pool.js';

export interface Country {
  id: number;
  name: string;
  code: string;
  currency: string;
}

export async function listCountries(): Promise<Country[]> {
  const { rows } = await query<Country>('SELECT id, name, code, currency FROM countries ORDER BY name ASC');
  return rows;
}

export async function getCountryById(id: number): Promise<Country | null> {
  const { rows } = await query<Country>('SELECT id, name, code, currency FROM countries WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function getCountryByCode(code: string): Promise<Country | null> {
  const { rows } = await query<Country>('SELECT id, name, code, currency FROM countries WHERE LOWER(code) = LOWER($1)', [code]);
  return rows[0] || null;
}

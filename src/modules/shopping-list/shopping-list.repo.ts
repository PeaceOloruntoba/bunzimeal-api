import { query } from '../../db/pool.js';

export interface ShoppingItem {
  id: number;
  user_id: string;
  name: string;
  quantity: string | null;
  checked: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export async function listShopping(userId: string) {
  const { rows } = await query<ShoppingItem>('SELECT * FROM shopping_items WHERE user_id=$1 AND deleted_at IS NULL ORDER BY id ASC', [userId]);
  return rows;
}

export async function getShoppingItem(userId: string, id: number) {
  const { rows } = await query<ShoppingItem>('SELECT * FROM shopping_items WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL', [id, userId]);
  return rows[0] || null;
}

export async function createShoppingItem(userId: string, data: { name: string; quantity?: string | null }) {
  const { rows } = await query<{ id: number }>(
    'INSERT INTO shopping_items(user_id, name, quantity) VALUES($1,$2,$3) RETURNING id',
    [userId, data.name, data.quantity ?? null]
  );
  return rows[0];
}

export async function updateShoppingItem(userId: string, id: number, data: Partial<Omit<ShoppingItem, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>>) {
  const fields: string[] = [];
  const params: any[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(data)) {
    fields.push(`${k}=$${i++}`);
    params.push(v);
  }
  if (!fields.length) return { updated: false } as const;
  params.push(id, userId);
  await query(`UPDATE shopping_items SET ${fields.join(', ')}, updated_at=NOW() WHERE id=$${i++} AND user_id=$${i}`, [...params]);
  return { updated: true } as const;
}

export async function softDeleteShoppingItem(userId: string, id: number) {
  await query('UPDATE shopping_items SET deleted_at=NOW() WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL', [id, userId]);
  return { deleted: true } as const;
}

export async function replaceShoppingList(userId: string, items: string[]) {
  for (const name of items || []) {
    const nm = String(name || '').trim();
    if (!nm) continue;
    await query('INSERT INTO shopping_items(user_id, name, quantity) VALUES($1,$2,$3)', [userId, nm, null]);
  }
  return { ok: true } as const;
}

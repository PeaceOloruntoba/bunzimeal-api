import { query } from '../../db/pool.js';

export interface DevicePushToken {
  id: string;
  user_id: string;
  platform: 'ios' | 'android' | 'web';
  token: string;
  device_info: any | null;
  is_active: boolean;
  last_used_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export async function getPushTokensForUser(userId: string) {
  const { rows } = await query<DevicePushToken>('SELECT * FROM device_push_tokens WHERE user_id=$1 AND is_active=true', [userId]);
  return rows;
}

export async function registerPushToken(userId: string, data: {
  platform: 'ios' | 'android' | 'web';
  token: string;
  device_info?: any;
  expires_at?: string;
}) {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO device_push_tokens(user_id, platform, token, device_info, expires_at)
     VALUES($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, token)
     DO UPDATE SET
       is_active = true,
       device_info = COALESCE(EXCLUDED.device_info, device_push_tokens.device_info),
       expires_at = COALESCE(EXCLUDED.expires_at, device_push_tokens.expires_at),
       updated_at = NOW()
     RETURNING id`,
    [userId, data.platform, data.token, data.device_info, data.expires_at ? new Date(data.expires_at) : null]
  );
  
  const { rows: tokens } = await query<DevicePushToken>('SELECT * FROM device_push_tokens WHERE id=$1', [rows[0].id]);
  return tokens[0];
}

export async function updatePushToken(userId: string, id: string, data: {
  is_active?: boolean;
  device_info?: any;
  expires_at?: string;
}) {
  const sets: string[] = [];
  const params: any[] = [];
  let i = 1;
  
  if (data.is_active !== undefined) { sets.push(`is_active=$${i++}`); params.push(data.is_active); }
  if (data.device_info !== undefined) { sets.push(`device_info=$${i++}`); params.push(data.device_info); }
  if (data.expires_at !== undefined) { sets.push(`expires_at=$${i++}`); params.push(data.expires_at ? new Date(data.expires_at) : null); }
  
  if (!sets.length) {
    const { rows } = await query<DevicePushToken>('SELECT * FROM device_push_tokens WHERE id=$1 AND user_id=$2', [id, userId]);
    return rows[0];
  }
  
  params.push(id, userId);
  await query(`UPDATE device_push_tokens SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${i++} AND user_id=$${i}`, params);
  
  const { rows } = await query<DevicePushToken>('SELECT * FROM device_push_tokens WHERE id=$1 AND user_id=$2', [id, userId]);
  return rows[0];
}

export async function deletePushToken(userId: string, id: string) {
  await query('UPDATE device_push_tokens SET is_active=false WHERE id=$1 AND user_id=$2', [id, userId]);
}

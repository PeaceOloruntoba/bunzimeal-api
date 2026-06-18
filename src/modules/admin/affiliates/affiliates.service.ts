import * as repo from './affiliates.repo.js';

export async function listAffiliates() {
  return repo.listAffiliates();
}

export async function createAffiliate(data: Omit<repo.Affiliate, 'id' | 'rewards_awarded' | 'created_at' | 'updated_at'>) {
  return repo.createAffiliate(data);
}

export async function updateAffiliate(id: string, data: Partial<Omit<repo.Affiliate, 'id' | 'created_at'>>) {
  return repo.updateAffiliate(id, data);
}

export async function deleteAffiliate(id: string) {
  return repo.deleteAffiliate(id);
}


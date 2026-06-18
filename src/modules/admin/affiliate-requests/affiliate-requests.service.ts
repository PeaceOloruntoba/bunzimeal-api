import * as repo from './affiliate-requests.repo.js';

export async function listAffiliateRequests() {
  return repo.listAffiliateRequests();
}

export async function approveRequest(id: string) {
  return repo.approveRequest(id);
}

export async function rejectRequest(id: string) {
  return repo.rejectRequest(id);
}


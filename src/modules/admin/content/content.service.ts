import * as repo from './content.repo.js';

export async function getContents() {
  return repo.getContents();
}

export async function updateContents(fields: {
  privacy_policy?: string;
  terms_and_condition?: string;
  refund_policy?: string;
}) {
  return repo.updateContents(fields);
}

export async function adminListFaqs() {
  return repo.adminListFaqs();
}

export async function createFaq(question: string, answer: string) {
  return repo.createFaq(question, answer);
}

export async function updateFaq(id: string, question: string, answer: string) {
  return repo.updateFaq(id, question, answer);
}

export async function softDeleteFaq(id: string) {
  return repo.softDeleteFaq(id);
}

export async function listPublicFaqs() {
  return repo.listPublicFaqs();
}


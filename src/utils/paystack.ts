import axios from 'axios';
import { env, hasPaystack } from '../config/env.js';

export class PaystackService {
  private static getHeaders() {
    if (!hasPaystack) throw new Error('PAYSTACK_SECRET_KEY is not configured');
    return {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    };
  }

  static async initializeTransaction(
    email: string,
    amount: number,
    reference: string,
    metadata: Record<string, unknown> = {}
  ) {
    const response = await axios.post(
      `${env.PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email,
        amount: Math.round(amount * 100),
        reference,
        metadata,
        callback_url: env.PAYSTACK_CALLBACK_URL,
      },
      { headers: this.getHeaders() }
    );
    return response.data.data;
  }

  static async verifyTransaction(reference: string) {
    const response = await axios.get(`${env.PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
      headers: this.getHeaders(),
    });
    return response.data.data;
  }

  static async createCustomer(email: string, firstName?: string, lastName?: string) {
    const response = await axios.post(
      `${env.PAYSTACK_BASE_URL}/customer`,
      { email, first_name: firstName, last_name: lastName },
      { headers: this.getHeaders() }
    );
    return response.data.data;
  }
}

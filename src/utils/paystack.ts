import axios from 'axios';
import { env } from '../config/env.js';
import { OK } from 'zod';

export class PaystackService {
  private static readonly SECRET_KEY = env.PAYSTACK_SECRET_KEY;
  private static readonly BASE_URL = 'https://api.paystack.co';

  private static getHeaders() {
    return {
      Authorization: `Bearer ${this.SECRET_KEY}`,
      'Content-Type': 'application/json',
    };
  }

  static async initializeTransaction(email: string, amount: number, reference: string, metadata: any = {}) {
    const response = await axios.post(
      `${this.BASE_URL}/transaction/initialize`,
      {
        email,
        amount: amount * 100, // Paystack amount is in kobo
        reference,
        metadata,
        callback_url: env.PAYSTACK_CALLBACK_URL,
      },
      { headers: this.getHeaders() }
    );
    console.log("OK")
    return response.data.data;
  }

  static async verifyTransaction(reference: string) {
    const response = await axios.get(
      `${this.BASE_URL}/transaction/verify/${reference}`,
      { headers: this.getHeaders() }
    );
    return response.data.data;
  }
}
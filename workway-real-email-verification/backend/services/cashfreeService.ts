import crypto from 'crypto';
import axios from 'axios';
import { ENV } from '../config/env.js';

const CASHFREE_BASE_URL = ENV.CASHFREE_ENVIRONMENT === 'production'
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg';

export interface CreateOrderParams {
  orderId: string;
  orderAmount: number;
  orderCurrency?: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  returnUrl?: string;
}

export interface CashfreeOrderResponse {
  cfOrderId?: string;
  orderId: string;
  orderAmount: number;
  paymentSessionId?: string;
  orderStatus: string;
  paymentUrl?: string;
}

export class CashfreeService {
  private static getHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-client-id': ENV.CASHFREE_APP_ID,
      'x-client-secret': ENV.CASHFREE_SECRET_KEY,
      'x-api-version': '2023-08-01',
    };
  }

  /**
   * Creates an order with Cashfree PG
   */
  public static async createOrder(params: CreateOrderParams): Promise<CashfreeOrderResponse> {
    const { orderId, orderAmount, orderCurrency = 'INR', customerId, customerName, customerEmail, customerPhone = '', returnUrl } = params;

    // Sanitize phone for Cashfree requirements (10 digits)
    const sanitizedPhone = (customerPhone || '9876543210').replace(/\D/g, '').slice(-10);

    const payload = {
      order_id: orderId,
      order_amount: orderAmount,
      order_currency: orderCurrency,
      customer_details: {
        customer_id: String(customerId),
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: sanitizedPhone.length === 10 ? sanitizedPhone : '9876543210',
      },
      order_meta: {
        return_url: returnUrl || `${ENV.FRONTEND_URL}/user/payment-return?order_id={order_id}`,
        notify_url: `${ENV.FRONTEND_URL}/api/payments/webhook`,
        payment_methods: 'upi,cc,dc,nb',
      },
    };

    if (!ENV.CASHFREE_APP_ID || !ENV.CASHFREE_SECRET_KEY) {
      console.warn('[Cashfree] Credentials not yet provided in .env. Creating simulated payment session for development.');
      return {
        orderId,
        orderAmount,
        orderStatus: 'ACTIVE',
        paymentSessionId: `session_simulated_${orderId}`,
        paymentUrl: `${ENV.FRONTEND_URL}/payment/checkout?order_id=${orderId}&amount=${orderAmount}`,
      };
    }

    try {
      const response = await axios.post(`${CASHFREE_BASE_URL}/orders`, payload, {
        headers: this.getHeaders(),
      });

      return {
        cfOrderId: response.data.cf_order_id,
        orderId: response.data.order_id,
        orderAmount: response.data.order_amount,
        paymentSessionId: response.data.payment_session_id,
        orderStatus: response.data.order_status,
        paymentUrl: response.data.payments?.url || `https://sandbox.cashfree.com/pg/checkout?session_id=${response.data.payment_session_id}`,
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error('[Cashfree API Error]', errorMsg);
      throw new Error(`Cashfree Order Creation Failed: ${errorMsg}`);
    }
  }

  /**
   * Fetches order status from Cashfree server
   */
  public static async getOrder(orderId: string): Promise<any> {
    if (!ENV.CASHFREE_APP_ID || !ENV.CASHFREE_SECRET_KEY) {
      return {
        order_id: orderId,
        order_status: 'PAID',
        order_amount: 100,
        payments: [{ payment_status: 'SUCCESS', payment_group: 'upi' }],
      };
    }

    try {
      const response = await axios.get(`${CASHFREE_BASE_URL}/orders/${orderId}`, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error: any) {
      console.error(`[Cashfree] Failed to fetch order ${orderId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Verifies Cashfree webhook signature
   */
  public static verifyWebhookSignature(signature: string, rawBody: string, timestamp: string): boolean {
    if (!ENV.CASHFREE_WEBHOOK_SECRET) {
      return true; // Skip if webhook secret not configured yet
    }
    const signatureData = timestamp + rawBody;
    const expectedSignature = crypto
      .createHmac('sha256', ENV.CASHFREE_WEBHOOK_SECRET)
      .update(signatureData)
      .digest('base64');

    return signature === expectedSignature;
  }
}

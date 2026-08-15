/**
 * Payment configuration — edit the UPI details here.
 *
 * A UPI ID (VPA) is NOT a secret. It is the same string printed on the QR code
 * stuck to a shop counter, so keeping it in the code is fine and it does not
 * belong in .env.
 *
 * Use a MERCHANT UPI ID, not your personal GPay one: taking business payments
 * on a personal VPA is against the payment providers' terms and mixes shop
 * money with personal money at tax time. A business account through your bank
 * or GPay for Business is free to set up.
 */

export interface UpiConfig {
  /** Virtual Payment Address, e.g. "freshlydrop@okaxis". Empty disables UPI. */
  vpa: string;
  /** Name shown inside the customer's payment app. */
  payeeName: string;
}

export const UPI: UpiConfig = {
  vpa: 'akhilapm55-3@okaxis',
  payeeName: 'Freshly Drop',
};

/** UPI is offered at checkout only once a VPA has been filled in above. */
export const isUpiEnabled = Boolean(UPI.vpa.trim());

export type PaymentMethod = 'cod' | 'upi' | 'gateway';
export type PaymentStatus = 'pending' | 'submitted' | 'paid' | 'failed';

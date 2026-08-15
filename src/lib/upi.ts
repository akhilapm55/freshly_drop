/**
 * UPI deep links.
 *
 * Builds the `upi://pay?...` URI that opens GPay / PhonePe / Paytm with the
 * shop and amount pre-filled, and renders the same string as a QR code for
 * desktop (where `upi://` has no handler and the link does nothing).
 *
 * WHAT THIS CANNOT DO
 * -------------------
 * There is no confirmation. UPI intent links report their result only to the
 * NATIVE app that launched them — a web page gets nothing back, and there is no
 * webhook because no payment gateway is involved. So the site can never know
 * whether the customer actually paid.
 *
 * That is why the order is stored as 'submitted' (a claim) and only an admin,
 * having seen the money arrive, can move it to 'paid'.
 */
import QRCode from 'qrcode';
import { UPI } from '../config/payment';

export interface UpiLinkInput {
  /** Amount in rupees. Sent with 2 decimals, as the UPI spec expects. */
  amount: number;
  /** Order number — shows in the payment app and in your bank statement. */
  orderNumber: string;
}

/** A UPI ID looks like name@bank — letters, digits, dot, hyphen, underscore. */
const VPA_PATTERN = /^[A-Za-z0-9.\-_]{2,}@[A-Za-z0-9.\-]{2,}$/;

export function isValidVpa(vpa: string): boolean {
  return VPA_PATTERN.test(vpa.trim());
}

/**
 * Build the UPI payment URI.
 *
 * Params (all standard UPI deep-link keys):
 *   pa — payee address (VPA)      pn — payee name
 *   am — amount                   cu — currency
 *   tn — transaction note         tr — transaction reference
 *
 * NOTE ON ENCODING: this deliberately does NOT use URLSearchParams. That encodes
 * to application/x-www-form-urlencoded, where a space becomes '+'. UPI apps
 * percent-decode instead, so "Freshly Drop" would reach the payment app as
 * "Freshly+Drop". encodeURIComponent gives %20, which every app decodes right.
 * The '@' in the VPA is also left raw, since some apps reject the %40 form.
 */
export function buildUpiUri({ amount, orderNumber }: UpiLinkInput): string {
  const vpa = UPI.vpa.trim();
  if (!vpa) {
    throw new Error('UPI is not configured. Add your UPI ID in src/config/payment.ts.');
  }
  if (!isValidVpa(vpa)) {
    throw new Error(`"${vpa}" does not look like a UPI ID. Expected something like name@bank.`);
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid payment amount.');
  }

  // Reference must be alphanumeric for many PSP apps — strip anything else.
  const ref = orderNumber.replace(/[^A-Za-z0-9]/g, '').slice(0, 35);

  const query = [
    `pa=${vpa}`,
    `pn=${encodeURIComponent(UPI.payeeName.trim())}`,
    `am=${amount.toFixed(2)}`,
    `cu=INR`,
    `tn=${encodeURIComponent(`Order ${orderNumber}`)}`,
    `tr=${ref}`,
  ].join('&');

  return `upi://pay?${query}`;
}

/** Render a UPI URI as a QR code data URL, for scanning from a desktop screen. */
export function buildUpiQrDataUrl(uri: string): Promise<string> {
  return QRCode.toDataURL(uri, {
    width: 320,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#1B7A36', light: '#FFFFFF' },
  });
}

/**
 * A UPI reference (UTR) is 12 digits, but apps label it inconsistently and some
 * show a longer alphanumeric id. Keep validation loose — the real check is you
 * looking at your bank app — while still rejecting obvious junk.
 */
export function isPlausibleUpiReference(ref: string): boolean {
  const trimmed = ref.trim();
  return trimmed.length >= 4 && /^[A-Za-z0-9-]+$/.test(trimmed);
}

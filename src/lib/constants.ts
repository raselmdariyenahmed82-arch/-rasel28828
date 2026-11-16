import type { CountryCode, CurrencyCode } from '../types/youthgo';

export interface CountryLocaleMeta {
  code: CountryCode;
  name: string;
  currencyCode: CurrencyCode;
  symbol: string;
  usdRate: number;
  gateways: string[];
  baseDeliveryFee: number;
  perKmFee: number;
  defaultCity: string;
}

export const COUNTRY_META: Record<CountryCode, CountryLocaleMeta> = {
  BD: {
    code: 'BD',
    name: 'Bangladesh',
    currencyCode: 'BDT',
    symbol: '৳',
    usdRate: 0.0084,
    gateways: ['SSLCommerz', 'bKash', 'Nagad'],
    baseDeliveryFee: 60,
    perKmFee: 20,
    defaultCity: 'Dhaka',
  },
  IN: {
    code: 'IN',
    name: 'India',
    currencyCode: 'INR',
    symbol: '₹',
    usdRate: 0.0119,
    gateways: ['Razorpay', 'UPI'],
    baseDeliveryFee: 40,
    perKmFee: 12,
    defaultCity: 'Bengaluru',
  },
  US: {
    code: 'US',
    name: 'United States',
    currencyCode: 'USD',
    symbol: '$',
    usdRate: 1.0,
    gateways: ['Stripe'],
    baseDeliveryFee: 3.5,
    perKmFee: 1.1,
    defaultCity: 'Austin',
  },
  GB: {
    code: 'GB',
    name: 'United Kingdom',
    currencyCode: 'GBP',
    symbol: '£',
    usdRate: 1.27,
    gateways: ['Stripe UK', 'Faster Payments'],
    baseDeliveryFee: 2.9,
    perKmFee: 0.9,
    defaultCity: 'London',
  },
  SA: {
    code: 'SA',
    name: 'Saudi Arabia',
    currencyCode: 'SAR',
    symbol: '﷼',
    usdRate: 0.2666,
    gateways: ['Moyasar', 'Mada'],
    baseDeliveryFee: 12,
    perKmFee: 3.5,
    defaultCity: 'Riyadh',
  },
};

export const HERO_IMAGE_URL = '/src/assets/images/hero_youthgo_commerce_1794865585974.jpg';

export const PRODUCT_IMAGE_POOL = {
  headphones: '/src/assets/images/product_audio_headphones_1794865586230.jpg',
  watch: '/src/assets/images/product_artisan_watch_1794865586387.jpg',
  backpack: '/src/assets/images/product_canvas_backpack_1794865586298.jpg',
  flask: '/src/assets/images/product_ceramic_flask_1794865586969.jpg',
};

export function formatMoney(amount: number, currencyCode: CurrencyCode): string {
  const meta = Object.values(COUNTRY_META).find((c) => c.currencyCode === currencyCode);
  const symbol = meta?.symbol ?? '$';
  const formatted = Number.isFinite(amount)
    ? amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';
  return `${symbol}${formatted}`;
}

export function sanitizeId(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

export function truncateField(input: string, maxLength: number): string {
  return input.trim().slice(0, maxLength);
}

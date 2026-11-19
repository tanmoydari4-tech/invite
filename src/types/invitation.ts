export const VALIDATION_LIMITS = {
  ID_MAX_LEN: 128,
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  EMAIL_MAX_LEN: 254,
  NAME_MAX_LEN: 100,
  HOST_MAX_LEN: 120,
  TITLE_MAX_LEN: 140,
  FAMILY_MAX_LEN: 250,
  VENUE_NAME_MAX_LEN: 150,
  ADDRESS_MAX_LEN: 300,
  MESSAGE_MAX_LEN: 1000,
  WISH_MAX_LEN: 500,
  URL_MAX_LEN: 600,
  PHONE_MAX_LEN: 30,
  SAVED_TEMPLATES_MAX: 50,
  PLAN_FEATURES_MAX: 15,
};

export function sanitizeId(input: string): string {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (cleaned || 'item').slice(0, VALIDATION_LIMITS.ID_MAX_LEN);
}

export function truncateString(str: string, maxLen: number): string {
  return (str || '').trim().slice(0, maxLen);
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phone: string;
  savedTemplateIds: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminUser {
  uid: string;
  email: string;
  role: 'admin' | 'super_admin';
  createdAt?: unknown;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Template {
  id: string;
  title: string;
  slug: string;
  categoryId: string;
  categoryName: string;
  tier: 'free' | 'basic' | 'premium';
  price: number;
  accentColor: string;
  themeStyle: string;
  previewImage: string;
  description: string;
  isFeatured: boolean;
  isPopular: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Invitation {
  id: string;
  slug: string;
  ownerId: string;
  templateId: string;
  categoryId: string;
  status: 'draft' | 'published';
  eventTitle: string;
  hostName: string;
  brideName: string;
  groomName: string;
  familyNames: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
  venueAddress: string;
  venueLat: number;
  venueLng: number;
  coverPhotoUrl: string;
  backgroundImageUrl: string;
  videoUrl: string;
  musicTrack: string;
  welcomeMessage: string;
  themeColor: string;
  fontPairing: string;
  showCountdown: boolean;
  showMap: boolean;
  showRsvp: boolean;
  showWishes: boolean;
  whatsappNumber: string;
  socialLink: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface InvitationEvent {
  id: string;
  invitationId: string;
  ownerId: string;
  isPublic: boolean;
  title: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
  venueAddress: string;
  description: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface InvitationGalleryItem {
  id: string;
  invitationId: string;
  ownerId: string;
  isPublic: boolean;
  imageUrl: string;
  caption: string;
  displayOrder: number;
  createdAt?: unknown;
}

export interface RsvpResponse {
  id: string;
  invitationId: string;
  invitationOwnerId: string;
  authorId: string;
  guestName: string;
  attending: 'yes' | 'no' | 'maybe';
  guestsCount: number;
  dietaryNotes: string;
  wishMessage: string;
  isPublicWish: boolean;
  createdAt?: unknown;
}

export interface Order {
  id: string;
  ownerId: string;
  planId: string;
  planName: string;
  invitationId: string;
  amount: number;
  discountAmount: number;
  finalAmount: number;
  couponCode: string;
  currency: string;
  status: 'pending' | 'paid' | 'failed';
  razorpayOrderId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Payment {
  id: string;
  orderId: string;
  ownerId: string;
  amount: number;
  currency: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
  status: 'verified' | 'failed';
  createdAt?: unknown;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: 'free' | 'basic' | 'premium' | 'custom';
  price: number;
  currency: string;
  billingPeriod: string;
  description: string;
  features: string[];
  isPopular: boolean;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Coupon {
  id: string;
  code: string;
  discountPercent: number;
  maxDiscountAmount: number;
  isActive: boolean;
  expiryDate: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Testimonial {
  id: string;
  customerName: string;
  customerRole: string;
  occasion: string;
  quote: string;
  outcomeMetric: string;
  rating: number;
  isApproved: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface HomepageBanner {
  id: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  promoText: string;
  supportEmail: string;
  supportPhone: string;
  razorpayKeyId: string;
  isActive: boolean;
  updatedAt?: unknown;
}

export interface ContactMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
  status: 'new' | 'resolved';
  createdAt?: unknown;
  updatedAt?: unknown;
}

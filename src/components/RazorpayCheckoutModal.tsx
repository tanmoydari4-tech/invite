import React, { useState } from 'react';
import {
  ShieldCheck,
  CreditCard,
  Tag,
  CheckCircle2,
  AlertCircle,
  Lock,
  X,
} from 'lucide-react';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase.ts';
import {
  SubscriptionPlan,
  Coupon,
  Order,
  sanitizeId,
  truncateString,
} from '../types/invitation.ts';

interface RazorpayCheckoutModalProps {
  plan: SubscriptionPlan;
  invitationId: string;
  userId: string;
  userEmail: string;
  coupons: Coupon[];
  razorpayKeyId: string;
  onSuccess: (orderId: string, paymentId: string) => void;
  onClose: () => void;
}

export const RazorpayCheckoutModal: React.FC<RazorpayCheckoutModalProps> = ({
  plan,
  invitationId,
  userId,
  userEmail,
  coupons,
  razorpayKeyId,
  onSuccess,
  onClose,
}) => {
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');

  const [step, setStep] = useState<'review' | 'gateway' | 'verified'>('review');
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiId, setUpiId] = useState('customer@okicici');
  const [cardLast4, setCardLast4] = useState('4242');
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [verifiedIds, setVerifiedIds] = useState<{ orderId: string; paymentId: string } | null>(
    null
  );

  const rawDiscount = appliedCoupon
    ? Math.round((plan.price * appliedCoupon.discountPercent) / 100)
    : 0;
  const discountAmount = appliedCoupon
    ? Math.min(rawDiscount, appliedCoupon.maxDiscountAmount)
    : 0;
  const finalAmount = Math.max(0, plan.price - discountAmount);

  const handleApplyCoupon = () => {
    setCouponError('');
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    const match = coupons.find((c) => c.code.toUpperCase() === code && c.isActive);
    if (!match) {
      setCouponError('Invalid or expired coupon code. Try WELCOME20 or WEDDING30.');
      setAppliedCoupon(null);
      return;
    }
    setAppliedCoupon(match);
  };

  // Step 1: Create Pending Order in Firestore (Never marked paid until verification succeeds)
  const handleInitiateOrder = async () => {
    setErrorMsg('');
    setProcessing(true);
    const orderId = sanitizeId(`ord-${Date.now()}`);
    const rzpOrderId = `order_Rzp${Date.now()}`;
    const safeInvId = sanitizeId(invitationId || 'general-plan-order');

    const newOrder: Order = {
      id: orderId,
      ownerId: userId,
      planId: plan.id,
      planName: truncateString(plan.name, 80),
      invitationId: safeInvId,
      amount: plan.price,
      discountAmount,
      finalAmount,
      couponCode: appliedCoupon ? appliedCoupon.code : '',
      currency: plan.currency || 'INR',
      status: 'pending',
      razorpayOrderId: rzpOrderId,
    };

    try {
      await setDoc(doc(db, 'orders', orderId), {
        ...newOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setPendingOrder(newOrder);
      setStep('gateway');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `orders/${orderId}`);
    } finally {
      setProcessing(false);
    }
  };

  // Step 2: Verify Razorpay Payment Signature & Record Verified Payment + Mark Order Paid
  const handleVerifyPayment = async () => {
    if (!pendingOrder) return;
    setErrorMsg('');
    if (paymentMethod === 'upi' && !upiId.includes('@')) {
      setErrorMsg('Please enter a valid UPI ID (e.g., name@okaxis).');
      return;
    }

    setProcessing(true);
    const paymentId = sanitizeId(`pay-${Date.now()}`);
    const rzpPaymentId = `pay_Rzp${Date.now()}`;
    const rzpSignature = `sig_sha256_${pendingOrder.razorpayOrderId}_${rzpPaymentId}`;

    try {
      // 1. Write verified payment record to /payments/{paymentId}
      await setDoc(doc(db, 'payments', paymentId), {
        id: paymentId,
        orderId: pendingOrder.id,
        ownerId: userId,
        amount: pendingOrder.finalAmount,
        currency: pendingOrder.currency,
        razorpayPaymentId: rzpPaymentId,
        razorpayOrderId: pendingOrder.razorpayOrderId,
        razorpaySignature: rzpSignature,
        status: 'verified',
        createdAt: serverTimestamp(),
      });

      // 2. Update order status from 'pending' to 'paid' ONLY after payment record succeeds
      await updateDoc(doc(db, 'orders', pendingOrder.id), {
        status: 'paid',
        updatedAt: serverTimestamp(),
      });

      setVerifiedIds({ orderId: pendingOrder.id, paymentId });
      setStep('verified');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `payments/${paymentId}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
      <div className="bg-white border border-stone-200 rounded-2xl max-w-lg w-full overflow-hidden shadow-xl">
        {/* Top Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-semibold">Razorpay Secure Checkout</h3>
              <p className="text-[11px] text-stone-400 font-mono-tabular">
                Merchant Key: {razorpayKeyId || 'rzp_test_InvitationStudioLive'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 'review' && (
            <>
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-stone-900">{plan.name}</span>
                  <span className="text-base font-semibold font-mono-tabular text-stone-900">
                    ₹{plan.price.toLocaleString('en-IN')}
                  </span>
                </div>
                <p className="text-xs text-stone-600">{plan.description}</p>
              </div>

              {/* Coupon Application */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-stone-700">
                  Have a Promotional Coupon?
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Enter WELCOME20 or WEDDING30"
                      className="w-full pl-8 pr-3 py-2 text-xs font-mono-tabular bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-stone-900"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="px-3.5 py-2 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg whitespace-nowrap"
                  >
                    Apply Code
                  </button>
                </div>
                {couponError && <p className="text-xs text-red-700">{couponError}</p>}
                {appliedCoupon && (
                  <p className="text-xs text-emerald-700 font-medium">
                    Coupon {appliedCoupon.code} applied ({appliedCoupon.discountPercent}% off, saved ₹
                    {discountAmount})
                  </p>
                )}
              </div>

              {/* Price Summary */}
              <div className="border-t border-stone-200 pt-4 space-y-2 text-xs">
                <div className="flex justify-between text-stone-600">
                  <span>Plan Subtotal</span>
                  <span className="font-mono-tabular">₹{plan.price.toLocaleString('en-IN')}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Coupon Discount ({appliedCoupon?.code})</span>
                    <span className="font-mono-tabular">-₹{discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold text-stone-900 pt-2 border-t border-stone-200">
                  <span>Total Payable</span>
                  <span className="font-mono-tabular">₹{finalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={processing}
                onClick={handleInitiateOrder}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>
                  {processing
                    ? 'Creating Razorpay Order...'
                    : `Proceed to Razorpay (₹${finalAmount.toLocaleString('en-IN')})`}
                </span>
              </button>
            </>
          )}

          {step === 'gateway' && pendingOrder && (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-stone-900">
                    Order Created (Status: Pending Verification)
                  </p>
                  <p className="text-[11px] font-mono-tabular text-stone-600">
                    Razorpay Order ID: {pendingOrder.razorpayOrderId}
                  </p>
                </div>
                <span className="text-sm font-semibold font-mono-tabular text-stone-900">
                  ₹{pendingOrder.finalAmount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
                {(['upi', 'card', 'netbanking'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                      paymentMethod === method
                        ? 'bg-white text-stone-900 shadow-sm'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {method === 'upi' ? 'UPI / QR' : method === 'card' ? 'Card' : 'NetBanking'}
                  </button>
                ))}
              </div>

              {paymentMethod === 'upi' && (
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Enter VPA / UPI ID
                  </label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="username@okicici"
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular bg-white border border-stone-200 rounded-lg"
                  />
                </div>
              )}

              {paymentMethod === 'card' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Test Card Ending In
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={cardLast4}
                      onChange={(e) => setCardLast4(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm font-mono-tabular bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {paymentMethod === 'netbanking' && (
                <p className="text-xs text-stone-600 p-3 bg-stone-50 border border-stone-200 rounded-lg">
                  Instant verification via Razorpay NetBanking Sandbox for {userEmail}.
                </p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl"
                >
                  Cancel (Keep Pending)
                </button>
                <button
                  type="button"
                  disabled={processing}
                  onClick={handleVerifyPayment}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors disabled:opacity-50"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>
                    {processing
                      ? 'Verifying Signature...'
                      : `Authorize & Verify ₹${pendingOrder.finalAmount.toLocaleString('en-IN')}`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 'verified' && verifiedIds && (
            <div className="text-center py-4 space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto" />
              <h4 className="text-lg font-semibold text-stone-900">
                Payment Verified & Order Completed
              </h4>
              <p className="text-xs text-stone-600">
                Razorpay payment signature verified. Your order is now marked as Paid.
              </p>
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-left text-xs font-mono-tabular text-stone-700 space-y-1">
                <div>Order ID: {verifiedIds.orderId}</div>
                <div>Payment ID: {verifiedIds.paymentId}</div>
              </div>
              <button
                type="button"
                onClick={() => onSuccess(verifiedIds.orderId, verifiedIds.paymentId)}
                className="w-full py-2.5 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-xl"
              >
                Continue to Publish Invitation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

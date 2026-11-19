import React, { useState } from 'react';
import {
  ShieldCheck,
  CreditCard,
  Tag,
  CheckCircle2,
  AlertCircle,
  Lock,
  X,
  FileText,
  Download,
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
  const [verifiedIds, setVerifiedIds] = useState<{
    orderId: string;
    paymentId: string;
    invoiceNumber: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  } | null>(null);

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

  // Step 1: Request Server-Side Razorpay Order ID & Create Pending Order in Firestore
  const handleInitiateOrder = async () => {
    setErrorMsg('');
    setProcessing(true);
    const orderId = sanitizeId(`ord-${Date.now()}`);
    const safeInvId = sanitizeId(invitationId || 'general-plan-order');

    try {
      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount: finalAmount,
          currency: plan.currency || 'INR',
          planId: plan.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.razorpayOrderId) {
        throw new Error(data.error || 'Could not initialize server-side Razorpay order.');
      }

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
        razorpayOrderId: truncateString(data.razorpayOrderId, 120),
      };

      await setDoc(doc(db, 'orders', orderId), {
        ...newOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setPendingOrder(newOrder);
      setStep('gateway');
    } catch (err) {
      if (err instanceof Error && err.message.includes('permission')) {
        handleFirestoreError(err, OperationType.CREATE, `orders/${orderId}`);
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to initiate order.');
      }
    } finally {
      setProcessing(false);
    }
  };

  // Step 2: Authorize & Verify Payment via Server-Side HMAC-SHA256 before marking order Paid
  const handleVerifyPayment = async () => {
    if (!pendingOrder) return;
    setErrorMsg('');
    if (paymentMethod === 'upi' && !upiId.includes('@')) {
      setErrorMsg('Please enter a valid UPI ID (e.g., name@okaxis).');
      return;
    }

    setProcessing(true);
    const paymentId = sanitizeId(`pay-${Date.now()}`);

    try {
      // 1. Obtain gateway payment authorization payload
      const authRes = await fetch('/api/razorpay/authorize-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpayOrderId: pendingOrder.razorpayOrderId,
          paymentMethod,
          upiOrCardLast4: paymentMethod === 'upi' ? upiId : cardLast4,
        }),
      });
      const authData = await authRes.json();
      if (!authRes.ok || !authData.razorpayPaymentId) {
        throw new Error(authData.error || 'Payment gateway authorization failed.');
      }

      // 2. Verify cryptographic HMAC-SHA256 signature on the server
      const verifyRes = await fetch('/api/razorpay/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: pendingOrder.id,
          amount: pendingOrder.finalAmount,
          razorpayOrderId: authData.razorpayOrderId,
          razorpayPaymentId: authData.razorpayPaymentId,
          razorpaySignature: authData.razorpaySignature,
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.verified) {
        throw new Error(
          verifyData.error || 'Server-side Razorpay signature verification rejected.'
        );
      }

      // 3. Persist verified payment record to /payments/{paymentId}
      await setDoc(doc(db, 'payments', paymentId), {
        id: paymentId,
        orderId: pendingOrder.id,
        ownerId: userId,
        amount: pendingOrder.finalAmount,
        currency: pendingOrder.currency,
        razorpayPaymentId: truncateString(verifyData.razorpayPaymentId, 120),
        razorpayOrderId: truncateString(pendingOrder.razorpayOrderId, 120),
        razorpaySignature: truncateString(verifyData.razorpaySignature, 256),
        status: 'verified',
        createdAt: serverTimestamp(),
      });

      // 4. Mark order status as 'paid' ONLY after server verification and payment record succeed
      await updateDoc(doc(db, 'orders', pendingOrder.id), {
        status: 'paid',
        updatedAt: serverTimestamp(),
      });

      setVerifiedIds({
        orderId: pendingOrder.id,
        paymentId,
        invoiceNumber: verifyData.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
        razorpayPaymentId: verifyData.razorpayPaymentId,
        razorpaySignature: verifyData.razorpaySignature,
      });
      setStep('verified');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Payment signature verification failed.'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadInvoice = () => {
    if (!verifiedIds || !pendingOrder) return;
    const invoiceText = [
      '============================================================',
      'INVITORA — OFFICIAL TAX INVOICE & PAYMENT RECEIPT',
      'Create Beautiful Invitations, Share Beautiful Moments.',
      '============================================================',
      `Invoice Number     : ${verifiedIds.invoiceNumber}`,
      `Date               : ${new Date().toISOString().split('T')[0]}`,
      `Customer Account   : ${userEmail}`,
      `Order ID           : ${verifiedIds.orderId}`,
      `Payment ID         : ${verifiedIds.paymentId}`,
      `Razorpay Order     : ${pendingOrder.razorpayOrderId}`,
      `Razorpay Payment   : ${verifiedIds.razorpayPaymentId}`,
      `HMAC-SHA256 Sig    : ${verifiedIds.razorpaySignature.slice(0, 32)}...`,
      '------------------------------------------------------------',
      `Plan / Suite       : ${pendingOrder.planName}`,
      `Subtotal           : INR ${pendingOrder.amount.toLocaleString('en-IN')}`,
      `Discount (${pendingOrder.couponCode || 'NONE'}) : -INR ${pendingOrder.discountAmount.toLocaleString('en-IN')}`,
      `Total Verified Paid: INR ${pendingOrder.finalAmount.toLocaleString('en-IN')}`,
      '------------------------------------------------------------',
      'Status             : VERIFIED & PAID (Server HMAC-SHA256)',
      '============================================================',
    ].join('\n');

    const blob = new Blob([invoiceText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${verifiedIds.invoiceNumber}-${pendingOrder.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
      <div className="bg-white border border-stone-200 rounded-2xl max-w-lg w-full overflow-hidden shadow-xl">
        {/* Top Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-semibold">INVITORA · Razorpay Secure Checkout</h3>
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
                    ? 'Creating Server-Side Razorpay Order...'
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
                    Order Created (Status: Pending Server Verification)
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
                      Card Ending In
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
                  Server-side HMAC-SHA256 verification via Razorpay NetBanking for {userEmail}.
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
                      ? 'Verifying Server Signature...'
                      : `Authorize & Verify ₹${pendingOrder.finalAmount.toLocaleString('en-IN')}`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 'verified' && verifiedIds && (
            <div className="text-center py-3 space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto" />
              <h4 className="text-lg font-semibold text-stone-900">
                Payment Verified & Invoice Generated
              </h4>
              <p className="text-xs text-stone-600">
                Server-side HMAC-SHA256 signature verified. Your order is now marked as Paid.
              </p>
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl text-left text-xs font-mono-tabular text-stone-700 space-y-1">
                <div className="flex justify-between">
                  <span className="text-stone-500">Invoice:</span>
                  <span className="font-semibold text-stone-900">{verifiedIds.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Order ID:</span>
                  <span>{verifiedIds.orderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Razorpay Ref:</span>
                  <span>{verifiedIds.razorpayPaymentId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">HMAC Signature:</span>
                  <span className="truncate max-w-[180px]">{verifiedIds.razorpaySignature}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadInvoice}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-xl"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSuccess(verifiedIds.orderId, verifiedIds.paymentId)}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-xl"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Continue to Studio</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

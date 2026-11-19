import React, { useState } from 'react';
import {
  Plus,
  Edit3,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  Bookmark,
  FileText,
  Globe,
  ShoppingBag,
  CreditCard,
  User,
  Trash2,
  Download,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { QRCodeCanvas } from 'qrcode.react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase.ts';
import {
  UserProfile,
  Invitation,
  Template,
  Order,
  Payment,
  RsvpResponse,
  VALIDATION_LIMITS,
  truncateString,
} from '../types/invitation.ts';
import { HERO_IMAGE_PATH } from '../data/initialCatalog.ts';

interface CustomerDashboardProps {
  profile: UserProfile;
  invitations: Invitation[];
  templates: Template[];
  orders: Order[];
  payments: Payment[];
  rsvps: RsvpResponse[];
  onCreateNew: () => void;
  onEditInvitation: (inv: Invitation) => void;
  onViewInvitation: (slug: string) => void;
  onSelectTemplate: (tpl: Template) => void;
  onToggleSaveTemplate: (templateId: string) => Promise<void>;
  onProfileUpdated: (updated: UserProfile) => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  profile,
  invitations,
  templates,
  orders,
  payments,
  rsvps,
  onCreateNew,
  onEditInvitation,
  onViewInvitation,
  onSelectTemplate,
  onToggleSaveTemplate,
  onProfileUpdated,
}) => {
  const [activeSection, setActiveSection] = useState<
    'all' | 'drafts' | 'published' | 'saved' | 'rsvps' | 'orders' | 'payments' | 'profile'
  >('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrModalInv, setQrModalInv] = useState<Invitation | null>(null);

  // Profile form state
  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState('');
  const [profileErrMsg, setProfileErrMsg] = useState('');

  const draftInvitations = invitations.filter((i) => i.status === 'draft');
  const publishedInvitations = invitations.filter((i) => i.status === 'published');
  const savedTemplates = templates.filter((t) => profile.savedTemplateIds.includes(t.id));

  const displayedInvitations =
    activeSection === 'drafts'
      ? draftInvitations
      : activeSection === 'published'
      ? publishedInvitations
      : invitations;

  const handleCopyLink = (inv: Invitation) => {
    const url = `${window.location.origin}/?invite=${encodeURIComponent(inv.slug)}`;
    navigator.clipboard.writeText(url);
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDeleteInvitation = async (invId: string) => {
    try {
      await deleteDoc(doc(db, 'invitations', invId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `invitations/${invId}`);
    }
  };

  const handleDownloadQrModal = (inv: Invitation) => {
    const canvas = document.getElementById(`dash-qr-${inv.id}`) as HTMLCanvasElement | null;
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `${inv.slug}-qr.png`;
    a.click();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErrMsg('');
    setProfileSavedMsg('');
    if (displayName.trim().length < 1) {
      setProfileErrMsg('Full Name is required.');
      return;
    }

    setSavingProfile(true);
    const cleanName = truncateString(displayName, VALIDATION_LIMITS.NAME_MAX_LEN);
    const cleanPhone = truncateString(phone, VALIDATION_LIMITS.PHONE_MAX_LEN);

    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName: cleanName,
        phone: cleanPhone,
        savedTemplateIds: profile.savedTemplateIds,
        updatedAt: serverTimestamp(),
      });
      onProfileUpdated({
        ...profile,
        displayName: cleanName,
        phone: cleanPhone,
      });
      setProfileSavedMsg('Profile settings saved.');
      setTimeout(() => setProfileSavedMsg(''), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Top Customer Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-6 mb-8">
        <div>
          <p className="text-xs text-stone-500">Customer Workspace</p>
          <h1 className="text-3xl font-display font-semibold text-stone-900">
            Welcome, {profile.displayName}
          </h1>
          <div className="flex items-center gap-2 text-xs text-stone-500 mt-1">
            <span>{profile.email}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{invitations.length} Total Invitations</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{publishedInvitations.length} Published</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onCreateNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Invitation</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar Navigation */}
        <aside className="lg:col-span-3 space-y-1">
          {[
            { id: 'all', label: 'My Invitations', count: invitations.length, icon: FileText },
            { id: 'published', label: 'Published Websites', count: publishedInvitations.length, icon: Globe },
            { id: 'drafts', label: 'Draft Invitations', count: draftInvitations.length, icon: Edit3 },
            { id: 'saved', label: 'Saved Templates', count: savedTemplates.length, icon: Bookmark },
            { id: 'rsvps', label: 'Guest RSVPs & Wishes', count: rsvps.length, icon: Users },
            { id: 'orders', label: 'Order History', count: orders.length, icon: ShoppingBag },
            { id: 'payments', label: 'Payment History', count: payments.length, icon: CreditCard },
            { id: 'profile', label: 'Profile Settings', count: null, icon: User },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id as typeof activeSection)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium rounded-xl transition-colors ${
                  active
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.count !== null && (
                  <span
                    className={`text-[11px] font-mono-tabular ${
                      active ? 'text-stone-300' : 'text-stone-500'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Main Workspace Panel */}
        <div className="lg:col-span-9">
          {(['all', 'drafts', 'published'] as const).includes(
            activeSection as 'all' | 'drafts' | 'published'
          ) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-display font-semibold text-stone-900">
                  {activeSection === 'drafts'
                    ? 'Draft Invitations'
                    : activeSection === 'published'
                    ? 'Published Invitation Websites'
                    : 'All My Invitations'}
                </h2>
                <span className="text-xs text-stone-500 font-mono-tabular">
                  {displayedInvitations.length} items
                </span>
              </div>

              {displayedInvitations.length === 0 ? (
                <div className="bg-white border border-stone-200 rounded-xl p-10 text-center space-y-3">
                  <FileText className="w-8 h-8 text-stone-400 mx-auto" />
                  <h3 className="text-base font-semibold text-stone-900">
                    No Invitations in This View Yet
                  </h3>
                  <p className="text-xs text-stone-500 max-w-md mx-auto">
                    Select any template from our 13 occasion categories to customize and publish your
                    personalized invitation website.
                  </p>
                  <button
                    type="button"
                    onClick={onCreateNew}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Browse Templates & Create</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {displayedInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col"
                    >
                      <div className="aspect-[16/9] bg-stone-100 relative overflow-hidden">
                        <img
                          src={inv.coverPhotoUrl || HERO_IMAGE_PATH}
                          alt={inv.eventTitle}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = HERO_IMAGE_PATH;
                          }}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                        <div className="absolute bottom-3 left-4 right-4 text-white">
                          <div className="flex items-center gap-2 text-[11px] text-stone-200">
                            <span className="capitalize font-semibold">{inv.status}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular">{inv.eventDate}</span>
                          </div>
                          <h3 className="text-lg font-display font-semibold truncate">
                            {inv.eventTitle}
                          </h3>
                        </div>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-1">
                          <p className="text-xs font-mono-tabular text-stone-600 truncate">
                            invitationstudio.com/invite/{inv.slug}
                          </p>
                          <p className="text-xs text-stone-500 truncate">
                            {inv.venueName} · Hosted by {inv.hostName}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100">
                          <button
                            type="button"
                            onClick={() => onEditInvitation(inv)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onViewInvitation(inv.slug)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>View Live</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyLink(inv)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 border border-stone-200 hover:bg-stone-50 rounded-lg"
                          >
                            {copiedId === inv.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-700" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedId === inv.id ? 'Copied' : 'Copy Link'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setQrModalInv(inv)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-700 border border-stone-200 hover:bg-stone-50 rounded-lg"
                            title="Download QR Code"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>QR</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteInvitation(inv.id)}
                            className="ml-auto p-1.5 text-stone-400 hover:text-red-700 transition-colors"
                            title="Delete Invitation"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSection === 'saved' && (
            <div className="space-y-4">
              <h2 className="text-xl font-display font-semibold text-stone-900">
                Saved Templates ({savedTemplates.length})
              </h2>
              {savedTemplates.length === 0 ? (
                <div className="bg-white border border-stone-200 rounded-xl p-10 text-center space-y-3">
                  <Bookmark className="w-8 h-8 text-stone-400 mx-auto" />
                  <p className="text-xs text-stone-500">
                    You have not bookmarked any templates yet. Browse the template gallery to save
                    favorites.
                  </p>
                  <button
                    type="button"
                    onClick={onCreateNew}
                    className="px-4 py-2 text-xs font-medium text-white bg-stone-900 rounded-lg"
                  >
                    Explore Template Gallery
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {savedTemplates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col"
                    >
                      <div className="aspect-[4/3] bg-stone-100 overflow-hidden">
                        <img
                          src={tpl.previewImage || HERO_IMAGE_PATH}
                          alt={tpl.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2 text-xs text-stone-500">
                          <span>{tpl.categoryName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            {tpl.price === 0 ? 'Free' : `₹${tpl.price}`}
                          </span>
                        </div>
                        <h3 className="text-base font-semibold text-stone-900">{tpl.title}</h3>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectTemplate(tpl)}
                            className="flex-1 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg"
                          >
                            Customize Template
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleSaveTemplate(tpl.id)}
                            className="px-3 py-2 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSection === 'rsvps' && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                <h2 className="text-base font-semibold text-stone-900">
                  Guest RSVP & Wish Responses
                </h2>
                <span className="text-xs font-mono-tabular text-stone-500">
                  {rsvps.length} Total Responses
                </span>
              </div>
              {rsvps.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-500">
                  No RSVP responses received yet. Share your published invitation link to collect guest
                  confirmations.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
                        <th className="py-2.5 px-4 font-medium">Guest Name</th>
                        <th className="py-2.5 px-4 font-medium">Attendance</th>
                        <th className="py-2.5 px-4 font-medium text-right">Guests</th>
                        <th className="py-2.5 px-4 font-medium">Dietary Notes</th>
                        <th className="py-2.5 px-4 font-medium">Wish Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {rsvps.map((r) => (
                        <tr key={r.id} className="hover:bg-stone-50">
                          <td className="py-3 px-4 font-medium text-stone-900">{r.guestName}</td>
                          <td className="py-3 px-4 capitalize text-stone-700">{r.attending}</td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-stone-900">
                            {r.guestsCount}
                          </td>
                          <td className="py-3 px-4 text-stone-600">{r.dietaryNotes || '—'}</td>
                          <td className="py-3 px-4 text-stone-600 max-w-xs truncate">
                            {r.wishMessage || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeSection === 'orders' && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                <h2 className="text-base font-semibold text-stone-900">Order History</h2>
                <span className="text-xs font-mono-tabular text-stone-500">
                  {orders.length} Orders
                </span>
              </div>
              {orders.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-500">
                  No plan or template orders placed yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
                        <th className="py-2.5 px-4 font-medium">Order ID</th>
                        <th className="py-2.5 px-4 font-medium">Plan</th>
                        <th className="py-2.5 px-4 font-medium">Razorpay Order</th>
                        <th className="py-2.5 px-4 font-medium text-right">Final Amount</th>
                        <th className="py-2.5 px-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {orders.map((o) => (
                        <tr key={o.id} className="hover:bg-stone-50">
                          <td className="py-3 px-4 font-mono-tabular text-stone-800">{o.id}</td>
                          <td className="py-3 px-4 font-medium text-stone-900">{o.planName}</td>
                          <td className="py-3 px-4 font-mono-tabular text-stone-500">
                            {o.razorpayOrderId}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-stone-900">
                            ₹{o.finalAmount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 capitalize font-medium text-stone-800">
                            {o.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeSection === 'payments' && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                <h2 className="text-base font-semibold text-stone-900">
                  Verified Payment Transactions
                </h2>
                <span className="text-xs font-mono-tabular text-stone-500">
                  {payments.length} Payments
                </span>
              </div>
              {payments.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-500">
                  No payment transactions recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
                        <th className="py-2.5 px-4 font-medium">Payment ID</th>
                        <th className="py-2.5 px-4 font-medium">Order ID</th>
                        <th className="py-2.5 px-4 font-medium">Razorpay Payment ID</th>
                        <th className="py-2.5 px-4 font-medium text-right">Amount</th>
                        <th className="py-2.5 px-4 font-medium">Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {payments.map((p) => (
                        <tr key={p.id} className="hover:bg-stone-50">
                          <td className="py-3 px-4 font-mono-tabular text-stone-800">{p.id}</td>
                          <td className="py-3 px-4 font-mono-tabular text-stone-600">
                            {p.orderId}
                          </td>
                          <td className="py-3 px-4 font-mono-tabular text-stone-600">
                            {p.razorpayPaymentId}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-stone-900">
                            ₹{p.amount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-emerald-800 font-medium inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="capitalize">{p.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeSection === 'profile' && (
            <div className="bg-white border border-stone-200 rounded-xl p-6 max-w-xl">
              <h2 className="text-xl font-display font-semibold text-stone-900 mb-1">
                Profile & Host Details
              </h2>
              <p className="text-xs text-stone-500 mb-6">
                Your profile information is private and isolated by Firestore security rules.
              </p>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                {profileErrMsg && (
                  <div className="p-3 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg">
                    {profileErrMsg}
                  </div>
                )}
                {profileSavedMsg && (
                  <div className="p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
                    {profileSavedMsg}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Verified Account Email
                  </label>
                  <input
                    type="email"
                    disabled
                    value={profile.email}
                    className="w-full px-3.5 py-2 text-sm bg-stone-100 border border-stone-200 rounded-lg text-stone-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Full Name / Host Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={VALIDATION_LIMITS.NAME_MAX_LEN}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-stone-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    WhatsApp / Phone Number
                  </label>
                  <input
                    type="text"
                    maxLength={VALIDATION_LIMITS.PHONE_MAX_LEN}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98300 45120"
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular bg-white border border-stone-200 rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2.5 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingProfile ? 'Saving Changes...' : 'Update Profile Settings'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* QR Code Download Modal */}
      {qrModalInv && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-sm w-full p-6 text-center space-y-4">
            <h3 className="text-base font-semibold text-stone-900">{qrModalInv.eventTitle}</h3>
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl inline-block">
              <QRCodeCanvas
                id={`dash-qr-${qrModalInv.id}`}
                value={`${window.location.origin}/?invite=${encodeURIComponent(qrModalInv.slug)}`}
                size={168}
                bgColor="#ffffff"
                fgColor="#1c1917"
                includeMargin={true}
              />
            </div>
            <p className="text-xs font-mono-tabular text-stone-600">
              invitationstudio.com/invite/{qrModalInv.slug}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownloadQrModal(qrModalInv)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PNG</span>
              </button>
              <button
                type="button"
                onClick={() => setQrModalInv(null)}
                className="px-4 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

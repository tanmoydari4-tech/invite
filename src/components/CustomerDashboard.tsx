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
  Search,
  BarChart3,
  Bell,
  Layers,
} from 'lucide-react';
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
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
  sanitizeId,
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
    | 'overview'
    | 'all'
    | 'drafts'
    | 'published'
    | 'saved'
    | 'rsvps'
    | 'orders'
    | 'payments'
    | 'notifications'
    | 'profile'
  >('overview');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrModalInv, setQrModalInv] = useState<Invitation | null>(null);
  const [actionFeedback, setActionFeedback] = useState('');

  // RSVP Filter & Search State
  const [rsvpSearch, setRsvpSearch] = useState('');
  const [rsvpFilterAttending, setRsvpFilterAttending] = useState<'all' | 'yes' | 'no' | 'maybe'>(
    'all'
  );

  // Profile form state
  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState('');
  const [profileErrMsg, setProfileErrMsg] = useState('');

  const draftInvitations = invitations.filter((i) => i.status === 'draft');
  const publishedInvitations = invitations.filter((i) => i.status === 'published');
  const savedTemplates = templates.filter((t) => profile.savedTemplateIds.includes(t.id));
  const paidOrders = orders.filter((o) => o.status === 'paid');

  const totalConfirmedGuests = rsvps
    .filter((r) => r.attending === 'yes')
    .reduce((sum, r) => sum + (Number(r.guestsCount) || 1), 0);

  const displayedInvitations =
    activeSection === 'drafts'
      ? draftInvitations
      : activeSection === 'published'
      ? publishedInvitations
      : invitations;

  const filteredRsvps = rsvps.filter((r) => {
    const matchesStatus = rsvpFilterAttending === 'all' || r.attending === rsvpFilterAttending;
    const matchesQuery =
      !rsvpSearch.trim() ||
      r.guestName.toLowerCase().includes(rsvpSearch.toLowerCase()) ||
      r.dietaryNotes.toLowerCase().includes(rsvpSearch.toLowerCase()) ||
      r.wishMessage.toLowerCase().includes(rsvpSearch.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  const notifyAction = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(''), 3000);
  };

  const handleCopyLink = (inv: Invitation) => {
    const url = `${window.location.origin}/?invite=${encodeURIComponent(inv.slug)}`;
    navigator.clipboard.writeText(url);
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleTogglePublishStatus = async (inv: Invitation) => {
    const nextStatus = inv.status === 'published' ? 'draft' : 'published';
    try {
      await updateDoc(doc(db, 'invitations', inv.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      notifyAction(
        nextStatus === 'published'
          ? `Published "${inv.eventTitle}" live.`
          : `Unpublished "${inv.eventTitle}" to Drafts.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `invitations/${inv.id}`);
    }
  };

  const handleDuplicateInvitation = async (inv: Invitation) => {
    const newId = sanitizeId(`inv-copy-${Date.now()}`);
    const newSlug = sanitizeId(`${inv.slug}-copy-${Date.now().toString().slice(-3)}`);
    try {
      await setDoc(doc(db, 'invitations', newId), {
        ...inv,
        id: newId,
        slug: newSlug,
        eventTitle: truncateString(`${inv.eventTitle} (Copy)`, VALIDATION_LIMITS.TITLE_MAX_LEN),
        status: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      notifyAction(`Duplicated "${inv.eventTitle}" into your Drafts.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `invitations/${newId}`);
    }
  };

  const handleDeleteInvitation = async (invId: string) => {
    try {
      await deleteDoc(doc(db, 'invitations', invId));
      notifyAction('Invitation website deleted.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `invitations/${invId}`);
    }
  };

  const handleExportRsvpCsv = () => {
    const headers = ['Guest Name', 'Attendance', 'Guest Count', 'Dietary Notes', 'Wish Message', 'Invitation ID'];
    const rows = filteredRsvps.map((r) => [
      `"${(r.guestName || '').replace(/"/g, '""')}"`,
      r.attending,
      String(r.guestsCount),
      `"${(r.dietaryNotes || '').replace(/"/g, '""')}"`,
      `"${(r.wishMessage || '').replace(/"/g, '""')}"`,
      r.invitationId,
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invitora-guest-rsvps-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  // In-app activity notifications derived from real user records
  const activityNotifications = [
    ...publishedInvitations.map((inv) => ({
      id: `notif-pub-${inv.id}`,
      title: `Invitation Published: ${inv.eventTitle}`,
      detail: `Public URL active at invitora.com/invite/${inv.slug}`,
      badge: 'Published',
    })),
    ...rsvps.map((r) => ({
      id: `notif-rsvp-${r.id}`,
      title: `New Guest RSVP from ${r.guestName}`,
      detail: `Attending: ${r.attending.toUpperCase()} (${r.guestsCount} guests) ${
        r.dietaryNotes ? `· ${r.dietaryNotes}` : ''
      }`,
      badge: 'RSVP',
    })),
    ...payments.map((p) => ({
      id: `notif-pay-${p.id}`,
      title: `Razorpay Payment Verified (₹${p.amount.toLocaleString('en-IN')})`,
      detail: `Ref: ${p.razorpayPaymentId} · Order: ${p.orderId}`,
      badge: 'Payment',
    })),
    {
      id: 'notif-welcome',
      title: 'Welcome to INVITORA — Invitation Studio',
      detail: `Account active for ${profile.email}. Select any template to launch the visual builder.`,
      badge: 'Account',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Top Customer Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-6 mb-8">
        <div>
          <p className="text-xs text-stone-500">INVITORA · Customer Studio Workspace</p>
          <h1 className="text-3xl font-display font-semibold text-stone-900">
            Welcome, {profile.displayName}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 mt-1">
            <span>{profile.email}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{invitations.length} Total Invitations</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{publishedInvitations.length} Published</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{totalConfirmedGuests} Confirmed Guests</span>
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

      {actionFeedback && (
        <div className="mb-6 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar Navigation */}
        <aside className="lg:col-span-3 space-y-1">
          {[
            { id: 'overview', label: 'Overview & Analytics', count: null, icon: BarChart3 },
            { id: 'all', label: 'My Websites', count: invitations.length, icon: FileText },
            {
              id: 'published',
              label: 'Published Websites',
              count: publishedInvitations.length,
              icon: Globe,
            },
            { id: 'drafts', label: 'Draft Invitations', count: draftInvitations.length, icon: Edit3 },
            { id: 'saved', label: 'Saved Designs', count: savedTemplates.length, icon: Bookmark },
            { id: 'rsvps', label: 'RSVP & Guest List', count: rsvps.length, icon: Users },
            { id: 'orders', label: 'Orders & Subscription', count: orders.length, icon: ShoppingBag },
            { id: 'payments', label: 'Billing & Invoices', count: payments.length, icon: CreditCard },
            {
              id: 'notifications',
              label: 'Notifications',
              count: activityNotifications.length,
              icon: Bell,
            },
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
                  active ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100'
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
        <div className="lg:col-span-9 space-y-6">
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: 'Total Invitations',
                    value: invitations.length,
                    sub: `${publishedInvitations.length} live · ${draftInvitations.length} drafts`,
                  },
                  {
                    label: 'Total RSVP Responses',
                    value: rsvps.length,
                    sub: `${totalConfirmedGuests} confirmed attending guests`,
                  },
                  {
                    label: 'Saved Templates',
                    value: savedTemplates.length,
                    sub: 'Bookmarked in your studio',
                  },
                  {
                    label: 'Active Subscription',
                    value: paidOrders.length > 0 ? paidOrders[0].planName : 'Free Studio Plan',
                    sub: paidOrders.length > 0 ? '365 days remaining · Active' : 'Upgrade anytime',
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-white border border-stone-200 rounded-xl p-5 space-y-1"
                  >
                    <p className="text-xs text-stone-500">{stat.label}</p>
                    <p className="text-xl font-semibold font-mono-tabular text-stone-900 truncate">
                      {stat.value}
                    </p>
                    <p className="text-[11px] text-stone-500">{stat.sub}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-stone-900">
                    Recent Invitation Websites
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveSection('all')}
                    className="text-xs font-medium text-stone-700 hover:underline"
                  >
                    View All ({invitations.length}) →
                  </button>
                </div>

                {invitations.length === 0 ? (
                  <div className="p-8 bg-stone-50 border border-stone-200 rounded-xl text-center space-y-3">
                    <p className="text-xs text-stone-600">
                      You haven't created an invitation website yet. Choose a template to start
                      customizing.
                    </p>
                    <button
                      type="button"
                      onClick={onCreateNew}
                      className="px-4 py-2 text-xs font-medium text-white bg-stone-900 rounded-lg"
                    >
                      Explore Templates
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {invitations.slice(0, 4).map((inv) => {
                      const invRsvps = rsvps.filter((r) => r.invitationId === inv.id);
                      return (
                        <div
                          key={inv.id}
                          className="p-4 bg-stone-50 border border-stone-200 rounded-xl flex flex-col justify-between space-y-3"
                        >
                          <div>
                            <div className="flex items-center justify-between text-xs text-stone-500">
                              <span className="capitalize font-semibold text-stone-800">
                                {inv.status}
                              </span>
                              <span className="font-mono-tabular">
                                {invRsvps.length} RSVPs · {inv.eventDate}
                              </span>
                            </div>
                            <h3 className="text-base font-display font-semibold text-stone-900 mt-1">
                              {inv.eventTitle}
                            </h3>
                            <p className="text-xs font-mono-tabular text-stone-500 truncate">
                              invitora.com/invite/{inv.slug}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 pt-2 border-t border-stone-200/70">
                            <button
                              type="button"
                              onClick={() => onEditInvitation(inv)}
                              className="px-3 py-1.5 text-xs font-medium text-stone-800 bg-white border border-stone-200 rounded-lg"
                            >
                              Edit in Builder
                            </button>
                            <button
                              type="button"
                              onClick={() => onViewInvitation(inv.slug)}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-stone-900 rounded-lg"
                            >
                              Open Live
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

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
                    : 'All My Invitation Websites'}
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
                    Select any template from our occasion categories to customize and publish your
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
                  {displayedInvitations.map((inv) => {
                    const invRsvpCount = rsvps.filter((r) => r.invitationId === inv.id).length;
                    return (
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
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-tabular">{invRsvpCount} RSVPs</span>
                            </div>
                            <h3 className="text-lg font-display font-semibold truncate">
                              {inv.eventTitle}
                            </h3>
                          </div>
                        </div>

                        <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                          <div className="space-y-1">
                            <p className="text-xs font-mono-tabular text-stone-600 truncate">
                              invitora.com/invite/{inv.slug}
                            </p>
                            <p className="text-xs text-stone-500 truncate">
                              {inv.venueName} · Hosted by {inv.hostName}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-stone-100">
                            <button
                              type="button"
                              onClick={() => onEditInvitation(inv)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onViewInvitation(inv.slug)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleTogglePublishStatus(inv)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-700 border border-stone-200 hover:bg-stone-50 rounded-lg"
                            >
                              <Globe className="w-3.5 h-3.5" />
                              <span>{inv.status === 'published' ? 'Unpublish' : 'Publish'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDuplicateInvitation(inv)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-700 border border-stone-200 hover:bg-stone-50 rounded-lg"
                              title="Duplicate Invitation"
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>Duplicate</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopyLink(inv)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-700 border border-stone-200 hover:bg-stone-50 rounded-lg"
                            >
                              {copiedId === inv.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-700" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>{copiedId === inv.id ? 'Copied' : 'URL'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setQrModalInv(inv)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-stone-700 border border-stone-200 hover:bg-stone-50 rounded-lg"
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
                    );
                  })}
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
            <div className="space-y-4">
              {/* RSVP Statistics Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-stone-200 rounded-xl p-4">
                  <p className="text-xs text-stone-500">Joyfully Attending</p>
                  <p className="text-2xl font-semibold font-mono-tabular text-emerald-800">
                    {rsvps.filter((r) => r.attending === 'yes').length} responses (
                    {totalConfirmedGuests} guests)
                  </p>
                </div>
                <div className="bg-white border border-stone-200 rounded-xl p-4">
                  <p className="text-xs text-stone-500">Tentative / Maybe</p>
                  <p className="text-2xl font-semibold font-mono-tabular text-amber-800">
                    {rsvps.filter((r) => r.attending === 'maybe').length} responses
                  </p>
                </div>
                <div className="bg-white border border-stone-200 rounded-xl p-4">
                  <p className="text-xs text-stone-500">Unable to Attend</p>
                  <p className="text-2xl font-semibold font-mono-tabular text-stone-700">
                    {rsvps.filter((r) => r.attending === 'no').length} responses
                  </p>
                </div>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-stone-900">
                      Guest RSVP & Wish Responses
                    </h2>
                    <p className="text-xs text-stone-500">
                      Filter guests by attendance status, search dietary preferences, or export CSV.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-48">
                      <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={rsvpSearch}
                        onChange={(e) => setRsvpSearch(e.target.value)}
                        placeholder="Search guest or diet..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg"
                      />
                    </div>
                    <select
                      value={rsvpFilterAttending}
                      onChange={(e) =>
                        setRsvpFilterAttending(e.target.value as 'all' | 'yes' | 'no' | 'maybe')
                      }
                      className="px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg"
                    >
                      <option value="all">All Statuses</option>
                      <option value="yes">Attending</option>
                      <option value="maybe">Tentative</option>
                      <option value="no">Not Attending</option>
                    </select>
                    <button
                      type="button"
                      disabled={filteredRsvps.length === 0}
                      onClick={handleExportRsvpCsv}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg disabled:opacity-40"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                {filteredRsvps.length === 0 ? (
                  <div className="p-8 text-center text-xs text-stone-500">
                    No RSVP responses match your current filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
                          <th className="py-2.5 px-4 font-medium">Guest Name</th>
                          <th className="py-2.5 px-4 font-medium">Attendance</th>
                          <th className="py-2.5 px-4 font-medium text-right">Guests</th>
                          <th className="py-2.5 px-4 font-medium">Dietary & Event Notes</th>
                          <th className="py-2.5 px-4 font-medium">Wish Message</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200">
                        {filteredRsvps.map((r) => (
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
            </div>
          )}

          {activeSection === 'orders' && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                <h2 className="text-base font-semibold text-stone-900">
                  Order & Subscription History
                </h2>
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
                  Verified Payment Transactions & Invoices
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

          {activeSection === 'notifications' && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                <h2 className="text-base font-semibold text-stone-900">
                  In-App Studio Notifications
                </h2>
                <span className="text-xs font-mono-tabular text-stone-500">
                  {activityNotifications.length} Alerts
                </span>
              </div>
              <div className="divide-y divide-stone-200">
                {activityNotifications.map((n) => (
                  <div key={n.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-stone-900">{n.title}</p>
                      <p className="text-xs text-stone-600">{n.detail}</p>
                    </div>
                    <span className="text-[11px] font-mono-tabular text-stone-500 shrink-0">
                      {n.badge}
                    </span>
                  </div>
                ))}
              </div>
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
              invitora.com/invite/{qrModalInv.slug}
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

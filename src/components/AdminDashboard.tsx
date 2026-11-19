import React, { useState } from 'react';
import {
  BarChart3,
  LayoutGrid,
  FolderKanban,
  Users,
  ShoppingBag,
  CreditCard,
  Tag,
  MessageSquareQuote,
  Megaphone,
  Mail,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  RefreshCw,
  CalendarCheck,
} from 'lucide-react';
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase.ts';
import {
  Category,
  Template,
  Invitation,
  UserProfile,
  Order,
  Payment,
  SubscriptionPlan,
  Coupon,
  Testimonial,
  HomepageBanner,
  ContactMessage,
  RsvpResponse,
  sanitizeId,
  truncateString,
} from '../types/invitation.ts';
import {
  HERO_IMAGE_PATH,
  IMG_ROYAL_WEDDING,
  IMG_BIRTHDAY_GALA,
  IMG_TRADITIONAL,
  IMG_CORPORATE,
} from '../data/initialCatalog.ts';

interface AdminDashboardProps {
  categories: Category[];
  templates: Template[];
  invitations: Invitation[];
  customers: UserProfile[];
  orders: Order[];
  payments: Payment[];
  plans: SubscriptionPlan[];
  coupons: Coupon[];
  testimonials: Testimonial[];
  banner: HomepageBanner;
  contactMessages: ContactMessage[];
  allRsvps: RsvpResponse[];
  onSeedCatalog: () => Promise<void>;
  seeding: boolean;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  categories,
  templates,
  invitations,
  customers,
  orders,
  payments,
  plans,
  coupons,
  testimonials,
  banner,
  contactMessages,
  allRsvps,
  onSeedCatalog,
  seeding,
}) => {
  const [activeTab, setActiveTab] = useState<
    | 'analytics'
    | 'templates'
    | 'categories'
    | 'customers'
    | 'orders'
    | 'payments'
    | 'plans'
    | 'coupons'
    | 'testimonials'
    | 'banners'
    | 'messages'
    | 'rsvps'
  >('analytics');

  const [statusNotice, setStatusNotice] = useState('');

  // Template Form State
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [tplTitle, setTplTitle] = useState('');
  const [tplCategoryId, setTplCategoryId] = useState(categories[0]?.id || 'cat-wedding');
  const [tplTier, setTplTier] = useState<'free' | 'basic' | 'premium'>('premium');
  const [tplPrice, setTplPrice] = useState(1499);
  const [tplAccent, setTplAccent] = useState('#92400e');
  const [tplThemeStyle, setTplThemeStyle] = useState('Royal Editorial');
  const [tplImage, setTplImage] = useState(IMG_ROYAL_WEDDING);
  const [tplDesc, setTplDesc] = useState('');
  const [tplFeatured, setTplFeatured] = useState(true);
  const [tplPopular, setTplPopular] = useState(true);

  // Category Form State
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catOrder, setCatOrder] = useState(categories.length + 1);

  // Plan Edit State
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planPriceInput, setPlanPriceInput] = useState(799);
  const [planDescInput, setPlanDescInput] = useState('');
  const [planFeaturesInput, setPlanFeaturesInput] = useState('');

  // Coupon Form State
  const [cpnCode, setCpnCode] = useState('');
  const [cpnPercent, setCpnPercent] = useState(25);
  const [cpnMaxDiscount, setCpnMaxDiscount] = useState(750);
  const [cpnExpiry, setCpnExpiry] = useState('2027-12-31');

  // Testimonial Form State
  const [testName, setTestName] = useState('');
  const [testRole, setTestRole] = useState('');
  const [testOccasion, setTestOccasion] = useState('Wedding Invitation');
  const [testQuote, setTestQuote] = useState('');
  const [testMetric, setTestMetric] = useState('');

  // Banner / Website Settings Form State
  const [bnHeadline, setBnHeadline] = useState(banner.headline);
  const [bnSubheadline, setBnSubheadline] = useState(banner.subheadline);
  const [bnCta, setBnCta] = useState(banner.ctaText);
  const [bnPromo, setBnPromo] = useState(banner.promoText);
  const [bnEmail, setBnEmail] = useState(banner.supportEmail);
  const [bnPhone, setBnPhone] = useState(banner.supportPhone);
  const [bnRazorpayKey, setBnRazorpayKey] = useState(banner.razorpayKeyId);

  const notify = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(''), 3500);
  };

  // Real calculated analytics metrics
  const publishedCount = invitations.filter((i) => i.status === 'published').length;
  const paidOrders = orders.filter((o) => o.status === 'paid');
  const totalRevenue = payments
    .filter((p) => p.status === 'verified')
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  // Save or Update Template
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tplTitle.trim().length < 2) return;
    const id = editingTemplateId || sanitizeId(`tpl-${tplTitle}-${Date.now().toString().slice(-4)}`);
    const slug = sanitizeId(tplTitle);
    const catObj = categories.find((c) => c.id === tplCategoryId) || categories[0];

    const payload = {
      id,
      title: truncateString(tplTitle, 100),
      slug: slug.length >= 2 ? slug : `template-${id}`,
      categoryId: catObj ? catObj.id : 'cat-wedding',
      categoryName: truncateString(catObj ? catObj.name : 'Wedding Invitation', 80),
      tier: tplTier,
      price: tplTier === 'free' ? 0 : Math.max(0, Number(tplPrice) || 0),
      accentColor: truncateString(tplAccent || '#92400e', 30),
      themeStyle: truncateString(tplThemeStyle || 'Editorial Luxury', 40),
      previewImage: truncateString(tplImage || HERO_IMAGE_PATH, 500),
      description: truncateString(
        tplDesc || 'Bespoke digital invitation layout with live RSVP and Google Maps.',
        400
      ),
      isFeatured: Boolean(tplFeatured),
      isPopular: Boolean(tplPopular),
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingTemplateId) {
        const existing = templates.find((t) => t.id === editingTemplateId);
        await setDoc(doc(db, 'templates', id), {
          ...payload,
          createdAt: existing?.createdAt || serverTimestamp(),
        });
        notify('Template updated in Firestore.');
      } else {
        await setDoc(doc(db, 'templates', id), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        notify('New template published to marketplace.');
      }
      setEditingTemplateId(null);
      setTplTitle('');
      setTplDesc('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `templates/${id}`);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'templates', id));
      notify('Template deleted.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `templates/${id}`);
    }
  };

  // Save Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (catName.trim().length < 2) return;
    const id = sanitizeId(`cat-${catName}`);
    const slug = sanitizeId(catName);
    try {
      await setDoc(doc(db, 'categories', id), {
        id,
        name: truncateString(catName, 80),
        slug: slug.length >= 2 ? slug : `category-${id}`,
        description: truncateString(
          catDesc || `Personalized invitation websites for ${catName}.`,
          300
        ),
        displayOrder: Number(catOrder) || categories.length + 1,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCatName('');
      setCatDesc('');
      notify('Category saved.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `categories/${id}`);
    }
  };

  // Update Plan
  const handleUpdatePlan = async (plan: SubscriptionPlan) => {
    const featuresList = planFeaturesInput
      .split('\n')
      .map((s) => truncateString(s, 150))
      .filter(Boolean)
      .slice(0, 15);

    try {
      await updateDoc(doc(db, 'plans', plan.id), {
        price: Math.max(0, Number(planPriceInput) || 0),
        description: truncateString(planDescInput || plan.description, 250),
        features: featuresList.length > 0 ? featuresList : plan.features,
        updatedAt: serverTimestamp(),
      });
      setEditingPlanId(null);
      notify(`Updated ${plan.name} pricing and features.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `plans/${plan.id}`);
    }
  };

  // Add Coupon
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = sanitizeId(cpnCode).toUpperCase();
    if (cleanCode.length < 3) return;
    const id = sanitizeId(`cpn-${cleanCode.toLowerCase()}`);

    try {
      await setDoc(doc(db, 'coupons', id), {
        id,
        code: truncateString(cleanCode, 30),
        discountPercent: Math.min(100, Math.max(1, Number(cpnPercent) || 10)),
        maxDiscountAmount: Math.max(0, Number(cpnMaxDiscount) || 500),
        isActive: true,
        expiryDate: truncateString(cpnExpiry || '2027-12-31', 40),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCpnCode('');
      notify(`Coupon ${cleanCode} created.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `coupons/${id}`);
    }
  };

  // Add Testimonial
  const handleCreateTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (testName.trim().length < 2 || testQuote.trim().length < 10) return;
    const id = sanitizeId(`test-${Date.now()}`);
    try {
      await setDoc(doc(db, 'testimonials', id), {
        id,
        customerName: truncateString(testName, 80),
        customerRole: truncateString(testRole || 'Verified Host', 100),
        occasion: truncateString(testOccasion, 80),
        quote: truncateString(testQuote, 500),
        outcomeMetric: truncateString(testMetric || '100% digital RSVP confirmation', 120),
        rating: 5,
        isApproved: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTestName('');
      setTestRole('');
      setTestQuote('');
      setTestMetric('');
      notify('Testimonial added.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `testimonials/${id}`);
    }
  };

  // Save Homepage Banner & Settings
  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = sanitizeId(banner.id || 'main-homepage-banner');
    try {
      await setDoc(doc(db, 'banners', id), {
        id,
        headline: truncateString(bnHeadline, 160),
        subheadline: truncateString(bnSubheadline, 350),
        ctaText: truncateString(bnCta, 60),
        promoText: truncateString(bnPromo, 140),
        supportEmail: truncateString(bnEmail, 254),
        supportPhone: truncateString(bnPhone, 40),
        razorpayKeyId: truncateString(bnRazorpayKey, 120),
        isActive: true,
        updatedAt: serverTimestamp(),
      });
      notify('Homepage banner and website settings updated.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `banners/${id}`);
    }
  };

  // Resolve Contact Message
  const handleResolveMessage = async (msg: ContactMessage) => {
    try {
      await updateDoc(doc(db, 'contact_messages', msg.id), {
        status: 'resolved',
        updatedAt: serverTimestamp(),
      });
      notify('Inquiry marked as resolved.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `contact_messages/${msg.id}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Admin Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-6 mb-8">
        <div>
          <p className="text-xs text-stone-500">Platform Administration Console</p>
          <h1 className="text-3xl font-display font-semibold text-stone-900">
            Invitation Studio Admin Panel
          </h1>
          <div className="flex items-center gap-2 text-xs text-stone-500 mt-1">
            <span>Server-Verified Firestore Rules Active</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{categories.length} Categories</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{templates.length} Templates</span>
          </div>
        </div>

        <button
          type="button"
          disabled={seeding}
          onClick={onSeedCatalog}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
          <span>{seeding ? 'Syncing Catalog...' : 'Sync Default Catalog to Firestore'}</span>
        </button>
      </div>

      {statusNotice && (
        <div className="mb-6 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar Navigation */}
        <aside className="lg:col-span-3 space-y-1">
          {[
            { id: 'analytics', label: 'Dashboard Analytics', icon: BarChart3 },
            { id: 'templates', label: 'Manage Templates', icon: LayoutGrid },
            { id: 'categories', label: 'Manage Categories', icon: FolderKanban },
            { id: 'customers', label: 'Manage Customers', icon: Users },
            { id: 'orders', label: 'Manage Orders', icon: ShoppingBag },
            { id: 'payments', label: 'Manage Payments', icon: CreditCard },
            { id: 'plans', label: 'Pricing Plans', icon: Tag },
            { id: 'coupons', label: 'Manage Coupons', icon: Tag },
            { id: 'testimonials', label: 'Testimonials', icon: MessageSquareQuote },
            { id: 'banners', label: 'Banners & Settings', icon: Megaphone },
            { id: 'messages', label: 'Contact Messages', icon: Mail },
            { id: 'rsvps', label: 'All RSVP Responses', icon: CalendarCheck },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id as typeof activeTab)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium rounded-xl transition-colors ${
                  active ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Main Content Viewport */}
        <div className="lg:col-span-9 space-y-6">
          {activeTab === 'analytics' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: 'Total Customers', value: customers.length, sub: 'Registered host accounts' },
                  { label: 'Total Invitations', value: invitations.length, sub: 'Drafts & published websites' },
                  { label: 'Published Websites', value: publishedCount, sub: 'Live public invitation URLs' },
                  { label: 'Total Orders', value: orders.length, sub: `${paidOrders.length} verified paid orders` },
                  {
                    label: 'Total Verified Revenue',
                    value: `₹${totalRevenue.toLocaleString('en-IN')}`,
                    sub: 'From verified Razorpay payments',
                  },
                  { label: 'Guest RSVPs Collected', value: allRsvps.length, sub: 'Across all published events' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-white border border-stone-200 rounded-xl p-5 space-y-1"
                  >
                    <p className="text-xs text-stone-500">{stat.label}</p>
                    <p className="text-2xl font-semibold font-mono-tabular text-stone-900">
                      {stat.value}
                    </p>
                    <p className="text-[11px] text-stone-500">{stat.sub}</p>
                  </div>
                ))}
              </div>

              {/* Recent Invitations Table */}
              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-stone-900">
                    Recent Customer Invitation Websites
                  </h2>
                  <span className="text-xs font-mono-tabular text-stone-500">
                    {invitations.length} Total
                  </span>
                </div>
                {invitations.length === 0 ? (
                  <div className="p-8 text-center text-xs text-stone-500">
                    No customer invitations created yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
                          <th className="py-2.5 px-4 font-medium">Event Title</th>
                          <th className="py-2.5 px-4 font-medium">Host</th>
                          <th className="py-2.5 px-4 font-medium">Slug</th>
                          <th className="py-2.5 px-4 font-medium">Date</th>
                          <th className="py-2.5 px-4 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200">
                        {invitations.slice(0, 10).map((inv) => (
                          <tr key={inv.id} className="hover:bg-stone-50">
                            <td className="py-3 px-4 font-medium text-stone-900">
                              {inv.eventTitle}
                            </td>
                            <td className="py-3 px-4 text-stone-600">{inv.hostName}</td>
                            <td className="py-3 px-4 font-mono-tabular text-stone-600">
                              /invite/{inv.slug}
                            </td>
                            <td className="py-3 px-4 font-mono-tabular text-stone-600">
                              {inv.eventDate}
                            </td>
                            <td className="py-3 px-4 capitalize font-medium text-stone-800">
                              {inv.status}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-6">
              {/* Add / Edit Template Form */}
              <form
                onSubmit={handleSaveTemplate}
                className="bg-white border border-stone-200 rounded-xl p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-stone-900">
                    {editingTemplateId ? 'Edit Invitation Template' : 'Add New Invitation Template'}
                  </h2>
                  {editingTemplateId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTemplateId(null);
                        setTplTitle('');
                        setTplDesc('');
                      }}
                      className="text-xs text-stone-500 hover:text-stone-900"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Template Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={tplTitle}
                      onChange={(e) => setTplTitle(e.target.value)}
                      placeholder="e.g., Royal Jodhpur Sandstone Suite"
                      className="w-full px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Occasion Category *
                    </label>
                    <select
                      value={tplCategoryId}
                      onChange={(e) => setTplCategoryId(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Plan Tier
                    </label>
                    <select
                      value={tplTier}
                      onChange={(e) =>
                        setTplTier(e.target.value as 'free' | 'basic' | 'premium')
                      }
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                    >
                      <option value="free">Free</option>
                      <option value="basic">Basic</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Price (INR)
                    </label>
                    <input
                      type="number"
                      min={0}
                      disabled={tplTier === 'free'}
                      value={tplTier === 'free' ? 0 : tplPrice}
                      onChange={(e) => setTplPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Theme Style Label
                    </label>
                    <input
                      type="text"
                      value={tplThemeStyle}
                      onChange={(e) => setTplThemeStyle(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Accent Hex Color
                    </label>
                    <input
                      type="text"
                      value={tplAccent}
                      onChange={(e) => setTplAccent(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Preview Image Asset Path
                  </label>
                  <select
                    value={tplImage}
                    onChange={(e) => setTplImage(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                  >
                    <option value={IMG_ROYAL_WEDDING}>Heritage Palace Courtyard (Wedding / Reception)</option>
                    <option value={HERO_IMAGE_PATH}>Ivory Travertine & Gold Calligraphy Suite</option>
                    <option value={IMG_BIRTHDAY_GALA}>Candlelight Fig & Crystal Soirée</option>
                    <option value={IMG_TRADITIONAL}>Sacred Brass Diya & Marigold Courtyard</option>
                    <option value={IMG_CORPORATE}>Glass Pavilion Executive Gala</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={tplDesc}
                    onChange={(e) => setTplDesc(e.target.value)}
                    placeholder="Describe the layout, typography, and occasion fit..."
                    className="w-full px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4 text-xs text-stone-700">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tplFeatured}
                        onChange={(e) => setTplFeatured(e.target.checked)}
                      />
                      <span>Featured on Homepage</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tplPopular}
                        onChange={(e) => setTplPopular(e.target.checked)}
                      />
                      <span>Popular Design</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{editingTemplateId ? 'Save Template Changes' : 'Add Template'}</span>
                  </button>
                </div>
              </form>

              {/* Templates List */}
              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-stone-900">
                    Marketplace Templates ({templates.length})
                  </h3>
                </div>
                <div className="divide-y divide-stone-200">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-stone-50"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <img
                          src={t.previewImage || HERO_IMAGE_PATH}
                          alt={t.title}
                          referrerPolicy="no-referrer"
                          className="w-16 h-12 object-cover rounded-lg border border-stone-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-stone-900 truncate">{t.title}</p>
                          <div className="flex items-center gap-2 text-xs text-stone-500">
                            <span>{t.categoryName}</span>
                            <span aria-hidden="true">·</span>
                            <span className="capitalize">{t.tier}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular">
                              {t.price === 0 ? 'Free' : `₹${t.price}`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTemplateId(t.id);
                            setTplTitle(t.title);
                            setTplCategoryId(t.categoryId);
                            setTplTier(t.tier);
                            setTplPrice(t.price);
                            setTplAccent(t.accentColor);
                            setTplThemeStyle(t.themeStyle);
                            setTplImage(t.previewImage);
                            setTplDesc(t.description);
                            setTplFeatured(t.isFeatured);
                            setTplPopular(t.isPopular);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(t.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="space-y-6">
              <form
                onSubmit={handleAddCategory}
                className="bg-white border border-stone-200 rounded-xl p-6 space-y-4"
              >
                <h2 className="text-base font-semibold text-stone-900">
                  Add New Invitation Category
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <input
                    type="text"
                    required
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="Category Name (e.g., Sangeet Night)"
                    className="px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                  />
                  <input
                    type="text"
                    value={catDesc}
                    onChange={(e) => setCatDesc(e.target.value)}
                    placeholder="Short category description"
                    className="px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={catOrder}
                      onChange={(e) => setCatOrder(Number(e.target.value))}
                      className="w-20 px-3 py-2 text-xs font-mono-tabular bg-white border border-stone-200 rounded-lg"
                    />
                    <button
                      type="submit"
                      className="flex-1 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg"
                    >
                      Save Category
                    </button>
                  </div>
                </div>
              </form>

              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
                      <th className="py-2.5 px-4 font-medium">Order</th>
                      <th className="py-2.5 px-4 font-medium">Category Name</th>
                      <th className="py-2.5 px-4 font-medium">Slug</th>
                      <th className="py-2.5 px-4 font-medium">Description</th>
                      <th className="py-2.5 px-4 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {categories.map((c) => (
                      <tr key={c.id} className="hover:bg-stone-50">
                        <td className="py-3 px-4 font-mono-tabular text-stone-600">
                          {c.displayOrder}
                        </td>
                        <td className="py-3 px-4 font-semibold text-stone-900">{c.name}</td>
                        <td className="py-3 px-4 font-mono-tabular text-stone-500">{c.slug}</td>
                        <td className="py-3 px-4 text-stone-600 max-w-xs truncate">
                          {c.description}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await deleteDoc(doc(db, 'categories', c.id));
                                notify(`Deleted category ${c.name}.`);
                              } catch (err) {
                                handleFirestoreError(
                                  err,
                                  OperationType.DELETE,
                                  `categories/${c.id}`
                                );
                              }
                            }}
                            className="text-red-700 hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'customers' && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-stone-900">
                  Registered Customers ({customers.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
                      <th className="py-2.5 px-4 font-medium">Display Name</th>
                      <th className="py-2.5 px-4 font-medium">Email</th>
                      <th className="py-2.5 px-4 font-medium">Phone</th>
                      <th className="py-2.5 px-4 font-medium text-right">Saved Templates</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {customers.map((u) => (
                      <tr key={u.uid} className="hover:bg-stone-50">
                        <td className="py-3 px-4 font-medium text-stone-900">{u.displayName}</td>
                        <td className="py-3 px-4 text-stone-600">{u.email}</td>
                        <td className="py-3 px-4 font-mono-tabular text-stone-600">
                          {u.phone || '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-stone-900">
                          {u.savedTemplateIds?.length || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-stone-900">
                  All Customer Orders ({orders.length})
                </h2>
              </div>
              {orders.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-500">No orders placed yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
                        <th className="py-2.5 px-4 font-medium">Order ID</th>
                        <th className="py-2.5 px-4 font-medium">Plan</th>
                        <th className="py-2.5 px-4 font-medium">Coupon</th>
                        <th className="py-2.5 px-4 font-medium text-right">Final Amount</th>
                        <th className="py-2.5 px-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {orders.map((o) => (
                        <tr key={o.id} className="hover:bg-stone-50">
                          <td className="py-3 px-4 font-mono-tabular text-stone-800">{o.id}</td>
                          <td className="py-3 px-4 font-medium text-stone-900">{o.planName}</td>
                          <td className="py-3 px-4 font-mono-tabular text-stone-600">
                            {o.couponCode || '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-stone-900">
                            ₹{o.finalAmount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 capitalize font-semibold text-stone-800">
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

          {activeTab === 'payments' && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-stone-900">
                  Verified Razorpay Payments ({payments.length})
                </h2>
              </div>
              {payments.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-500">
                  No verified payment records yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
                        <th className="py-2.5 px-4 font-medium">Payment ID</th>
                        <th className="py-2.5 px-4 font-medium">Order ID</th>
                        <th className="py-2.5 px-4 font-medium">Razorpay Ref</th>
                        <th className="py-2.5 px-4 font-medium text-right">Amount</th>
                        <th className="py-2.5 px-4 font-medium">Status</th>
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
                          <td className="py-3 px-4 capitalize text-emerald-800 font-semibold">
                            {p.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'plans' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {plans.map((p) => {
                const isEditing = editingPlanId === p.id;
                return (
                  <div
                    key={p.id}
                    className="bg-white border border-stone-200 rounded-xl p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-stone-900">{p.name}</h3>
                        <p className="text-xs text-stone-500 capitalize">
                          {p.tier} Tier · {p.billingPeriod}
                        </p>
                      </div>
                      <span className="text-xl font-semibold font-mono-tabular text-stone-900">
                        ₹{p.price.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="space-y-3 pt-2 border-t border-stone-200">
                        <div>
                          <label className="block text-xs font-medium text-stone-700 mb-1">
                            Plan Price (INR)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={planPriceInput}
                            onChange={(e) => setPlanPriceInput(Number(e.target.value))}
                            className="w-full px-3 py-1.5 text-xs font-mono-tabular border border-stone-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-stone-700 mb-1">
                            Description
                          </label>
                          <input
                            type="text"
                            value={planDescInput}
                            onChange={(e) => setPlanDescInput(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-stone-700 mb-1">
                            Features (One per line)
                          </label>
                          <textarea
                            rows={4}
                            value={planFeaturesInput}
                            onChange={(e) => setPlanFeaturesInput(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-lg"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdatePlan(p)}
                            className="px-3.5 py-1.5 text-xs font-medium text-white bg-stone-900 rounded-lg"
                          >
                            Save Plan
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPlanId(null)}
                            className="px-3.5 py-1.5 text-xs font-medium text-stone-600 bg-stone-100 rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-stone-600">{p.description}</p>
                        <ul className="text-xs text-stone-600 space-y-1">
                          {p.features.map((f) => (
                            <li key={f}>· {f}</li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPlanId(p.id);
                            setPlanPriceInput(p.price);
                            setPlanDescInput(p.description);
                            setPlanFeaturesInput(p.features.join('\n'));
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Price & Features</span>
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'coupons' && (
            <div className="space-y-6">
              <form
                onSubmit={handleCreateCoupon}
                className="bg-white border border-stone-200 rounded-xl p-6 space-y-4"
              >
                <h2 className="text-base font-semibold text-stone-900">Create Discount Coupon</h2>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <input
                    type="text"
                    required
                    value={cpnCode}
                    onChange={(e) => setCpnCode(e.target.value.toUpperCase())}
                    placeholder="CODE (e.g., ROYAL25)"
                    className="px-3.5 py-2 text-xs font-mono-tabular bg-white border border-stone-200 rounded-lg"
                  />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={cpnPercent}
                    onChange={(e) => setCpnPercent(Number(e.target.value))}
                    placeholder="Discount %"
                    className="px-3.5 py-2 text-xs font-mono-tabular bg-white border border-stone-200 rounded-lg"
                  />
                  <input
                    type="number"
                    min={0}
                    value={cpnMaxDiscount}
                    onChange={(e) => setCpnMaxDiscount(Number(e.target.value))}
                    placeholder="Max Discount INR"
                    className="px-3.5 py-2 text-xs font-mono-tabular bg-white border border-stone-200 rounded-lg"
                  />
                  <button
                    type="submit"
                    className="py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg"
                  >
                    Create Coupon
                  </button>
                </div>
              </form>

              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
                      <th className="py-2.5 px-4 font-medium">Coupon Code</th>
                      <th className="py-2.5 px-4 font-medium">Discount %</th>
                      <th className="py-2.5 px-4 font-medium">Max Cap</th>
                      <th className="py-2.5 px-4 font-medium">Expiry</th>
                      <th className="py-2.5 px-4 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {coupons.map((c) => (
                      <tr key={c.id} className="hover:bg-stone-50">
                        <td className="py-3 px-4 font-mono-tabular font-semibold text-stone-900">
                          {c.code}
                        </td>
                        <td className="py-3 px-4 font-mono-tabular text-stone-700">
                          {c.discountPercent}%
                        </td>
                        <td className="py-3 px-4 font-mono-tabular text-stone-700">
                          ₹{c.maxDiscountAmount}
                        </td>
                        <td className="py-3 px-4 font-mono-tabular text-stone-500">
                          {c.expiryDate}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await deleteDoc(doc(db, 'coupons', c.id));
                                notify(`Coupon ${c.code} deleted.`);
                              } catch (err) {
                                handleFirestoreError(err, OperationType.DELETE, `coupons/${c.id}`);
                              }
                            }}
                            className="text-red-700 hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'testimonials' && (
            <div className="space-y-6">
              <form
                onSubmit={handleCreateTestimonial}
                className="bg-white border border-stone-200 rounded-xl p-6 space-y-4"
              >
                <h2 className="text-base font-semibold text-stone-900">Add Customer Testimonial</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <input
                    type="text"
                    required
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder="Customer Name *"
                    className="px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                  />
                  <input
                    type="text"
                    required
                    value={testRole}
                    onChange={(e) => setTestRole(e.target.value)}
                    placeholder="Role / Location *"
                    className="px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                  />
                  <input
                    type="text"
                    required
                    value={testMetric}
                    onChange={(e) => setTestMetric(e.target.value)}
                    placeholder="Concrete Outcome Metric *"
                    className="px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                  />
                </div>
                <textarea
                  rows={2}
                  required
                  value={testQuote}
                  onChange={(e) => setTestQuote(e.target.value)}
                  placeholder="Customer quote (min 10 characters) *"
                  className="w-full px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg"
                >
                  Publish Testimonial
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {testimonials.map((t) => (
                  <div
                    key={t.id}
                    className="bg-white border border-stone-200 rounded-xl p-5 flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <p className="text-xs font-mono-tabular text-amber-800">{t.outcomeMetric}</p>
                      <p className="text-xs text-stone-700 leading-relaxed">“{t.quote}”</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                      <div>
                        <p className="text-xs font-semibold text-stone-900">{t.customerName}</p>
                        <p className="text-[11px] text-stone-500">{t.customerRole}</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await deleteDoc(doc(db, 'testimonials', t.id));
                            notify('Testimonial removed.');
                          } catch (err) {
                            handleFirestoreError(err, OperationType.DELETE, `testimonials/${t.id}`);
                          }
                        }}
                        className="text-xs text-red-700 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'banners' && (
            <form
              onSubmit={handleSaveBanner}
              className="bg-white border border-stone-200 rounded-xl p-6 space-y-4"
            >
              <h2 className="text-base font-semibold text-stone-900">
                Homepage Hero Banner & Global Website Settings
              </h2>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Hero Display Headline
                </label>
                <input
                  type="text"
                  required
                  value={bnHeadline}
                  onChange={(e) => setBnHeadline(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-stone-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Hero Subheadline
                </label>
                <textarea
                  rows={2}
                  required
                  value={bnSubheadline}
                  onChange={(e) => setBnSubheadline(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Primary CTA Label
                  </label>
                  <input
                    type="text"
                    value={bnCta}
                    onChange={(e) => setBnCta(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Promotional Offer Strip
                  </label>
                  <input
                    type="text"
                    value={bnPromo}
                    onChange={(e) => setBnPromo(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Support Email
                  </label>
                  <input
                    type="email"
                    value={bnEmail}
                    onChange={(e) => setBnEmail(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Support Phone
                  </label>
                  <input
                    type="text"
                    value={bnPhone}
                    onChange={(e) => setBnPhone(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-white border border-stone-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Razorpay Merchant Key ID
                  </label>
                  <input
                    type="text"
                    value={bnRazorpayKey}
                    onChange={(e) => setBnRazorpayKey(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-white border border-stone-200 rounded-lg"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg"
              >
                Save Website Settings
              </button>
            </form>
          )}

          {activeTab === 'messages' && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-stone-900">
                  Customer Contact Messages ({contactMessages.length})
                </h2>
              </div>
              {contactMessages.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-500">
                  No contact inquiries submitted yet.
                </div>
              ) : (
                <div className="divide-y divide-stone-200">
                  {contactMessages.map((m) => (
                    <div key={m.id} className="p-4 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-stone-500">
                          <span className="font-semibold text-stone-900">{m.senderName}</span>
                          <span aria-hidden="true">·</span>
                          <span>{m.senderEmail}</span>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{m.status}</span>
                        </div>
                        <p className="text-xs font-semibold text-stone-800">{m.subject}</p>
                        <p className="text-xs text-stone-600">{m.message}</p>
                      </div>
                      {m.status === 'new' && (
                        <button
                          type="button"
                          onClick={() => handleResolveMessage(m)}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shrink-0"
                        >
                          Mark Resolved
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'rsvps' && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-stone-900">
                  Platform-Wide RSVP Responses ({allRsvps.length})
                </h2>
              </div>
              {allRsvps.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-500">
                  No guest RSVPs submitted yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
                        <th className="py-2.5 px-4 font-medium">Guest Name</th>
                        <th className="py-2.5 px-4 font-medium">Invitation ID</th>
                        <th className="py-2.5 px-4 font-medium">Attending</th>
                        <th className="py-2.5 px-4 font-medium text-right">Party Size</th>
                        <th className="py-2.5 px-4 font-medium">Wish</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {allRsvps.map((r) => (
                        <tr key={r.id} className="hover:bg-stone-50">
                          <td className="py-3 px-4 font-medium text-stone-900">{r.guestName}</td>
                          <td className="py-3 px-4 font-mono-tabular text-stone-500">
                            {r.invitationId}
                          </td>
                          <td className="py-3 px-4 capitalize text-stone-700">{r.attending}</td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-stone-900">
                            {r.guestsCount}
                          </td>
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
        </div>
      </div>
    </div>
  );
};

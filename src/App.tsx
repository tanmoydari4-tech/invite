import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Eye,
  Bookmark,
  Monitor,
  Smartphone,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  CheckCircle2,
  Send,
  LogOut,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  BOOTSTRAPPED_ADMIN_EMAIL,
  OperationType,
  handleFirestoreError,
} from './lib/firebase.ts';
import {
  UserProfile,
  Category,
  Template,
  Invitation,
  InvitationEvent,
  InvitationGalleryItem,
  RsvpResponse,
  Order,
  Payment,
  SubscriptionPlan,
  Coupon,
  Testimonial,
  HomepageBanner,
  ContactMessage,
  VALIDATION_LIMITS,
  sanitizeId,
  truncateString,
} from './types/invitation.ts';
import {
  HERO_IMAGE_PATH,
  IMG_ROYAL_WEDDING,
  IMG_TRADITIONAL,
  INITIAL_CATEGORIES,
  INITIAL_TEMPLATES,
  INITIAL_PLANS,
  INITIAL_COUPONS,
  INITIAL_TESTIMONIALS,
  INITIAL_BANNER,
} from './data/initialCatalog.ts';
import { InvitationWebsiteRenderer } from './components/InvitationWebsiteRenderer.tsx';
import { InvitationBuilder } from './components/InvitationBuilder.tsx';
import { CustomerDashboard } from './components/CustomerDashboard.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { RazorpayCheckoutModal } from './components/RazorpayCheckoutModal.tsx';

const SAMPLE_DEMO_INVITATION: Invitation = {
  id: 'inv-demo-rahul-priya',
  slug: 'rahul-weds-priya',
  ownerId: 'demo-studio-host',
  templateId: 'tpl-udaipur-palace',
  categoryId: 'cat-wedding',
  status: 'published',
  eventTitle: 'The Royal Wedding of Rahul & Priya',
  hostName: 'The Sharma & Verma Families',
  brideName: 'Priya Sharma',
  groomName: 'Rahul Verma',
  familyNames: 'Smt. Kavita & Shri Rajesh Sharma · Smt. Sunita & Shri Anil Verma',
  eventDate: '2026-12-24',
  eventTime: '18:30',
  venueName: 'The Oberoi Udaivilas Heritage Courtyard',
  venueAddress: 'Haridasji Ki Magri, Pichola, Udaipur, Rajasthan 313001',
  venueLat: 24.5764,
  venueLng: 73.6722,
  coverPhotoUrl: IMG_ROYAL_WEDDING,
  backgroundImageUrl: IMG_ROYAL_WEDDING,
  videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  musicTrack: 'Royal Santoor & Chimes Suite',
  welcomeMessage:
    'With joyful hearts and the blessings of our parents and elders, we cordially invite you to celebrate our wedding festivities by the tranquil waters of Lake Pichola.',
  themeColor: '#92400e',
  fontPairing: 'Cormorant Garamond & Plus Jakarta Sans',
  showCountdown: true,
  showMap: true,
  showRsvp: true,
  showWishes: true,
  whatsappNumber: '+91 9830045120',
  socialLink: 'https://instagram.com',
};

const SAMPLE_DEMO_EVENTS: InvitationEvent[] = [
  {
    id: 'evt-demo-1',
    invitationId: 'inv-demo-rahul-priya',
    ownerId: 'demo-studio-host',
    isPublic: true,
    title: 'Mehendi & Sunlit Marigold Lunch',
    eventDate: '2026-12-23',
    eventTime: '12:00',
    venueName: 'Lakeview Banyan Courtyard',
    venueAddress: 'The Oberoi Udaivilas, Udaipur',
    description: 'Attire: Vibrant Festive Hues & Handloom Silk.',
  },
  {
    id: 'evt-demo-2',
    invitationId: 'inv-demo-rahul-priya',
    ownerId: 'demo-studio-host',
    isPublic: true,
    title: 'Sangeet & Starlight Qawwali Night',
    eventDate: '2026-12-23',
    eventTime: '20:00',
    venueName: 'Chandra Mahal Terrace',
    venueAddress: 'The Oberoi Udaivilas, Udaipur',
    description: 'Attire: Indo-Western Black Tie & Jewel Tones.',
  },
  {
    id: 'evt-demo-3',
    invitationId: 'inv-demo-rahul-priya',
    ownerId: 'demo-studio-host',
    isPublic: true,
    title: 'Baraat, Pheras & Royal Reception Dinner',
    eventDate: '2026-12-24',
    eventTime: '18:30',
    venueName: 'Main Heritage Courtyard Pool',
    venueAddress: 'The Oberoi Udaivilas, Udaipur',
    description: 'Attire: Traditional Royal Heritage Formal.',
  },
];

const SAMPLE_DEMO_GALLERY: InvitationGalleryItem[] = [
  {
    id: 'gal-demo-1',
    invitationId: 'inv-demo-rahul-priya',
    ownerId: 'demo-studio-host',
    isPublic: true,
    imageUrl: IMG_ROYAL_WEDDING,
    caption: 'The Palace Courtyard Reflected at Dusk',
    displayOrder: 1,
  },
  {
    id: 'gal-demo-2',
    invitationId: 'inv-demo-rahul-priya',
    ownerId: 'demo-studio-host',
    isPublic: true,
    imageUrl: HERO_IMAGE_PATH,
    caption: 'Our Bespoke Calligraphy & Wax Seal Suite',
    displayOrder: 2,
  },
  {
    id: 'gal-demo-3',
    invitationId: 'inv-demo-rahul-priya',
    ownerId: 'demo-studio-host',
    isPublic: true,
    imageUrl: IMG_TRADITIONAL,
    caption: 'Auspicious Marigold & Brass Diya Mandap',
    displayOrder: 3,
  },
];

const FAQ_ITEMS = [
  {
    q: 'How quickly can I build and publish a personalized invitation website?',
    a: 'You can select any template from our 13 occasion categories, customize the names, schedules, photo gallery, and Google Maps venue location in the live visual builder, and publish a unique shareable link and QR code in under 10 minutes.',
  },
  {
    q: 'Do guests need to install an app to view the invitation or submit an RSVP?',
    a: 'No app installation is needed. Your published invitation website works seamlessly across mobile phones, tablets, and desktops via a clean web link (e.g., invitationstudio.com/invite/rahul-weds-priya) or scannable QR code.',
  },
  {
    q: 'Can I add multiple event schedules such as Haldi, Mehendi, Sangeet, and Reception?',
    a: 'Yes. The Invitation Website Builder supports unlimited sub-event schedules with separate dates, timings, sub-venue names, addresses, and dress-code instructions.',
  },
  {
    q: 'How does Razorpay payment verification work for Basic and Premium plans?',
    a: 'When you choose a Basic, Premium, or Custom plan, an order is created in pending status. Your order is only marked as paid after Razorpay payment signature verification completes.',
  },
  {
    q: 'Can I edit my invitation website after publishing it?',
    a: 'Yes. You can open your Customer Dashboard at any time to update event timings, venue pins, or gallery photos, and your live invitation URL updates immediately.',
  },
];

export default function App() {
  // Google Maps Platform Quota Exceeded Warning State (Tier 1 & Tier 2)
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  // Navigation View State
  const [currentView, setCurrentView] = useState<
    'home' | 'gallery' | 'builder' | 'dashboard' | 'admin' | 'published-invite'
  >('home');

  // Auth & User State
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [authError, setAuthError] = useState('');

  // Marketplace Data State (Backed by Firestore with Initial Catalog Fallback)
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [templates, setTemplates] = useState<Template[]>(INITIAL_TEMPLATES);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(INITIAL_PLANS);
  const [coupons, setCoupons] = useState<Coupon[]>(INITIAL_COUPONS);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(INITIAL_TESTIMONIALS);
  const [banner, setBanner] = useState<HomepageBanner>(INITIAL_BANNER);

  // User-specific & Admin Firestore Data
  const [myInvitations, setMyInvitations] = useState<Invitation[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [myPayments, setMyPayments] = useState<Payment[]>([]);
  const [myRsvps, setMyRsvps] = useState<RsvpResponse[]>([]);

  // Admin-wide Collections
  const [allInvitations, setAllInvitations] = useState<Invitation[]>([]);
  const [allCustomers, setAllCustomers] = useState<UserProfile[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [allContactMessages, setAllContactMessages] = useState<ContactMessage[]>([]);
  const [allRsvps, setAllRsvps] = useState<RsvpResponse[]>([]);
  const [seedingCatalog, setSeedingCatalog] = useState(false);

  // Template Filtering & Preview Modal State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedTierFilter, setSelectedTierFilter] = useState<'all' | 'free' | 'basic' | 'premium'>(
    'all'
  );
  const [previewModalTemplate, setPreviewModalTemplate] = useState<Template | null>(null);
  const [previewModalDevice, setPreviewModalDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Active Builder & Published Invitation State
  const [activeBuilderTemplate, setActiveBuilderTemplate] = useState<Template>(INITIAL_TEMPLATES[0]);
  const [editingInvitation, setEditingInvitation] = useState<Invitation | null>(null);
  const [activePublishedInvite, setActivePublishedInvite] = useState<Invitation>(
    SAMPLE_DEMO_INVITATION
  );
  const [activePublishedEvents, setActivePublishedEvents] =
    useState<InvitationEvent[]>(SAMPLE_DEMO_EVENTS);
  const [activePublishedGallery, setActivePublishedGallery] =
    useState<InvitationGalleryItem[]>(SAMPLE_DEMO_GALLERY);
  const [activePublishedRsvps, setActivePublishedRsvps] = useState<RsvpResponse[]>([]);

  // Standalone Plan Checkout Modal
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<SubscriptionPlan | null>(
    null
  );

  // FAQ & Contact Form State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState('');

  // Listen for Google Maps Platform Demo Quota Exceeded Event
  useEffect(() => {
    const handler = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  // Seed default catalog into Firestore when admin signs in
  const seedMarketplaceCatalogToFirestore = useCallback(async () => {
    setSeedingCatalog(true);
    try {
      for (const cat of INITIAL_CATEGORIES) {
        await setDoc(doc(db, 'categories', cat.id), {
          ...cat,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const tpl of INITIAL_TEMPLATES) {
        await setDoc(doc(db, 'templates', tpl.id), {
          ...tpl,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const plan of INITIAL_PLANS) {
        await setDoc(doc(db, 'plans', plan.id), {
          ...plan,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const cpn of INITIAL_COUPONS) {
        await setDoc(doc(db, 'coupons', cpn.id), {
          ...cpn,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const test of INITIAL_TESTIMONIALS) {
        await setDoc(doc(db, 'testimonials', test.id), {
          ...test,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await setDoc(doc(db, 'banners', INITIAL_BANNER.id), {
        ...INITIAL_BANNER,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Catalog seed warning:', err);
    } finally {
      setSeedingCatalog(false);
    }
  }, []);

  // Load a published invitation by slug
  const openPublishedInvitationBySlug = useCallback(async (slug: string) => {
    const cleanSlug = sanitizeId(slug);
    if (cleanSlug === 'rahul-weds-priya') {
      setActivePublishedInvite(SAMPLE_DEMO_INVITATION);
      setActivePublishedEvents(SAMPLE_DEMO_EVENTS);
      setActivePublishedGallery(SAMPLE_DEMO_GALLERY);
      setActivePublishedRsvps([]);
      setCurrentView('published-invite');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      const q = query(
        collection(db, 'invitations'),
        where('status', '==', 'published'),
        where('slug', '==', cleanSlug)
      );
      const snap = await getDocs(q);
      let found: Invitation | null = null;
      if (!snap.empty) {
        found = snap.docs[0].data() as Invitation;
      } else if (auth.currentUser) {
        // Also check owner's own invitations (e.g., draft preview)
        const ownerQ = query(
          collection(db, 'invitations'),
          where('ownerId', '==', auth.currentUser.uid),
          where('slug', '==', cleanSlug)
        );
        const ownerSnap = await getDocs(ownerQ);
        if (!ownerSnap.empty) {
          found = ownerSnap.docs[0].data() as Invitation;
        }
      }

      if (found) {
        setActivePublishedInvite(found);
        const evSnap = await getDocs(
          query(
            collection(db, 'invitations', found.id, 'events'),
            where('isPublic', '==', true)
          )
        );
        setActivePublishedEvents(evSnap.docs.map((d) => d.data() as InvitationEvent));

        const galSnap = await getDocs(
          query(
            collection(db, 'invitations', found.id, 'gallery'),
            where('isPublic', '==', true)
          )
        );
        setActivePublishedGallery(
          galSnap.docs
            .map((d) => d.data() as InvitationGalleryItem)
            .sort((a, b) => a.displayOrder - b.displayOrder)
        );

        const rsvpSnap = await getDocs(
          query(
            collection(db, 'invitations', found.id, 'rsvps'),
            where('isPublicWish', '==', true)
          )
        );
        setActivePublishedRsvps(rsvpSnap.docs.map((d) => d.data() as RsvpResponse));
        setCurrentView('published-invite');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.warn('Error loading invitation by slug:', err);
    }
  }, []);

  // Check URL query param `?invite=<slug>` or `/invite/<slug>` on initial boot
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteSlug = params.get('invite');
    const pathMatch = window.location.pathname.match(/^\/invite\/([a-zA-Z0-9_-]+)/);
    if (inviteSlug) {
      openPublishedInvitationBySlug(inviteSlug);
    } else if (pathMatch && pathMatch[1]) {
      openPublishedInvitationBySlug(pathMatch[1]);
    }
  }, [openPublishedInvitationBySlug]);

  // Listen to public marketplace collections in Firestore
  useEffect(() => {
    const unsubCats = onSnapshot(
      query(collection(db, 'categories'), where('isActive', '==', true)),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs
            .map((d) => d.data() as Category)
            .sort((a, b) => a.displayOrder - b.displayOrder);
          setCategories(list);
        }
      },
      (err) => console.warn('Categories listener notice:', err.message)
    );

    const unsubTpls = onSnapshot(
      query(collection(db, 'templates'), where('price', '>=', 0)),
      (snap) => {
        if (!snap.empty) {
          setTemplates(snap.docs.map((d) => d.data() as Template));
        }
      },
      (err) => console.warn('Templates listener notice:', err.message)
    );

    const unsubPlans = onSnapshot(
      query(collection(db, 'plans'), where('isActive', '==', true)),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs
            .map((d) => d.data() as SubscriptionPlan)
            .sort((a, b) => a.price - b.price);
          setPlans(list);
        }
      },
      (err) => console.warn('Plans listener notice:', err.message)
    );

    const unsubCoupons = onSnapshot(
      query(collection(db, 'coupons'), where('isActive', '==', true)),
      (snap) => {
        if (!snap.empty) {
          setCoupons(snap.docs.map((d) => d.data() as Coupon));
        }
      },
      (err) => console.warn('Coupons listener notice:', err.message)
    );

    const unsubTestimonials = onSnapshot(
      query(collection(db, 'testimonials'), where('isApproved', '==', true)),
      (snap) => {
        if (!snap.empty) {
          setTestimonials(snap.docs.map((d) => d.data() as Testimonial));
        }
      },
      (err) => console.warn('Testimonials listener notice:', err.message)
    );

    const unsubBanners = onSnapshot(
      query(collection(db, 'banners'), where('isActive', '==', true)),
      (snap) => {
        if (!snap.empty) {
          setBanner(snap.docs[0].data() as HomepageBanner);
        }
      },
      (err) => console.warn('Banners listener notice:', err.message)
    );

    return () => {
      unsubCats();
      unsubTpls();
      unsubPlans();
      unsubCoupons();
      unsubTestimonials();
      unsubBanners();
    };
  }, []);

  // Listen to Firebase Auth State & Synchronize User Profile
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (!user) {
        setUserProfile(null);
        setIsAdminUser(false);
        setMyInvitations([]);
        setMyOrders([]);
        setMyPayments([]);
        setMyRsvps([]);
        setAuthReady(true);
        return;
      }

      const isBootstrappedAdmin =
        user.email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified === true;
      let adminVerified = isBootstrappedAdmin;

      try {
        if (!adminVerified) {
          const adminDoc = await getDoc(doc(db, 'admins', user.uid));
          adminVerified = adminDoc.exists();
        }
      } catch {
        // Not an admin
      }
      setIsAdminUser(adminVerified);

      // Ensure UserProfile exists in /users/{uid}
      const userRef = doc(db, 'users', user.uid);
      try {
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserProfile(userSnap.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: user.uid,
            email: truncateString(user.email || 'user@invitationstudio.com', 254),
            displayName: truncateString(user.displayName || 'Invitation Host', 100),
            phone: '',
            savedTemplateIds: [],
          };
          await setDoc(userRef, {
            ...newProfile,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setUserProfile(newProfile);
        }
      } catch (err) {
        console.warn('Profile sync warning:', err);
      }

      // If admin, ensure marketplace catalog is seeded if empty
      if (adminVerified) {
        try {
          const tplSnap = await getDocs(
            query(collection(db, 'templates'), where('price', '>=', 0))
          );
          if (tplSnap.empty) {
            await seedMarketplaceCatalogToFirestore();
          }
        } catch {
          // Ignore
        }
      }

      setAuthReady(true);
    });

    return () => unsubAuth();
  }, [seedMarketplaceCatalogToFirestore]);

  // Attach authenticated customer listeners
  useEffect(() => {
    if (!authReady || !currentUser) return;

    const unsubMyInvs = onSnapshot(
      query(collection(db, 'invitations'), where('ownerId', '==', currentUser.uid)),
      async (snap) => {
        const invList = snap.docs.map((d) => d.data() as Invitation);
        setMyInvitations(invList);

        // Fetch RSVPs for owner's invitations
        const collectedRsvps: RsvpResponse[] = [];
        for (const invItem of invList) {
          try {
            const rSnap = await getDocs(
              query(
                collection(db, 'invitations', invItem.id, 'rsvps'),
                where('invitationOwnerId', '==', currentUser.uid)
              )
            );
            rSnap.docs.forEach((d) => collectedRsvps.push(d.data() as RsvpResponse));
          } catch {
            // Ignore
          }
        }
        setMyRsvps(collectedRsvps);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'invitations')
    );

    const unsubMyOrders = onSnapshot(
      query(collection(db, 'orders'), where('ownerId', '==', currentUser.uid)),
      (snap) => {
        setMyOrders(snap.docs.map((d) => d.data() as Order));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
    );

    const unsubMyPayments = onSnapshot(
      query(collection(db, 'payments'), where('ownerId', '==', currentUser.uid)),
      (snap) => {
        setMyPayments(snap.docs.map((d) => d.data() as Payment));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'payments')
    );

    return () => {
      unsubMyInvs();
      unsubMyOrders();
      unsubMyPayments();
    };
  }, [authReady, currentUser]);

  // Attach Admin-only listeners when isAdminUser is true
  useEffect(() => {
    if (!authReady || !currentUser || !isAdminUser) return;

    const unsubAllInvs = onSnapshot(
      collection(db, 'invitations'),
      async (snap) => {
        const list = snap.docs.map((d) => d.data() as Invitation);
        setAllInvitations(list);
        const rsvpsAcc: RsvpResponse[] = [];
        for (const inv of list.slice(0, 15)) {
          try {
            const rSnap = await getDocs(collection(db, 'invitations', inv.id, 'rsvps'));
            rSnap.docs.forEach((d) => rsvpsAcc.push(d.data() as RsvpResponse));
          } catch {
            // Ignore
          }
        }
        setAllRsvps(rsvpsAcc);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'invitations')
    );

    const unsubAllCustomers = onSnapshot(
      collection(db, 'users'),
      (snap) => setAllCustomers(snap.docs.map((d) => d.data() as UserProfile)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    const unsubAllOrders = onSnapshot(
      collection(db, 'orders'),
      (snap) => setAllOrders(snap.docs.map((d) => d.data() as Order)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
    );

    const unsubAllPayments = onSnapshot(
      collection(db, 'payments'),
      (snap) => setAllPayments(snap.docs.map((d) => d.data() as Payment)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'payments')
    );

    const unsubMessages = onSnapshot(
      collection(db, 'contact_messages'),
      (snap) => setAllContactMessages(snap.docs.map((d) => d.data() as ContactMessage)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'contact_messages')
    );

    return () => {
      unsubAllInvs();
      unsubAllCustomers();
      unsubAllOrders();
      unsubAllPayments();
      unsubMessages();
    };
  }, [authReady, currentUser, isAdminUser]);

  const handleGoogleSignIn = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In could not be completed.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setCurrentView('home');
  };

  const handleStartCustomizing = async (tpl: Template, existingInv?: Invitation | null) => {
    if (!currentUser) {
      try {
        await signInWithPopup(auth, googleProvider);
      } catch {
        return;
      }
    }
    setActiveBuilderTemplate(tpl);
    setEditingInvitation(existingInv || null);
    setPreviewModalTemplate(null);
    setCurrentView('builder');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleSaveTemplate = async (templateId: string) => {
    if (!currentUser || !userProfile) {
      await handleGoogleSignIn();
      return;
    }
    const exists = userProfile.savedTemplateIds.includes(templateId);
    const updatedIds = exists
      ? userProfile.savedTemplateIds.filter((id) => id !== templateId)
      : [...userProfile.savedTemplateIds, templateId].slice(
          0,
          VALIDATION_LIMITS.SAVED_TEMPLATES_MAX
        );

    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        displayName: userProfile.displayName,
        phone: userProfile.phone,
        savedTemplateIds: updatedIds,
        updatedAt: serverTimestamp(),
      });
      setUserProfile({ ...userProfile, savedTemplateIds: updatedIds });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
    }
  };

  const handleSubmitGuestRsvp = async (payload: {
    guestName: string;
    attending: 'yes' | 'no' | 'maybe';
    guestsCount: number;
    dietaryNotes: string;
    wishMessage: string;
    isPublicWish: boolean;
  }) => {
    if (!currentUser) {
      await handleGoogleSignIn();
      return;
    }

    const rsvpId = sanitizeId(`rsvp-${Date.now()}`);
    // If demo invitation, update local state immediately
    if (activePublishedInvite.id === SAMPLE_DEMO_INVITATION.id) {
      const localRsvp: RsvpResponse = {
        id: rsvpId,
        invitationId: activePublishedInvite.id,
        invitationOwnerId: activePublishedInvite.ownerId,
        authorId: currentUser.uid,
        ...payload,
      };
      setActivePublishedRsvps((prev) => [localRsvp, ...prev]);
      return;
    }

    try {
      const newRsvp: RsvpResponse = {
        id: rsvpId,
        invitationId: activePublishedInvite.id,
        invitationOwnerId: activePublishedInvite.ownerId,
        authorId: currentUser.uid,
        ...payload,
      };
      await setDoc(doc(db, 'invitations', activePublishedInvite.id, 'rsvps', rsvpId), {
        ...newRsvp,
        createdAt: serverTimestamp(),
      });
      if (payload.isPublicWish) {
        setActivePublishedRsvps((prev) => [newRsvp, ...prev]);
      }
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.CREATE,
        `invitations/${activePublishedInvite.id}/rsvps/${rsvpId}`
      );
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError('');
    setContactSuccess(false);

    if (!currentUser) {
      await handleGoogleSignIn();
      return;
    }
    if (contactName.trim().length < 2 || contactMessage.trim().length < 5) {
      setContactError('Please enter your name and a message (at least 5 characters).');
      return;
    }

    setContactSubmitting(true);
    const msgId = sanitizeId(`msg-${Date.now()}`);
    try {
      await setDoc(doc(db, 'contact_messages', msgId), {
        id: msgId,
        senderId: currentUser.uid,
        senderName: truncateString(contactName, 100),
        senderEmail: truncateString(
          contactEmail || currentUser.email || 'guest@invitationstudio.com',
          254
        ),
        subject: truncateString(contactSubject || 'Custom Invitation Inquiry', 150),
        message: truncateString(contactMessage, 1500),
        status: 'new',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setContactSuccess(true);
      setContactName('');
      setContactSubject('');
      setContactMessage('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `contact_messages/${msgId}`);
    } finally {
      setContactSubmitting(false);
    }
  };

  // Filtered Templates for Gallery
  const filteredTemplates = templates.filter((tpl) => {
    const matchesCategory =
      selectedCategoryId === 'all' || tpl.categoryId === selectedCategoryId;
    const matchesTier = selectedTierFilter === 'all' || tpl.tier === selectedTierFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      tpl.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.categoryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.themeStyle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesTier && matchesSearch;
  });

  const featuredTemplates = templates.filter((t) => t.isFeatured).slice(0, 6);
  const popularWeddingTemplates = templates
    .filter((t) => t.categoryId === 'cat-wedding' || t.isPopular)
    .slice(0, 4);

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900">
      {/* Required Google Maps Platform Demo Quota Exceeded Banner (Case A) */}
      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 bg-white border-b border-stone-200 sticky top-0 z-40">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => setCurrentView('home')}
          className="text-xl font-display font-bold tracking-tight text-stone-900 whitespace-nowrap shrink-0 cursor-pointer"
        >
          Invitation Studio
        </button>

        {/* Zone 2: 4–5 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
          <button
            type="button"
            onClick={() => {
              setSelectedCategoryId('all');
              setCurrentView('gallery');
            }}
            className="hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Templates
          </button>
          <a
            href="#occasions"
            onClick={() => setCurrentView('home')}
            className="hover:text-stone-900 transition-colors whitespace-nowrap shrink-0"
          >
            Occasions
          </a>
          <a
            href="#pricing"
            onClick={() => setCurrentView('home')}
            className="hover:text-stone-900 transition-colors whitespace-nowrap shrink-0"
          >
            Pricing
          </a>
          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                handleGoogleSignIn();
              } else {
                setCurrentView('dashboard');
              }
            }}
            className="hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Dashboard
          </button>
          {isAdminUser && (
            <button
              type="button"
              onClick={() => setCurrentView('admin')}
              className="hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Admin
            </button>
          )}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          {currentUser ? (
            <button
              type="button"
              onClick={() => setCurrentView('gallery')}
              className="px-4 py-2 text-xs font-medium text-white bg-stone-900 rounded-lg hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
            >
              Create Invitation
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="px-4 py-2 text-xs font-medium text-white bg-stone-900 rounded-lg hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
            >
              Sign In with Google
            </button>
          )}
        </div>
      </header>

      {authError && (
        <div className="bg-red-50 border-b border-red-200 text-red-800 px-6 py-2 text-xs text-center">
          {authError}
        </div>
      )}

      {/* VIEW 1: PUBLISHED INVITATION WEBSITE VIEW */}
      {currentView === 'published-invite' && (
        <div className="flex-1">
          <div className="bg-stone-900 text-stone-200 px-6 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentView('home')}
                className="inline-flex items-center gap-1.5 text-white hover:underline whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Invitation Studio</span>
              </button>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular text-stone-400">
                invitationstudio.com/invite/{activePublishedInvite.slug}
              </span>
            </div>
            {currentUser && activePublishedInvite.ownerId === currentUser.uid && (
              <button
                type="button"
                onClick={() => {
                  const tpl =
                    templates.find((t) => t.id === activePublishedInvite.templateId) ||
                    templates[0];
                  handleStartCustomizing(tpl, activePublishedInvite);
                }}
                className="text-amber-300 hover:underline whitespace-nowrap"
              >
                Edit This Invitation in Builder
              </button>
            )}
          </div>
          <InvitationWebsiteRenderer
            invitation={activePublishedInvite}
            events={activePublishedEvents}
            gallery={activePublishedGallery}
            rsvps={activePublishedRsvps}
            onSubmitRsvp={handleSubmitGuestRsvp}
            currentUserEmail={currentUser?.email}
            onRequestSignIn={handleGoogleSignIn}
          />
        </div>
      )}

      {/* VIEW 2: INVITATION WEBSITE BUILDER */}
      {currentView === 'builder' && currentUser && (
        <InvitationBuilder
          template={activeBuilderTemplate}
          existingInvitation={editingInvitation}
          userId={currentUser.uid}
          userEmail={currentUser.email || ''}
          userDisplayName={userProfile?.displayName || currentUser.displayName || 'Host'}
          plans={plans}
          coupons={coupons}
          razorpayKeyId={banner.razorpayKeyId}
          hasPaidOrderForInvitation={myOrders.some((o) => o.status === 'paid')}
          onBack={() => setCurrentView('gallery')}
          onSaved={(savedInv) => {
            setEditingInvitation(savedInv);
          }}
          onViewPublished={(slug) => openPublishedInvitationBySlug(slug)}
        />
      )}

      {/* VIEW 3: CUSTOMER DASHBOARD */}
      {currentView === 'dashboard' && currentUser && userProfile && (
        <CustomerDashboard
          profile={userProfile}
          invitations={myInvitations}
          templates={templates}
          orders={myOrders}
          payments={myPayments}
          rsvps={myRsvps}
          onCreateNew={() => setCurrentView('gallery')}
          onEditInvitation={(inv) => {
            const tpl = templates.find((t) => t.id === inv.templateId) || templates[0];
            handleStartCustomizing(tpl, inv);
          }}
          onViewInvitation={(slug) => openPublishedInvitationBySlug(slug)}
          onSelectTemplate={(tpl) => handleStartCustomizing(tpl, null)}
          onToggleSaveTemplate={handleToggleSaveTemplate}
          onProfileUpdated={(updated) => setUserProfile(updated)}
        />
      )}

      {/* VIEW 4: ADMIN DASHBOARD */}
      {currentView === 'admin' && isAdminUser && (
        <AdminDashboard
          categories={categories}
          templates={templates}
          invitations={allInvitations}
          customers={allCustomers}
          orders={allOrders}
          payments={allPayments}
          plans={plans}
          coupons={coupons}
          testimonials={testimonials}
          banner={banner}
          contactMessages={allContactMessages}
          allRsvps={allRsvps}
          onSeedCatalog={seedMarketplaceCatalogToFirestore}
          seeding={seedingCatalog}
        />
      )}

      {/* VIEW 5: TEMPLATE GALLERY MARKETPLACE */}
      {currentView === 'gallery' && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 space-y-10">
          <div className="flex flex-wrap items-end justify-between gap-6 border-b border-stone-200 pb-8">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs text-stone-500">
                13 Occasion Categories · {templates.length} Bespoke Layouts
              </p>
              <h1
                className="text-3xl md:text-5xl font-display font-semibold text-stone-900"
                style={{ textWrap: 'balance' }}
              >
                Invitation Template Gallery
              </h1>
              <p className="text-sm text-stone-600">
                Every template features a distinct visual architecture, multi-event itinerary,
                interactive Google Maps venue pin, QR code generator, and live RSVP wall.
              </p>
            </div>

            {/* Search & Price Tier Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-64">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates or style..."
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-stone-900"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-stone-200/70 rounded-lg">
                {(['all', 'free', 'basic', 'premium'] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setSelectedTierFilter(tier)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize whitespace-nowrap ${
                      selectedTierFilter === tier
                        ? 'bg-white text-stone-900 shadow-sm'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {tier === 'all' ? 'All Prices' : tier}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Occasion Category Filter Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
            <button
              type="button"
              onClick={() => setSelectedCategoryId('all')}
              className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                selectedCategoryId === 'all'
                  ? 'bg-stone-900 text-white'
                  : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
              }`}
            >
              All 13 Occasions ({templates.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategoryId === cat.id
                    ? 'bg-stone-900 text-white'
                    : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Templates Grid */}
          {filteredTemplates.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-xl p-12 text-center space-y-3">
              <p className="text-base font-semibold text-stone-900">
                No templates match your current filter
              </p>
              <p className="text-xs text-stone-500">
                Try clearing your search keyword or switching to All Occasions.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId('all');
                  setSelectedTierFilter('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-xs font-medium text-white bg-stone-900 rounded-lg"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((tpl) => {
                const isSaved = userProfile?.savedTemplateIds.includes(tpl.id);
                return (
                  <article
                    key={tpl.id}
                    className="bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col group"
                  >
                    <div className="aspect-[4/3] bg-stone-100 relative overflow-hidden">
                      <img
                        src={tpl.previewImage || HERO_IMAGE_PATH}
                        alt={tpl.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = HERO_IMAGE_PATH;
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleToggleSaveTemplate(tpl.id)}
                        className="absolute top-3 right-3 p-2 rounded-lg bg-white/90 hover:bg-white text-stone-800 shadow-sm transition-colors"
                        title={isSaved ? 'Remove from Saved Templates' : 'Save Template'}
                      >
                        <Bookmark
                          className={`w-4 h-4 ${isSaved ? 'fill-amber-800 text-amber-800' : ''}`}
                        />
                      </button>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-1.5">
                        {/* Unboxed Metadata with Typographic Separators */}
                        <div className="flex items-center gap-2 text-xs text-stone-500">
                          <span>{tpl.categoryName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{tpl.tier}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular font-semibold text-stone-900">
                            {tpl.price === 0 ? 'Free' : `₹${tpl.price}`}
                          </span>
                        </div>

                        <h3 className="text-xl font-display font-semibold text-stone-900">
                          {tpl.title}
                        </h3>
                        <p className="text-xs text-stone-600 leading-relaxed">{tpl.description}</p>
                      </div>

                      <div className="flex items-center gap-2.5 pt-2 border-t border-stone-100">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewModalTemplate(tpl);
                            setPreviewModalDevice('desktop');
                          }}
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartCustomizing(tpl, null)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <span>Start Customizing</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* VIEW 6: PUBLIC HOMEPAGE */}
      {currentView === 'home' && (
        <main className="flex-1">
          {/* Promotional Strip */}
          {banner.promoText && (
            <div className="bg-stone-900 text-stone-200 px-6 py-2 text-xs text-center">
              <span>{banner.promoText}</span>
            </div>
          )}

          {/* Hero Section (2-Column Split with items-stretch) */}
          <section className="max-w-7xl mx-auto px-6 py-14 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <span>Online Invitation Website Builder</span>
                  <span aria-hidden="true">·</span>
                  <span>13 Occasion Categories</span>
                  <span aria-hidden="true">·</span>
                  <span>No Coding Required</span>
                </div>

                <h1
                  className="text-4xl sm:text-5xl lg:text-[3.5rem] font-display font-semibold tracking-tight text-stone-900 leading-[1.08]"
                  style={{ textWrap: 'balance' }}
                >
                  {banner.headline}
                </h1>

                <p className="text-base text-stone-600 leading-relaxed max-w-xl">
                  {banner.subheadline}
                </p>

                {/* Search & Explore Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setCurrentView('gallery');
                      }}
                      placeholder="Search Wedding, Annaprashan, Griha Pravesh, Birthday..."
                      className="w-full pl-10 pr-4 py-3 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:border-stone-900"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentView('gallery')}
                    className="px-6 py-3 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors whitespace-nowrap shrink-0"
                  >
                    {banner.ctaText}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-stone-600">
                  <button
                    type="button"
                    onClick={() => openPublishedInvitationBySlug('rahul-weds-priya')}
                    className="inline-flex items-center gap-1.5 font-semibold text-amber-900 hover:underline"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview Live Wedding Website (invitationstudio.com/invite/rahul-weds-priya)</span>
                  </button>
                </div>
              </div>

              {/* Right Hero Visual Showcase */}
              <div className="lg:col-span-6 flex">
                <div className="w-full bg-white border border-stone-200 rounded-2xl overflow-hidden flex flex-col justify-between">
                  <div className="relative flex-1 min-h-[320px] bg-stone-100 overflow-hidden">
                    <img
                      src={HERO_IMAGE_PATH}
                      alt="Luxury Wedding Invitation Flatlay Suite"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                    <div className="absolute bottom-5 left-6 right-6 text-white space-y-1">
                      <div className="flex items-center gap-2 text-xs text-amber-200">
                        <span>Live Interactive Invitation Preview</span>
                        <span aria-hidden="true">·</span>
                        <span>Udaipur Heritage Suite</span>
                      </div>
                      <h2 className="text-2xl font-display font-semibold">
                        Rahul & Priya — December 24, 2026
                      </h2>
                      <p className="text-xs text-stone-200">
                        Includes 3-Day Itinerary · Google Maps Venue Pin · Live RSVP & Wishes Wall
                      </p>
                    </div>
                  </div>
                  <div className="px-6 py-4 bg-white border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-mono-tabular text-stone-600">
                      invitationstudio.com/invite/rahul-weds-priya
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openPublishedInvitationBySlug('rahul-weds-priya')}
                        className="px-3.5 py-1.5 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg whitespace-nowrap"
                      >
                        Open Live Demo
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartCustomizing(templates[0], null)}
                        className="px-3.5 py-1.5 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded-lg whitespace-nowrap"
                      >
                        Customize This Design
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Full-Width 4-Column Quantitative Proof Bar below the Hero Split */}
            <div className="mt-12 pt-8 border-t border-stone-200 grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { metric: '13 Categories', detail: 'Weddings, Annaprashan, Griha Pravesh & Corporate' },
                { metric: '100% Live Preview', detail: 'Instant Desktop & Mobile responsive switching' },
                { metric: 'Real-Time RSVP', detail: 'Cloud Firestore guest & dietary tracking' },
                { metric: 'QR & Google Maps', detail: 'Downloadable print QR codes & venue navigation' },
              ].map((item) => (
                <div key={item.metric} className="space-y-1">
                  <p className="text-xl font-display font-semibold text-stone-900 font-mono-tabular">
                    {item.metric}
                  </p>
                  <p className="text-xs text-stone-500">{item.detail}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Browse by Occasion (All 13 Categories) */}
          <section id="occasions" className="bg-white border-y border-stone-200 py-16">
            <div className="max-w-7xl mx-auto px-6 space-y-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-stone-500 mb-1">Curated for Every Milestone</p>
                  <h2 className="text-3xl font-display font-semibold text-stone-900">
                    01. Browse by Occasion (13 Categories)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId('all');
                    setCurrentView('gallery');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-900 hover:underline"
                >
                  <span>View All Templates</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {categories.map((cat, idx) => {
                  const count = templates.filter((t) => t.categoryId === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategoryId(cat.id);
                        setCurrentView('gallery');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-left p-5 bg-stone-50 hover:bg-stone-100/80 border border-stone-200 rounded-xl transition-colors flex flex-col justify-between space-y-3 group cursor-pointer"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-stone-500 font-mono-tabular">
                          <span>{String(idx + 1).padStart(2, '0')}</span>
                          <span>{count} {count === 1 ? 'Design' : 'Designs'}</span>
                        </div>
                        <h3 className="text-lg font-display font-semibold text-stone-900 group-hover:text-amber-900 transition-colors">
                          {cat.name}
                        </h3>
                        <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                          {cat.description}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-stone-800 inline-flex items-center gap-1">
                        <span>Explore Category</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Featured & Popular Wedding Designs */}
          <section className="max-w-7xl mx-auto px-6 py-16 space-y-14">
            {/* Featured Templates */}
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-4">
                <div>
                  <p className="text-xs text-stone-500 mb-1">Handcrafted Editorial Layouts</p>
                  <h2 className="text-3xl font-display font-semibold text-stone-900">
                    02. Featured Invitation Templates
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentView('gallery')}
                  className="text-xs font-semibold text-stone-900 hover:underline"
                >
                  Open Complete Gallery →
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredTemplates.map((tpl) => (
                  <article
                    key={tpl.id}
                    className="bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col"
                  >
                    <div className="aspect-[4/3] bg-stone-100 relative overflow-hidden">
                      <img
                        src={tpl.previewImage || HERO_IMAGE_PATH}
                        alt={tpl.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-stone-500">
                          <span>{tpl.categoryName}</span>
                          <span aria-hidden="true">·</span>
                          <span>{tpl.themeStyle}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular font-semibold text-stone-900">
                            {tpl.price === 0 ? 'Free' : `₹${tpl.price}`}
                          </span>
                        </div>
                        <h3 className="text-xl font-display font-semibold text-stone-900">
                          {tpl.title}
                        </h3>
                        <p className="text-xs text-stone-600 leading-relaxed">{tpl.description}</p>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                        <button
                          type="button"
                          onClick={() => setPreviewModalTemplate(tpl)}
                          className="px-3.5 py-2 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg"
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartCustomizing(tpl, null)}
                          className="flex-1 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg"
                        >
                          Customize Template
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {/* Popular Wedding & Latest Designs */}
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-4">
                <div>
                  <p className="text-xs text-stone-500 mb-1">Most Loved by Couples & Families</p>
                  <h2 className="text-3xl font-display font-semibold text-stone-900">
                    03. Popular Wedding & Ceremonial Suites
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {popularWeddingTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="aspect-[4/3] bg-stone-100 overflow-hidden">
                        <img
                          src={tpl.previewImage || HERO_IMAGE_PATH}
                          alt={tpl.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-4 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                          <span>{tpl.categoryName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular font-semibold text-stone-900">
                            {tpl.price === 0 ? 'Free' : `₹${tpl.price}`}
                          </span>
                        </div>
                        <h3 className="text-base font-display font-semibold text-stone-900">
                          {tpl.title}
                        </h3>
                      </div>
                    </div>
                    <div className="p-4 pt-0">
                      <button
                        type="button"
                        onClick={() => handleStartCustomizing(tpl, null)}
                        className="w-full py-2 text-xs font-medium text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
                      >
                        Customize Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* How It Works Section */}
          <section className="bg-white border-y border-stone-200 py-16">
            <div className="max-w-7xl mx-auto px-6 space-y-8">
              <div>
                <p className="text-xs text-stone-500 mb-1">From Selection to Guest RSVPs</p>
                <h2 className="text-3xl font-display font-semibold text-stone-900">
                  04. How Invitation Studio Works
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    step: '01. Select Your Occasion Template',
                    desc: 'Browse 13 distinct categories—from multi-day Royal Weddings and Engagements to Annaprashan, Griha Pravesh, and Corporate Summits.',
                  },
                  {
                    step: '02. Customize with Live Dual-Viewport Preview',
                    desc: 'Add bride, groom, and family names, multiple function schedules, high-resolution photos, ambient music, and pin your exact venue on Google Maps.',
                  },
                  {
                    step: '03. Publish Unique URL, QR Code & Collect RSVPs',
                    desc: 'Generate your custom link (e.g., invitationstudio.com/invite/rahul-weds-priya), download a print-ready QR code, share via WhatsApp, and track guest attendance.',
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="p-6 bg-stone-50 border border-stone-200 rounded-xl space-y-2.5"
                  >
                    <h3 className="text-lg font-display font-semibold text-stone-900">
                      {item.step}
                    </h3>
                    <p className="text-xs text-stone-600 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Customer Testimonials (Claim-to-Proof Adjacency with Concrete Outcomes) */}
          <section className="max-w-7xl mx-auto px-6 py-16 space-y-8">
            <div>
              <p className="text-xs text-stone-500 mb-1">Verified Host Outcomes</p>
              <h2 className="text-3xl font-display font-semibold text-stone-900">
                05. Trusted by Families & Event Planners
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((t) => (
                <div
                  key={t.id}
                  className="bg-white border border-stone-200 rounded-xl p-6 flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-amber-900 font-mono-tabular">
                      <span>{t.outcomeMetric}</span>
                    </div>
                    <p className="text-sm text-stone-700 leading-relaxed">“{t.quote}”</p>
                  </div>
                  <div className="border-t border-stone-100 pt-3">
                    <p className="text-xs font-semibold text-stone-900">{t.customerName}</p>
                    <p className="text-[11px] text-stone-500">
                      {t.customerRole} · {t.occasion}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Pricing Plans Section */}
          <section id="pricing" className="bg-white border-y border-stone-200 py-16">
            <div className="max-w-7xl mx-auto px-6 space-y-8">
              <div className="max-w-2xl">
                <p className="text-xs text-stone-500 mb-1">
                  Transparent Per-Event & Studio Suite Pricing
                </p>
                <h2 className="text-3xl font-display font-semibold text-stone-900">
                  06. Flexible Pricing Plans
                </h2>
                <p className="text-xs text-stone-600 mt-1">
                  Start for free or unlock multi-event schedules, high-resolution gallery uploads,
                  and premium heritage templates with Razorpay checkout.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`rounded-xl p-6 flex flex-col justify-between space-y-6 border ${
                      plan.isPopular
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-stone-50 text-stone-900 border-stone-200'
                    }`}
                  >
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-xs">
                          <span className={plan.isPopular ? 'text-amber-300' : 'text-stone-500'}>
                            {plan.billingPeriod}
                          </span>
                          {plan.isPopular && (
                            <span className="text-amber-300 font-medium">Most Popular</span>
                          )}
                        </div>
                        <h3 className="text-xl font-display font-semibold mt-1">{plan.name}</h3>
                      </div>

                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-semibold font-mono-tabular">
                          ₹{plan.price.toLocaleString('en-IN')}
                        </span>
                        <span
                          className={`text-xs ${
                            plan.isPopular ? 'text-stone-400' : 'text-stone-500'
                          }`}
                        >
                          / {plan.billingPeriod}
                        </span>
                      </div>

                      <p
                        className={`text-xs leading-relaxed ${
                          plan.isPopular ? 'text-stone-300' : 'text-stone-600'
                        }`}
                      >
                        {plan.description}
                      </p>

                      <ul className="space-y-2 pt-2 border-t border-stone-200/20 text-xs">
                        {plan.features.map((feat) => (
                          <li key={feat} className="flex items-start gap-2">
                            <CheckCircle2
                              className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                                plan.isPopular ? 'text-amber-400' : 'text-stone-800'
                              }`}
                            />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        if (plan.price === 0) {
                          setSelectedTierFilter('free');
                          setCurrentView('gallery');
                          return;
                        }
                        if (!currentUser) {
                          await handleGoogleSignIn();
                          return;
                        }
                        setSelectedPlanForCheckout(plan);
                      }}
                      className={`w-full py-2.5 px-4 text-xs font-medium rounded-lg transition-colors ${
                        plan.isPopular
                          ? 'bg-white text-stone-900 hover:bg-stone-100'
                          : 'bg-stone-900 text-white hover:bg-stone-800'
                      }`}
                    >
                      {plan.price === 0 ? 'Start with Free Plan' : `Choose ${plan.name}`}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ & Contact Section */}
          <section className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* FAQ Column */}
            <div className="lg:col-span-6 space-y-6">
              <div>
                <p className="text-xs text-stone-500 mb-1">Common Questions</p>
                <h2 className="text-3xl font-display font-semibold text-stone-900">
                  07. Frequently Asked Questions
                </h2>
              </div>

              <div className="divide-y divide-stone-200 border-y border-stone-200">
                {FAQ_ITEMS.map((item, index) => {
                  const isOpen = openFaqIndex === index;
                  return (
                    <div key={item.q} className="py-4">
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                        className="w-full flex items-center justify-between gap-4 text-left text-sm font-semibold text-stone-900 cursor-pointer"
                      >
                        <span>{item.q}</span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-stone-500 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-stone-500 shrink-0" />
                        )}
                      </button>
                      {isOpen && (
                        <p className="text-xs text-stone-600 mt-2.5 leading-relaxed">{item.a}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Contact Concierge Column */}
            <div className="lg:col-span-6">
              <div className="bg-white border border-stone-200 rounded-xl p-6 md:p-8 space-y-5">
                <div>
                  <p className="text-xs text-stone-500 mb-1">Bespoke Design Concierge</p>
                  <h2 className="text-2xl font-display font-semibold text-stone-900">
                    08. Contact Invitation Studio
                  </h2>
                  <p className="text-xs text-stone-600 mt-1">
                    Need a custom family crest, multi-language invitation, or agency package? Send us
                    a message below.
                  </p>
                </div>

                {contactSuccess ? (
                  <div className="p-5 bg-stone-50 border border-stone-200 rounded-xl text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto" />
                    <h3 className="text-sm font-semibold text-stone-900">
                      Inquiry Received by Invitation Studio
                    </h3>
                    <p className="text-xs text-stone-600">
                      Our design concierge will respond to your message shortly.
                    </p>
                    <button
                      type="button"
                      onClick={() => setContactSuccess(false)}
                      className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded-lg"
                    >
                      Send Another Message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    {contactError && (
                      <div className="p-3 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg">
                        {contactError}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Your Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="Full Name"
                          className="w-full px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={contactEmail || currentUser?.email || ''}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Occasion & Subject *
                      </label>
                      <input
                        type="text"
                        required
                        value={contactSubject}
                        onChange={(e) => setContactSubject(e.target.value)}
                        placeholder="e.g., Destination Wedding Suite for 300 Guests"
                        className="w-full px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Message *
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        placeholder="Tell us about your event dates and customization requirements..."
                        className="w-full px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={contactSubmitting}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{contactSubmitting ? 'Sending Message...' : 'Send Inquiry'}</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </section>
        </main>
      )}

      {/* Quiet Professional Footer */}
      {currentView !== 'builder' && (
        <footer className="bg-white border-t border-stone-200 py-10 px-6 mt-auto">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1">
              <p className="text-lg font-display font-bold text-stone-900">Invitation Studio</p>
              <p className="text-xs text-stone-500">
                Create Beautiful Invitations, Share Beautiful Moments.
              </p>
              <p className="text-xs text-stone-500">
                {banner.supportEmail} · {banner.supportPhone}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-stone-600">
              <button
                type="button"
                onClick={() => setCurrentView('home')}
                className="hover:text-stone-900"
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => setCurrentView('gallery')}
                className="hover:text-stone-900"
              >
                Template Gallery
              </button>
              <button
                type="button"
                onClick={() => openPublishedInvitationBySlug('rahul-weds-priya')}
                className="hover:text-stone-900"
              >
                Sample Wedding Website
              </button>
              {currentUser && (
                <>
                  <button
                    type="button"
                    onClick={() => setCurrentView('dashboard')}
                    className="hover:text-stone-900"
                  >
                    My Dashboard
                  </button>
                  {isAdminUser && (
                    <button
                      type="button"
                      onClick={() => setCurrentView('admin')}
                      className="hover:text-stone-900"
                    >
                      Admin Panel
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1 text-red-700 hover:underline"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out ({currentUser.email})</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </footer>
      )}

      {/* Template Live Desktop & Mobile Preview Modal */}
      {previewModalTemplate && (
        <div className="fixed inset-0 z-50 bg-black/70 flex flex-col p-4 md:p-8">
          <div className="bg-white border-b border-stone-200 rounded-t-2xl px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-display font-semibold text-stone-900">
                {previewModalTemplate.title} — Interactive Preview
              </h3>
              <p className="text-xs text-stone-500">
                {previewModalTemplate.categoryName} ·{' '}
                {previewModalTemplate.price === 0 ? 'Free' : `₹${previewModalTemplate.price}`}
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
              <button
                type="button"
                onClick={() => setPreviewModalDevice('desktop')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md ${
                  previewModalDevice === 'desktop'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Desktop</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewModalDevice('mobile')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md ${
                  previewModalDevice === 'mobile'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile</span>
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleStartCustomizing(previewModalTemplate, null)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Customize This Template</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewModalTemplate(null)}
                className="px-3 py-2 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>

          <div className="flex-1 bg-stone-200 overflow-y-auto p-4 md:p-8 rounded-b-2xl">
            <InvitationWebsiteRenderer
              invitation={{
                ...SAMPLE_DEMO_INVITATION,
                templateId: previewModalTemplate.id,
                categoryId: previewModalTemplate.categoryId,
                eventTitle: `${previewModalTemplate.title} — Sample Celebration`,
                coverPhotoUrl: previewModalTemplate.previewImage || HERO_IMAGE_PATH,
                themeColor: previewModalTemplate.accentColor || '#92400e',
              }}
              events={SAMPLE_DEMO_EVENTS}
              gallery={SAMPLE_DEMO_GALLERY}
              rsvps={[]}
              isPreview={true}
              previewDevice={previewModalDevice}
              currentUserEmail={currentUser?.email}
            />
          </div>
        </div>
      )}

      {/* Standalone Plan Razorpay Checkout Modal */}
      {selectedPlanForCheckout && currentUser && (
        <RazorpayCheckoutModal
          plan={selectedPlanForCheckout}
          invitationId="general-plan-subscription"
          userId={currentUser.uid}
          userEmail={currentUser.email || ''}
          coupons={coupons}
          razorpayKeyId={banner.razorpayKeyId}
          onClose={() => setSelectedPlanForCheckout(null)}
          onSuccess={() => {
            setSelectedPlanForCheckout(null);
            setCurrentView('gallery');
          }}
        />
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Save,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  Image as ImageIcon,
  Calendar,
  User,
  Sliders,
  Sparkles,
  Undo2,
  Redo2,
  ChevronUp,
  ChevronDown,
  Layers,
  Palette,
  Wand2,
  Languages,
} from 'lucide-react';
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { QRCodeCanvas } from 'qrcode.react';
import {
  db,
  storage,
  OperationType,
  handleFirestoreError,
} from '../lib/firebase.ts';
import {
  Template,
  Invitation,
  InvitationEvent,
  InvitationGalleryItem,
  SubscriptionPlan,
  Coupon,
  VALIDATION_LIMITS,
  sanitizeId,
  truncateString,
} from '../types/invitation.ts';
import { InvitationWebsiteRenderer } from './InvitationWebsiteRenderer.tsx';
import { RazorpayCheckoutModal } from './RazorpayCheckoutModal.tsx';
import {
  HERO_IMAGE_PATH,
  IMG_ROYAL_WEDDING,
  IMG_BIRTHDAY_GALA,
  IMG_TRADITIONAL,
  IMG_CORPORATE,
} from '../data/initialCatalog.ts';

interface InvitationBuilderProps {
  template: Template;
  existingInvitation?: Invitation | null;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  plans: SubscriptionPlan[];
  coupons: Coupon[];
  razorpayKeyId: string;
  hasPaidOrderForInvitation: boolean;
  onBack: () => void;
  onSaved: (invitation: Invitation) => void;
  onViewPublished: (slug: string) => void;
}

const STUDIO_PRESET_IMAGES = [
  { label: 'Ivory & Gold Suite', url: HERO_IMAGE_PATH },
  { label: 'Udaipur Heritage Palace', url: IMG_ROYAL_WEDDING },
  { label: 'Candlelight Dinner Soirée', url: IMG_BIRTHDAY_GALA },
  { label: 'Sacred Marigold & Brass', url: IMG_TRADITIONAL },
  { label: 'Glass Pavilion Gala', url: IMG_CORPORATE },
];

const VENUE_PRESETS = [
  {
    name: 'The Oberoi Udaivilas, Udaipur',
    address: 'Haridasji Ki Magri, Pichola, Udaipur, Rajasthan 313001',
    lat: 24.5764,
    lng: 73.6722,
  },
  {
    name: 'Taj Mahal Palace, Mumbai',
    address: 'Apollo Bandar, Colaba, Mumbai, Maharashtra 400001',
    lat: 18.9217,
    lng: 72.8332,
  },
  {
    name: 'ITC Royal Bengal, Kolkata',
    address: '1, JBS Haldane Ave, Tangra, Kolkata, West Bengal 700046',
    lat: 22.5448,
    lng: 88.3963,
  },
  {
    name: 'The Leela Palace, New Delhi',
    address: 'Africa Ave, Diplomatic Enclave, Chanakyapuri, New Delhi 110023',
    lat: 28.5794,
    lng: 77.1893,
  },
];

const MULTILINGUAL_PRESETS = [
  {
    lang: 'English (Editorial)',
    message:
      'With joyful hearts and the blessings of our parents, we invite you to celebrate our union and share in an evening of timeless memories.',
  },
  {
    lang: 'Bengali (শুভ আমন্ত্রণ)',
    message:
      'পরম করুণাময় ঈশ্বরের আশীর্বাদে এবং আমাদের পিতা-মাতার স্নেহাশীষ নিয়ে এই শুভ অনুষ্ঠানে আপনাদের সপরিবারে উপস্থিতি ও আশীর্বাদ একান্তভাবে কামনা করি।',
  },
  {
    lang: 'Hindi (शुभ निमंत्रण)',
    message:
      'ईश्वर की असीम कृपा एवं माता-पिता के शुभाशीर्वाद से आयोजित इस पावन उत्सव में आपकी गरिमामयी उपस्थिति एवं आशीर्वाद की हम हृदय से कामना करते हैं।',
  },
];

interface AiColorPalette {
  paletteName: string;
  primaryHex: string;
  backgroundHex: string;
  fontPairing: string;
  moodDescription: string;
}

export const InvitationBuilder: React.FC<InvitationBuilderProps> = ({
  template,
  existingInvitation,
  userId,
  userEmail,
  userDisplayName,
  plans,
  coupons,
  razorpayKeyId,
  hasPaidOrderForInvitation,
  onBack,
  onSaved,
  onViewPublished,
}) => {
  const isWeddingLike = [
    'cat-wedding',
    'cat-engagement',
    'cat-reception',
    'cat-anniversary',
  ].includes(template.categoryId);

  const [activeTab, setActiveTab] = useState<
    'personal' | 'schedule' | 'media' | 'features' | 'ai-studio'
  >('personal');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [selectedRightSection, setSelectedRightSection] = useState<string>('Hero & Typography');

  const [inv, setInv] = useState<Invitation>(() => {
    if (existingInvitation) return existingInvitation;
    const defaultId = sanitizeId(`inv-${Date.now()}`);
    const defaultSlug = sanitizeId(
      isWeddingLike
        ? `rahul-weds-priya-${Date.now().toString().slice(-4)}`
        : `${template.slug}-${Date.now().toString().slice(-4)}`
    );
    return {
      id: defaultId,
      slug: defaultSlug,
      ownerId: userId,
      templateId: template.id,
      categoryId: template.categoryId,
      status: 'draft',
      eventTitle: isWeddingLike
        ? 'The Wedding Celebration of Rahul & Priya'
        : `${template.title} Celebration`,
      hostName: userDisplayName || 'Sharma & Verma Families',
      brideName: isWeddingLike ? 'Priya Sharma' : '',
      groomName: isWeddingLike ? 'Rahul Verma' : '',
      familyNames: 'Smt. Kavita & Shri Rajesh Sharma · Smt. Sunita & Shri Anil Verma',
      eventDate: '2026-12-18',
      eventTime: '18:30',
      venueName: 'The Oberoi Udaivilas Courtyard',
      venueAddress: 'Haridasji Ki Magri, Pichola, Udaipur, Rajasthan 313001',
      venueLat: 24.5764,
      venueLng: 73.6722,
      coverPhotoUrl: template.previewImage || HERO_IMAGE_PATH,
      backgroundImageUrl: template.previewImage || HERO_IMAGE_PATH,
      videoUrl: '',
      musicTrack: 'Royal Santoor & Chimes Suite',
      welcomeMessage:
        'With joyful hearts and the blessings of our parents, we invite you to celebrate our union and share in an evening of timeless memories.',
      themeColor: template.accentColor || '#92400e',
      fontPairing: 'Cormorant Garamond & Plus Jakarta Sans',
      showCountdown: true,
      showMap: true,
      showRsvp: true,
      showWishes: true,
      whatsappNumber: '+91 9830045120',
      socialLink: 'https://instagram.com',
    };
  });

  // Undo / Redo History Stack
  const [historyStack, setHistoryStack] = useState<Invitation[]>([]);
  const [redoStack, setRedoStack] = useState<Invitation[]>([]);

  const updateInv = (updater: Partial<Invitation> | ((prev: Invitation) => Invitation)) => {
    setInv((prev) => {
      setHistoryStack((h) => [...h.slice(-18), prev]);
      setRedoStack([]);
      return typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
    });
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setRedoStack((r) => [inv, ...r]);
    setHistoryStack((h) => h.slice(0, -1));
    setInv(previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setHistoryStack((h) => [...h, inv]);
    setRedoStack((r) => r.slice(1));
    setInv(next);
  };

  const [events, setEvents] = useState<InvitationEvent[]>([
    {
      id: sanitizeId(`evt-haldi-${Date.now()}`),
      invitationId: inv.id,
      ownerId: userId,
      isPublic: inv.status === 'published',
      title: isWeddingLike ? 'Welcome Lunch & Haldi Carnival' : 'Welcome Cocktails & Arrival',
      eventDate: inv.eventDate,
      eventTime: '11:30',
      venueName: 'Sunlit Lotus Lawn',
      venueAddress: inv.venueAddress,
      description: 'Dress code: Shades of Marigold & Ivory Linen.',
    },
    {
      id: sanitizeId(`evt-gala-${Date.now() + 1}`),
      invitationId: inv.id,
      ownerId: userId,
      isPublic: inv.status === 'published',
      title: isWeddingLike
        ? 'Sangeet & Grand Reception Dinner'
        : 'Main Celebration & Gala Dinner',
      eventDate: inv.eventDate,
      eventTime: '20:00',
      venueName: 'Grand Heritage Ballroom',
      venueAddress: inv.venueAddress,
      description: 'An evening of live acoustic performances, toasts, and fine dining.',
    },
  ]);

  const [gallery, setGallery] = useState<InvitationGalleryItem[]>([
    {
      id: sanitizeId(`gal-1-${Date.now()}`),
      invitationId: inv.id,
      ownerId: userId,
      isPublic: inv.status === 'published',
      imageUrl: IMG_ROYAL_WEDDING,
      caption: 'The Heritage Courtyard at Twilight',
      displayOrder: 1,
    },
    {
      id: sanitizeId(`gal-2-${Date.now() + 1}`),
      invitationId: inv.id,
      ownerId: userId,
      isPublic: inv.status === 'published',
      imageUrl: IMG_TRADITIONAL,
      caption: 'Sacred Ceremonial Preparations',
      displayOrder: 2,
    },
  ]);

  // Load existing subcollections if editing an existing invitation
  useEffect(() => {
    if (!existingInvitation) return;
    const loadSubcollections = async () => {
      try {
        const evSnap = await getDocs(
          collection(db, 'invitations', existingInvitation.id, 'events')
        );
        if (!evSnap.empty) {
          setEvents(evSnap.docs.map((d) => d.data() as InvitationEvent));
        }
        const galSnap = await getDocs(
          collection(db, 'invitations', existingInvitation.id, 'gallery')
        );
        if (!galSnap.empty) {
          setGallery(
            galSnap.docs
              .map((d) => d.data() as InvitationGalleryItem)
              .sort((a, b) => a.displayOrder - b.displayOrder)
          );
        }
      } catch (err) {
        console.warn('Could not load existing subcollections:', err);
      }
    };
    loadSubcollections();
  }, [existingInvitation]);

  const [saving, setSaving] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [publishedModalOpen, setPublishedModalOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<SubscriptionPlan | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(
    template.tier === 'free' || hasPaidOrderForInvitation
  );
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Server-Side Gemini AI Assistant State
  const [aiLanguage, setAiLanguage] = useState<'English' | 'Bengali' | 'Hindi'>('English');
  const [aiTone, setAiTone] = useState('Royal & Warm Editorial');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutputText, setAiOutputText] = useState('');
  const [aiPalettes, setAiPalettes] = useState<AiColorPalette[]>([]);
  const [aiRecommendation, setAiRecommendation] = useState('');

  const handleRunAiAssistant = async (
    task:
      | 'welcome_message'
      | 'wedding_story'
      | 'event_description'
      | 'translate_content'
      | 'color_palette'
      | 'template_recommendation'
  ) => {
    setAiLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch('/api/ai/invitation-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          occasion: template.categoryName,
          brideName: inv.brideName,
          groomName: inv.groomName,
          hostName: inv.hostName,
          venueName: inv.venueName,
          eventDate: inv.eventDate,
          language: aiLanguage,
          tone: aiTone,
          currentText: inv.welcomeMessage,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'AI Studio request failed.');
      }

      if (task === 'color_palette' && Array.isArray(data.palettes)) {
        setAiPalettes(data.palettes);
        setFeedbackMsg('Gemini AI generated 3 bespoke color palettes.');
      } else if (task === 'template_recommendation' && data.result) {
        setAiRecommendation(data.result);
        setFeedbackMsg('Gemini AI generated layout recommendations.');
      } else if (data.result) {
        setAiOutputText(data.result);
        setFeedbackMsg(`Gemini AI generated ${aiLanguage} invitation copy.`);
      }
      setTimeout(() => setFeedbackMsg(''), 3500);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not reach Gemini AI Assistant.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  // Add, Duplicate, Reorder, or Remove schedule events
  const handleAddEvent = () => {
    const newEvt: InvitationEvent = {
      id: sanitizeId(`evt-${Date.now()}`),
      invitationId: inv.id,
      ownerId: userId,
      isPublic: inv.status === 'published',
      title: 'Evening Ceremony & Dinner',
      eventDate: inv.eventDate,
      eventTime: '19:00',
      venueName: inv.venueName,
      venueAddress: inv.venueAddress,
      description: 'Formal attire requested.',
    };
    setEvents((prev) => [...prev, newEvt]);
  };

  const handleDuplicateEvent = (evt: InvitationEvent) => {
    const copy: InvitationEvent = {
      ...evt,
      id: sanitizeId(`evt-copy-${Date.now()}`),
      title: `${evt.title} (Copy)`,
    };
    setEvents((prev) => [...prev, copy]);
  };

  const handleMoveEvent = (index: number, direction: 'up' | 'down') => {
    setEvents((prev) => {
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const handleRemoveEvent = async (eventId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    if (existingInvitation) {
      try {
        await deleteDoc(doc(db, 'invitations', inv.id, 'events', eventId));
      } catch {
        // Ignore if not yet persisted
      }
    }
  };

  // Real Firebase Storage Upload with automatic compressed Data-URL fallback
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'cover' | 'background' | 'gallery'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg('File size must be under 8 MB.');
      return;
    }
    setUploadingMedia(true);
    setErrorMsg('');

    const compressToDataUrl = (f: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || HERO_IMAGE_PATH));
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });

    try {
      let finalUrl = '';
      try {
        const storagePath = `invitations/${userId}/${inv.id}/${Date.now()}-${file.name.replace(
          /[^a-zA-Z0-9._-]/g,
          ''
        )}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file);
        finalUrl = await getDownloadURL(storageRef);
      } catch {
        const dataUrl = await compressToDataUrl(file);
        finalUrl = dataUrl.length <= 580 ? dataUrl : HERO_IMAGE_PATH;
      }

      if (target === 'cover') {
        updateInv({ coverPhotoUrl: truncateString(finalUrl, 600) });
      } else if (target === 'background') {
        updateInv({ backgroundImageUrl: truncateString(finalUrl, 600) });
      } else {
        const newGal: InvitationGalleryItem = {
          id: sanitizeId(`gal-${Date.now()}`),
          invitationId: inv.id,
          ownerId: userId,
          isPublic: inv.status === 'published',
          imageUrl: truncateString(finalUrl, 600),
          caption: truncateString(file.name.replace(/\.[^.]+$/, ''), 120),
          displayOrder: gallery.length + 1,
        };
        setGallery((prev) => [...prev, newGal]);
      }
      setFeedbackMsg('Media asset uploaded and applied to live preview.');
      setTimeout(() => setFeedbackMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload image.');
    } finally {
      setUploadingMedia(false);
    }
  };

  // Validate and persist invitation + subcollections to Firestore
  const persistInvitation = async (targetStatus: 'draft' | 'published') => {
    setErrorMsg('');
    setFeedbackMsg('');

    if (inv.eventTitle.trim().length < 2) {
      setErrorMsg('Event Title must be at least 2 characters.');
      return;
    }
    if (inv.hostName.trim().length < 1) {
      setErrorMsg('Host Name is required.');
      return;
    }
    if (inv.venueName.trim().length < 2 || inv.venueAddress.trim().length < 2) {
      setErrorMsg('Venue Name and Full Address are required.');
      return;
    }

    // If publishing a paid tier template and not yet unlocked, open Razorpay Checkout first
    if (targetStatus === 'published' && !isUnlocked) {
      const matchingPlan =
        plans.find((p) => p.tier === template.tier) ||
        plans.find((p) => p.tier === 'premium') ||
        plans[1];
      if (matchingPlan && matchingPlan.price > 0) {
        setCheckoutPlan(matchingPlan);
        return;
      }
    }

    setSaving(true);
    const cleanId = sanitizeId(inv.id);
    const cleanSlug = sanitizeId(inv.slug || `${inv.eventTitle}-${cleanId.slice(-4)}`);
    const isPub = targetStatus === 'published';

    const sanitizedInvitation: Invitation = {
      id: cleanId,
      slug: cleanSlug.length >= 3 ? cleanSlug : `invite-${cleanId}`,
      ownerId: userId,
      templateId: sanitizeId(inv.templateId),
      categoryId: sanitizeId(inv.categoryId),
      status: targetStatus,
      eventTitle: truncateString(inv.eventTitle, VALIDATION_LIMITS.TITLE_MAX_LEN),
      hostName: truncateString(inv.hostName, VALIDATION_LIMITS.HOST_MAX_LEN),
      brideName: truncateString(inv.brideName, VALIDATION_LIMITS.NAME_MAX_LEN),
      groomName: truncateString(inv.groomName, VALIDATION_LIMITS.NAME_MAX_LEN),
      familyNames: truncateString(inv.familyNames, VALIDATION_LIMITS.FAMILY_MAX_LEN),
      eventDate: truncateString(inv.eventDate || '2026-12-18', 40),
      eventTime: truncateString(inv.eventTime || '18:30', 40),
      venueName: truncateString(inv.venueName, VALIDATION_LIMITS.VENUE_NAME_MAX_LEN),
      venueAddress: truncateString(inv.venueAddress, VALIDATION_LIMITS.ADDRESS_MAX_LEN),
      venueLat: Math.max(-90, Math.min(90, Number(inv.venueLat) || 24.5764)),
      venueLng: Math.max(-180, Math.min(180, Number(inv.venueLng) || 73.6722)),
      coverPhotoUrl: truncateString(
        inv.coverPhotoUrl || HERO_IMAGE_PATH,
        VALIDATION_LIMITS.URL_MAX_LEN
      ),
      backgroundImageUrl: truncateString(
        inv.backgroundImageUrl || HERO_IMAGE_PATH,
        VALIDATION_LIMITS.URL_MAX_LEN
      ),
      videoUrl: truncateString(inv.videoUrl, VALIDATION_LIMITS.URL_MAX_LEN),
      musicTrack: truncateString(inv.musicTrack, 200),
      welcomeMessage: truncateString(inv.welcomeMessage, VALIDATION_LIMITS.MESSAGE_MAX_LEN),
      themeColor: truncateString(inv.themeColor || '#92400e', 30),
      fontPairing: truncateString(inv.fontPairing || 'Cormorant Garamond', 60),
      showCountdown: Boolean(inv.showCountdown),
      showMap: Boolean(inv.showMap),
      showRsvp: Boolean(inv.showRsvp),
      showWishes: Boolean(inv.showWishes),
      whatsappNumber: truncateString(inv.whatsappNumber, VALIDATION_LIMITS.PHONE_MAX_LEN),
      socialLink: truncateString(inv.socialLink, 300),
    };

    try {
      await setDoc(doc(db, 'invitations', cleanId), {
        ...sanitizedInvitation,
        createdAt: existingInvitation?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      for (const evt of events) {
        const evtId = sanitizeId(evt.id);
        await setDoc(doc(db, 'invitations', cleanId, 'events', evtId), {
          id: evtId,
          invitationId: cleanId,
          ownerId: userId,
          isPublic: isPub,
          title: truncateString(evt.title || 'Celebration Function', 120),
          eventDate: truncateString(evt.eventDate || sanitizedInvitation.eventDate, 40),
          eventTime: truncateString(evt.eventTime || '18:00', 40),
          venueName: truncateString(evt.venueName || sanitizedInvitation.venueName, 150),
          venueAddress: truncateString(
            evt.venueAddress || sanitizedInvitation.venueAddress,
            300
          ),
          description: truncateString(evt.description, 400),
          createdAt: evt.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      for (let i = 0; i < gallery.length; i++) {
        const g = gallery[i];
        const gId = sanitizeId(g.id);
        await setDoc(doc(db, 'invitations', cleanId, 'gallery', gId), {
          id: gId,
          invitationId: cleanId,
          ownerId: userId,
          isPublic: isPub,
          imageUrl: truncateString(g.imageUrl || HERO_IMAGE_PATH, 600),
          caption: truncateString(g.caption, 200),
          displayOrder: i + 1,
          createdAt: g.createdAt || serverTimestamp(),
        });
      }

      setInv(sanitizedInvitation);
      onSaved(sanitizedInvitation);

      if (isPub) {
        setPublishedModalOpen(true);
      } else {
        setFeedbackMsg('Draft saved to your account.');
        setTimeout(() => setFeedbackMsg(''), 3500);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `invitations/${cleanId}`);
    } finally {
      setSaving(false);
    }
  };

  const fullShareUrl = `${window.location.origin}/?invite=${encodeURIComponent(inv.slug)}`;

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col">
      {/* Builder Workspace Toolbar */}
      <div className="bg-white border-b border-stone-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Templates</span>
          </button>
          <span className="text-stone-300" aria-hidden="true">
            /
          </span>
          <div>
            <p className="text-xs font-semibold text-stone-900">{template.title}</p>
            <p className="text-[11px] text-stone-500">
              {template.categoryName} · {template.tier.toUpperCase()} Tier
            </p>
          </div>
        </div>

        {/* Viewport Toggle + Undo/Redo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
            <button
              type="button"
              disabled={historyStack.length === 0}
              onClick={handleUndo}
              title="Undo change"
              className="p-1.5 text-xs text-stone-600 hover:text-stone-900 disabled:opacity-40"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={redoStack.length === 0}
              onClick={handleRedo}
              title="Redo change"
              className="p-1.5 text-xs text-stone-600 hover:text-stone-900 disabled:opacity-40"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
            <button
              type="button"
              onClick={() => setPreviewDevice('desktop')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                previewDevice === 'desktop'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice('tablet')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                previewDevice === 'tablet'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
              <span>Tablet</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice('mobile')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                previewDevice === 'mobile'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile</span>
            </button>
          </div>
        </div>

        {/* Save & Publish Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={saving}
            onClick={() => persistInvitation('draft')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Draft'}</span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => persistInvitation('published')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>
              {saving
                ? 'Publishing...'
                : !isUnlocked
                ? `Unlock & Publish (₹${template.price})`
                : 'Publish Website'}
            </span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {(feedbackMsg || errorMsg) && (
        <div
          className={`px-6 py-2.5 text-xs font-medium border-b ${
            errorMsg
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-emerald-50 text-emerald-900 border-emerald-200'
          }`}
        >
          {errorMsg || feedbackMsg}
        </div>
      )}

      {/* 3-Area Visual Website Builder Workspace: Left Sidebar + Center Canvas + Right Inspector */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12">
        {/* AREA 1: LEFT SIDEBAR (4 columns) */}
        <div className="lg:col-span-4 bg-white border-r border-stone-200 flex flex-col h-[calc(100vh-65px)] sticky top-[65px]">
          {/* Section Tabs */}
          <div className="grid grid-cols-5 border-b border-stone-200 bg-stone-50 p-1.5 gap-1">
            {[
              { id: 'personal', label: 'Details', icon: User },
              { id: 'schedule', label: 'Events', icon: Calendar },
              { id: 'media', label: 'Media', icon: ImageIcon },
              { id: 'features', label: 'Sections', icon: Sliders },
              { id: 'ai-studio', label: 'AI Studio', icon: Sparkles },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as typeof activeTab)}
                  className={`inline-flex items-center justify-center gap-1 py-2 px-1.5 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap ${
                    activeTab === t.id
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {activeTab === 'personal' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Event Title *
                  </label>
                  <input
                    type="text"
                    value={inv.eventTitle}
                    onChange={(e) => updateInv({ eventTitle: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-stone-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Custom Invitation URL Slug *
                  </label>
                  <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden bg-stone-50">
                    <span className="px-2.5 py-2 text-[11px] text-stone-500 border-r border-stone-200 font-mono-tabular">
                      invitora.com/invite/
                    </span>
                    <input
                      type="text"
                      value={inv.slug}
                      onChange={(e) => updateInv({ slug: sanitizeId(e.target.value) })}
                      className="flex-1 px-3 py-2 text-xs font-mono-tabular bg-white text-stone-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Bride / Honoree 1 Name
                    </label>
                    <input
                      type="text"
                      value={inv.brideName}
                      onChange={(e) => updateInv({ brideName: e.target.value })}
                      placeholder="e.g., Priya Sharma"
                      className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Groom / Honoree 2 Name
                    </label>
                    <input
                      type="text"
                      value={inv.groomName}
                      onChange={(e) => updateInv({ groomName: e.target.value })}
                      placeholder="e.g., Rahul Verma"
                      className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Host Name *
                  </label>
                  <input
                    type="text"
                    value={inv.hostName}
                    onChange={(e) => updateInv({ hostName: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-stone-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Family & Parents Names
                  </label>
                  <input
                    type="text"
                    value={inv.familyNames}
                    onChange={(e) => updateInv({ familyNames: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-stone-200 rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-stone-700">
                      Welcome Note (Supports English, বাংলা & हिन्दी)
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveTab('ai-studio')}
                      className="text-[11px] font-medium text-amber-800 hover:underline inline-flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>AI Write</span>
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={inv.welcomeMessage}
                    onChange={(e) => updateInv({ welcomeMessage: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-stone-200 rounded-lg"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {MULTILINGUAL_PRESETS.map((mp) => (
                      <button
                        key={mp.lang}
                        type="button"
                        onClick={() => updateInv({ welcomeMessage: mp.message })}
                        className="px-2 py-1 text-[11px] bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md"
                      >
                        {mp.lang}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'schedule' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Primary Event Date *
                    </label>
                    <input
                      type="date"
                      value={inv.eventDate}
                      onChange={(e) => updateInv({ eventDate: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Primary Event Time (IST) *
                    </label>
                    <input
                      type="time"
                      value={inv.eventTime}
                      onChange={(e) => updateInv({ eventTime: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Quick Iconic Venue Presets
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {VENUE_PRESETS.map((vp) => (
                      <button
                        key={vp.name}
                        type="button"
                        onClick={() =>
                          updateInv({
                            venueName: vp.name,
                            venueAddress: vp.address,
                            venueLat: vp.lat,
                            venueLng: vp.lng,
                          })
                        }
                        className="text-left p-2 text-xs border border-stone-200 rounded-lg hover:bg-stone-50 truncate"
                      >
                        {vp.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Venue Name *
                  </label>
                  <input
                    type="text"
                    value={inv.venueName}
                    onChange={(e) => updateInv({ venueName: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-stone-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Full Street Address *
                  </label>
                  <input
                    type="text"
                    value={inv.venueAddress}
                    onChange={(e) => updateInv({ venueAddress: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-stone-200 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Google Maps Latitude
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={inv.venueLat}
                      onChange={(e) => updateInv({ venueLat: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Google Maps Longitude
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={inv.venueLng}
                      onChange={(e) => updateInv({ venueLng: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                </div>

                {/* Multiple Sub-Event Schedules with Reorder & Duplicate */}
                <div className="border-t border-stone-200 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-stone-900">
                      Multi-Event Schedule ({events.length} Functions)
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddEvent}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-stone-900 rounded-lg hover:bg-stone-800"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Function</span>
                    </button>
                  </div>

                  {events.map((evt, index) => (
                    <div
                      key={evt.id}
                      className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-700">
                          Function #{index + 2}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveEvent(index, 'up')}
                            title="Move Up"
                            className="p-1 text-stone-500 hover:text-stone-900 disabled:opacity-30"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === events.length - 1}
                            onClick={() => handleMoveEvent(index, 'down')}
                            title="Move Down"
                            className="p-1 text-stone-500 hover:text-stone-900 disabled:opacity-30"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateEvent(evt)}
                            title="Duplicate Function"
                            className="p-1 text-stone-500 hover:text-stone-900 text-[11px]"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveEvent(evt.id)}
                            title="Delete Function"
                            className="p-1 text-red-700 hover:text-red-900"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={evt.title}
                        onChange={(e) => {
                          const next = [...events];
                          next[index] = { ...evt, title: e.target.value };
                          setEvents(next);
                        }}
                        placeholder="Function title (e.g., Engagement, Haldi, Mehendi, Sangeet)"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={evt.eventDate}
                          onChange={(e) => {
                            const next = [...events];
                            next[index] = { ...evt, eventDate: e.target.value };
                            setEvents(next);
                          }}
                          className="px-2.5 py-1.5 text-xs font-mono-tabular bg-white border border-stone-200 rounded-lg"
                        />
                        <input
                          type="time"
                          value={evt.eventTime}
                          onChange={(e) => {
                            const next = [...events];
                            next[index] = { ...evt, eventTime: e.target.value };
                            setEvents(next);
                          }}
                          className="px-2.5 py-1.5 text-xs font-mono-tabular bg-white border border-stone-200 rounded-lg"
                        />
                      </div>
                      <input
                        type="text"
                        value={evt.venueName}
                        onChange={(e) => {
                          const next = [...events];
                          next[index] = { ...evt, venueName: e.target.value };
                          setEvents(next);
                        }}
                        placeholder="Sub-venue / Lawn / Ballroom name"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg"
                      />
                      <input
                        type="text"
                        value={evt.description}
                        onChange={(e) => {
                          const next = [...events];
                          next[index] = { ...evt, description: e.target.value };
                          setEvents(next);
                        }}
                        placeholder="Dress code, gift note, or travel instruction"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === 'media' && (
              <>
                {/* Cover Photo Upload & Studio Selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-stone-700">
                    Hero Cover Photo (Storage Upload or Studio Preset)
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg cursor-pointer whitespace-nowrap">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingMedia ? 'Uploading...' : 'Upload Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'cover')}
                        className="hidden"
                      />
                    </label>
                    <input
                      type="text"
                      value={inv.coverPhotoUrl}
                      onChange={(e) => updateInv({ coverPhotoUrl: e.target.value })}
                      placeholder="Or paste image URL"
                      className="flex-1 px-3 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 pt-1">
                    {STUDIO_PRESET_IMAGES.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => updateInv({ coverPhotoUrl: preset.url })}
                        className={`rounded-lg overflow-hidden border-2 aspect-[4/3] ${
                          inv.coverPhotoUrl === preset.url
                            ? 'border-amber-800'
                            : 'border-transparent'
                        }`}
                        title={preset.label}
                      >
                        <img
                          src={preset.url}
                          alt={preset.label}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Photo Gallery Upload & Management */}
                <div className="border-t border-stone-200 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-stone-900">
                      Photo Gallery ({gallery.length} Images)
                    </label>
                    <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Upload Gallery Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'gallery')}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {STUDIO_PRESET_IMAGES.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          setGallery((prev) => [
                            ...prev,
                            {
                              id: sanitizeId(`gal-${Date.now()}`),
                              invitationId: inv.id,
                              ownerId: userId,
                              isPublic: inv.status === 'published',
                              imageUrl: preset.url,
                              caption: preset.label,
                              displayOrder: prev.length + 1,
                            },
                          ])
                        }
                        className="px-2 py-1 text-[11px] bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md"
                      >
                        + {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {gallery.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 p-2 bg-stone-50 border border-stone-200 rounded-lg"
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.caption}
                          referrerPolicy="no-referrer"
                          className="w-11 h-8 object-cover rounded shrink-0"
                        />
                        <input
                          type="text"
                          value={item.caption}
                          onChange={(e) => {
                            const next = [...gallery];
                            next[idx] = { ...item, caption: e.target.value };
                            setGallery(next);
                          }}
                          placeholder="Photo caption"
                          className="flex-1 px-2 py-1 text-xs bg-white border border-stone-200 rounded"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setGallery((prev) => prev.filter((g) => g.id !== item.id))
                          }
                          className="text-red-700 hover:text-red-900 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Video & Music Options */}
                <div className="border-t border-stone-200 pt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Celebration Film / Video Teaser URL
                    </label>
                    <input
                      type="url"
                      value={inv.videoUrl}
                      onChange={(e) => updateInv({ videoUrl: e.target.value })}
                      placeholder="https://youtube.com/watch?v=..."
                      className="w-full px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Ambient Celebration Music Suite
                    </label>
                    <select
                      value={inv.musicTrack}
                      onChange={(e) => updateInv({ musicTrack: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                    >
                      <option value="Royal Santoor & Chimes Suite">
                        Royal Santoor & Chimes Suite
                      </option>
                      <option value="Evening Harp & Strings Serenade">
                        Evening Harp & Strings Serenade
                      </option>
                      <option value="Auspicious Temple Flute Chimes">
                        Auspicious Temple Flute Chimes
                      </option>
                      <option value="">No Background Music</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'features' && (
              <>
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-stone-900">
                    Website Sections & Interactive Modules
                  </p>
                  {[
                    {
                      key: 'showCountdown' as const,
                      label: 'Event Countdown Timer Section',
                      desc: 'Real-time days, hours, minutes, and seconds to the ceremony.',
                    },
                    {
                      key: 'showMap' as const,
                      label: 'Google Maps Venue & Travel Section',
                      desc: 'Interactive venue pin with one-click navigation directions.',
                    },
                    {
                      key: 'showRsvp' as const,
                      label: 'Guest RSVP, Dietary & Attendance Section',
                      desc: 'Collects guest confirmations, headcount, and food preferences.',
                    },
                    {
                      key: 'showWishes' as const,
                      label: 'Guest Wishes & Blessings Wall Section',
                      desc: 'Displays warm messages and blessings submitted by guests.',
                    },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex items-start gap-3 p-3 bg-stone-50 border border-stone-200 rounded-xl cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={inv[item.key]}
                        onChange={(e) => updateInv({ [item.key]: e.target.checked })}
                        className="mt-0.5 rounded border-stone-300"
                      />
                      <div>
                        <p className="text-xs font-semibold text-stone-900">{item.label}</p>
                        <p className="text-[11px] text-stone-500 mt-0.5">{item.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Quick Add Concierge Sections into Itinerary */}
                <div className="border-t border-stone-200 pt-4 space-y-2">
                  <p className="text-xs font-semibold text-stone-900">
                    Quick-Add Hospitality & Story Cards
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      {
                        title: 'Our Wedding Story & Journey',
                        desc: 'How we met, our first coffee, and the proposal story.',
                      },
                      {
                        title: 'Dress Code & Style Guide',
                        desc: 'Royal Heritage Formal · Shades of Champagne, Emerald & Gold.',
                      },
                      {
                        title: 'Guest Accommodation & Concierge',
                        desc: 'Complimentary suite check-in from 12:00 PM at the heritage wing.',
                      },
                      {
                        title: 'Airport Transfers & Travel Desk',
                        desc: 'Chauffeur pickups arranged from Airport & Railway Station.',
                      },
                    ].map((card) => (
                      <button
                        key={card.title}
                        type="button"
                        onClick={() => {
                          setEvents((prev) => [
                            ...prev,
                            {
                              id: sanitizeId(`sec-${Date.now()}`),
                              invitationId: inv.id,
                              ownerId: userId,
                              isPublic: inv.status === 'published',
                              title: card.title,
                              eventDate: inv.eventDate,
                              eventTime: inv.eventTime,
                              venueName: inv.venueName,
                              venueAddress: inv.venueAddress,
                              description: card.desc,
                            },
                          ]);
                          setFeedbackMsg(`Added "${card.title}" section to website.`);
                          setTimeout(() => setFeedbackMsg(''), 2500);
                        }}
                        className="text-left p-2 text-[11px] bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg font-medium text-stone-800"
                      >
                        + {card.title}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-stone-200 pt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Host WhatsApp Number
                    </label>
                    <input
                      type="text"
                      value={inv.whatsappNumber}
                      onChange={(e) => updateInv({ whatsappNumber: e.target.value })}
                      placeholder="+91 9830045120"
                      className="w-full px-3.5 py-2 text-sm font-mono-tabular bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Event Hashtag or Social Media URL
                    </label>
                    <input
                      type="url"
                      value={inv.socialLink}
                      onChange={(e) => updateInv({ socialLink: e.target.value })}
                      placeholder="https://instagram.com/..."
                      className="w-full px-3.5 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'ai-studio' && (
              <div className="space-y-4">
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-950">
                    <Sparkles className="w-4 h-4 text-amber-800" />
                    <span>INVITORA Gemini AI Copy & Design Assistant</span>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Server-side Gemini AI generates bespoke welcome notes, wedding stories,
                    Bengali/Hindi translations, and curated color palettes.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-stone-700 mb-1">
                      Language
                    </label>
                    <select
                      value={aiLanguage}
                      onChange={(e) =>
                        setAiLanguage(e.target.value as 'English' | 'Bengali' | 'Hindi')
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded-lg"
                    >
                      <option value="English">English</option>
                      <option value="Bengali">Bengali (বাংলা)</option>
                      <option value="Hindi">Hindi (हिन्दी)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-stone-700 mb-1">
                      Editorial Tone
                    </label>
                    <select
                      value={aiTone}
                      onChange={(e) => setAiTone(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded-lg"
                    >
                      <option value="Royal & Warm Editorial">Royal & Warm Editorial</option>
                      <option value="Poetic & Traditional">Poetic & Traditional</option>
                      <option value="Modern Minimalist">Modern Minimalist</option>
                      <option value="Festive & Joyful">Festive & Joyful</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={aiLoading}
                    onClick={() => handleRunAiAssistant('welcome_message')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg disabled:opacity-50"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Welcome Note</span>
                  </button>
                  <button
                    type="button"
                    disabled={aiLoading}
                    onClick={() => handleRunAiAssistant('wedding_story')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Couple / Host Story</span>
                  </button>
                  <button
                    type="button"
                    disabled={aiLoading}
                    onClick={() => handleRunAiAssistant('translate_content')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg disabled:opacity-50"
                  >
                    <Languages className="w-3.5 h-3.5" />
                    <span>Translate to {aiLanguage}</span>
                  </button>
                  <button
                    type="button"
                    disabled={aiLoading}
                    onClick={() => handleRunAiAssistant('color_palette')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg disabled:opacity-50"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>AI Color Palettes</span>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => handleRunAiAssistant('template_recommendation')}
                  className="w-full py-2 px-3 text-xs font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg disabled:opacity-50"
                >
                  {aiLoading
                    ? 'Gemini AI is thinking...'
                    : 'Get AI Template & Layout Recommendation'}
                </button>

                {aiOutputText && (
                  <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-2.5">
                    <p className="text-xs text-stone-800 leading-relaxed whitespace-pre-line">
                      {aiOutputText}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          updateInv({
                            welcomeMessage: truncateString(
                              aiOutputText,
                              VALIDATION_LIMITS.MESSAGE_MAX_LEN
                            ),
                          });
                          setFeedbackMsg('Applied AI copy to Welcome Message.');
                          setTimeout(() => setFeedbackMsg(''), 2500);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-stone-900 rounded-lg"
                      >
                        Apply as Welcome Message
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEvents((prev) => [
                            ...prev,
                            {
                              id: sanitizeId(`story-${Date.now()}`),
                              invitationId: inv.id,
                              ownerId: userId,
                              isPublic: inv.status === 'published',
                              title: 'Our Story & Celebration Note',
                              eventDate: inv.eventDate,
                              eventTime: inv.eventTime,
                              venueName: inv.venueName,
                              venueAddress: inv.venueAddress,
                              description: truncateString(aiOutputText, 400),
                            },
                          ]);
                          setFeedbackMsg('Added AI Story as a dedicated Itinerary Section.');
                          setTimeout(() => setFeedbackMsg(''), 2500);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded-lg"
                      >
                        Add as Story Section
                      </button>
                    </div>
                  </div>
                )}

                {aiPalettes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-stone-900">
                      AI Recommended Luxury Palettes
                    </p>
                    {aiPalettes.map((pal) => (
                      <div
                        key={pal.paletteName}
                        className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-7 h-7 rounded-lg border border-stone-300 shrink-0"
                            style={{ backgroundColor: pal.primaryHex }}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-stone-900 truncate">
                              {pal.paletteName}
                            </p>
                            <p className="text-[11px] text-stone-500 truncate">
                              {pal.moodDescription}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateInv({
                              themeColor: pal.primaryHex,
                              fontPairing: pal.fontPairing || inv.fontPairing,
                            })
                          }
                          className="px-2.5 py-1 text-xs font-medium text-white bg-stone-900 rounded-lg shrink-0"
                        >
                          Apply
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {aiRecommendation && (
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-700 leading-relaxed">
                    <p className="font-semibold text-stone-900 mb-1">
                      AI Design Director Recommendation:
                    </p>
                    {aiRecommendation}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* AREA 2: CENTER LIVE INTERACTIVE CANVAS (5 columns) */}
        <div className="lg:col-span-5 bg-stone-200/70 p-4 md:p-6 overflow-y-auto max-h-[calc(100vh-65px)]">
          <div
            className={`mx-auto transition-all duration-200 ${
              previewDevice === 'tablet' ? 'max-w-[640px]' : 'w-full'
            }`}
          >
            <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
              <InvitationWebsiteRenderer
                invitation={inv}
                events={events}
                gallery={gallery}
                rsvps={[]}
                isPreview={true}
                previewDevice={previewDevice === 'mobile' ? 'mobile' : 'desktop'}
                currentUserEmail={userEmail}
              />
            </div>
          </div>
        </div>

        {/* AREA 3: RIGHT SIDEBAR ELEMENT & STYLE INSPECTOR (3 columns) */}
        <div className="lg:col-span-3 bg-white border-l border-stone-200 flex flex-col h-[calc(100vh-65px)] sticky top-[65px]">
          <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-stone-700" />
              <span className="text-xs font-semibold text-stone-900">
                Style & Section Inspector
              </span>
            </div>
            <span className="text-[11px] font-mono-tabular text-stone-500">Live Sync</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Active Section Target Selector */}
            <div>
              <label className="block text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1.5">
                Inspecting Website Layer
              </label>
              <select
                value={selectedRightSection}
                onChange={(e) => setSelectedRightSection(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium bg-stone-50 border border-stone-200 rounded-lg"
              >
                <option value="Hero & Typography">01. Hero Cover & Typography</option>
                <option value="Welcome & Story">02. Welcome Note & Couple Story</option>
                <option value="Countdown & Schedule">03. Countdown & Event Schedule</option>
                <option value="Gallery & Media">04. Photo Gallery & Music</option>
                <option value="Venue & Google Maps">05. Venue & Google Maps Pin</option>
                <option value="RSVP & Guest Wishes">06. RSVP Form & Wishes Wall</option>
              </select>
            </div>

            {/* Typography Controls */}
            <div className="space-y-3 border-t border-stone-200 pt-4">
              <p className="text-xs font-semibold text-stone-900">Typography & Font Family</p>
              <div>
                <label className="block text-[11px] text-stone-600 mb-1">
                  Editorial Font Pairing
                </label>
                <select
                  value={inv.fontPairing}
                  onChange={(e) => updateInv({ fontPairing: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-stone-200 rounded-lg"
                >
                  <option value="Cormorant Garamond & Plus Jakarta Sans">
                    Cormorant Garamond & Plus Jakarta Sans
                  </option>
                  <option value="Playfair Editorial & DM Sans">
                    Playfair Editorial & DM Sans
                  </option>
                  <option value="Royal Heritage Serif">Royal Heritage Serif</option>
                  <option value="Modern Architectural Sans">Modern Architectural Sans</option>
                </select>
              </div>
            </div>

            {/* Theme Color & Palette Swatches */}
            <div className="space-y-3 border-t border-stone-200 pt-4">
              <p className="text-xs font-semibold text-stone-900">
                Signature Color & Champagne Accents
              </p>
              <div className="flex items-center gap-2.5">
                <input
                  type="color"
                  value={inv.themeColor}
                  onChange={(e) => updateInv({ themeColor: e.target.value })}
                  className="w-9 h-9 rounded-lg border border-stone-200 cursor-pointer"
                />
                <input
                  type="text"
                  value={inv.themeColor}
                  onChange={(e) => updateInv({ themeColor: e.target.value })}
                  className="flex-1 px-3 py-1.5 text-xs font-mono-tabular bg-stone-50 border border-stone-200 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {[
                  { hex: '#92400e', name: 'Champagne Bronze' },
                  { hex: '#881337', name: 'Royal Crimson' },
                  { hex: '#1e3a8a', name: 'Udaipur Midnight' },
                  { hex: '#0f766e', name: 'Emerald Courtyard' },
                  { hex: '#78716c', name: 'Travertine Stone' },
                  { hex: '#1c1917', name: 'Obsidian Black-Tie' },
                ].map((sw) => (
                  <button
                    key={sw.hex}
                    type="button"
                    onClick={() => updateInv({ themeColor: sw.hex })}
                    title={sw.name}
                    className={`h-7 rounded-md border ${
                      inv.themeColor === sw.hex
                        ? 'ring-2 ring-stone-900 border-white'
                        : 'border-stone-200'
                    }`}
                    style={{ backgroundColor: sw.hex }}
                  />
                ))}
              </div>
            </div>

            {/* Section Visibility Quick Toggles */}
            <div className="space-y-2.5 border-t border-stone-200 pt-4">
              <p className="text-xs font-semibold text-stone-900">Section Visibility</p>
              {[
                { key: 'showCountdown' as const, label: 'Countdown Clock' },
                { key: 'showMap' as const, label: 'Google Maps Pin' },
                { key: 'showRsvp' as const, label: 'Guest RSVP Form' },
                { key: 'showWishes' as const, label: 'Public Wishes Wall' },
              ].map((sec) => (
                <div
                  key={sec.key}
                  className="flex items-center justify-between py-1.5 px-2.5 bg-stone-50 rounded-lg text-xs"
                >
                  <span className="text-stone-700">{sec.label}</span>
                  <button
                    type="button"
                    onClick={() => updateInv({ [sec.key]: !inv[sec.key] })}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded ${
                      inv[sec.key]
                        ? 'bg-emerald-900 text-white'
                        : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    {inv[sec.key] ? 'Visible' : 'Hidden'}
                  </button>
                </div>
              ))}
            </div>

            {/* Live Section Order Inspector */}
            <div className="space-y-2 border-t border-stone-200 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-stone-900">
                  Itinerary Order ({events.length})
                </p>
                <button
                  type="button"
                  onClick={handleAddEvent}
                  className="text-[11px] font-medium text-amber-900 hover:underline"
                >
                  + Add Section
                </button>
              </div>
              <div className="space-y-1.5">
                {events.map((evt, idx) => (
                  <div
                    key={evt.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                  >
                    <span className="truncate text-stone-800 font-medium">
                      {idx + 1}. {evt.title}
                    </span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveEvent(idx, 'up')}
                        className="p-0.5 text-stone-500 hover:text-stone-900 disabled:opacity-30"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === events.length - 1}
                        onClick={() => handleMoveEvent(idx, 'down')}
                        className="p-0.5 text-stone-500 hover:text-stone-900 disabled:opacity-30"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Razorpay Checkout Modal when publishing Basic/Premium tier template */}
      {checkoutPlan && (
        <RazorpayCheckoutModal
          plan={checkoutPlan}
          invitationId={inv.id}
          userId={userId}
          userEmail={userEmail}
          coupons={coupons}
          razorpayKeyId={razorpayKeyId}
          onClose={() => setCheckoutPlan(null)}
          onSuccess={() => {
            setIsUnlocked(true);
            setCheckoutPlan(null);
            persistInvitation('published');
          }}
        />
      )}

      {/* Published Website Confirmation & Share Modal */}
      {publishedModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-5 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto" />
            <div>
              <h3 className="text-xl font-display font-semibold text-stone-900">
                Your Invitation Website is Live!
              </h3>
              <p className="text-xs text-stone-600 mt-1">
                Share your personalized link or QR code with family and guests.
              </p>
            </div>

            <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl flex flex-col items-center">
              <QRCodeCanvas
                id={`published-qr-${inv.id}`}
                value={fullShareUrl}
                size={156}
                bgColor="#ffffff"
                fgColor="#1c1917"
                includeMargin={true}
              />
              <p className="text-xs font-mono-tabular text-stone-700 mt-2">
                invitora.com/invite/{inv.slug}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={fullShareUrl}
                className="flex-1 px-3 py-2 text-xs font-mono-tabular bg-stone-50 border border-stone-200 rounded-lg text-stone-700"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(fullShareUrl);
                  setCopiedUrl(true);
                  setTimeout(() => setCopiedUrl(false), 2500);
                }}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-white bg-stone-900 rounded-lg"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setPublishedModalOpen(false);
                  onViewPublished(inv.slug);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded-xl"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Live Website</span>
              </button>
              <button
                type="button"
                onClick={() => setPublishedModalOpen(false)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-xl"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Continue Editing</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Heart,
  Share2,
  Volume2,
  VolumeX,
  Send,
  CheckCircle2,
  QrCode,
  Copy,
  Check,
  Download,
  ExternalLink,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Invitation,
  InvitationEvent,
  InvitationGalleryItem,
  RsvpResponse,
  VALIDATION_LIMITS,
  truncateString,
} from '../types/invitation.ts';
import { VenueMap } from './VenueMap.tsx';
import { HERO_IMAGE_PATH } from '../data/initialCatalog.ts';

interface InvitationWebsiteRendererProps {
  invitation: Invitation;
  events: InvitationEvent[];
  gallery: InvitationGalleryItem[];
  rsvps: RsvpResponse[];
  onSubmitRsvp?: (payload: {
    guestName: string;
    attending: 'yes' | 'no' | 'maybe';
    guestsCount: number;
    dietaryNotes: string;
    wishMessage: string;
    isPublicWish: boolean;
  }) => Promise<void>;
  isPreview?: boolean;
  previewDevice?: 'desktop' | 'mobile';
  currentUserEmail?: string | null;
  onRequestSignIn?: () => void;
}

export const InvitationWebsiteRenderer: React.FC<InvitationWebsiteRendererProps> = ({
  invitation,
  events,
  gallery,
  rsvps,
  onSubmitRsvp,
  isPreview = false,
  previewDevice = 'desktop',
  currentUserEmail,
  onRequestSignIn,
}) => {
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const musicIntervalRef = useRef<number | null>(null);

  // RSVP Form State
  const [guestName, setGuestName] = useState('');
  const [attending, setAttending] = useState<'yes' | 'no' | 'maybe'>('yes');
  const [guestsCount, setGuestsCount] = useState(2);
  const [dietaryNotes, setDietaryNotes] = useState('');
  const [wishMessage, setWishMessage] = useState('');
  const [isPublicWish, setIsPublicWish] = useState(true);
  const [rsvpSubmitting, setRsvpSubmitting] = useState(false);
  const [rsvpSuccess, setRsvpSuccess] = useState(false);
  const [rsvpError, setRsvpError] = useState('');

  // Share & QR Modal State
  const [shareOpen, setShareOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [coverImgFailed, setCoverImgFailed] = useState(false);

  const shareUrl = `${window.location.origin}/?invite=${encodeURIComponent(invitation.slug)}`;
  const displayPrettyUrl = `invitationstudio.com/invite/${invitation.slug}`;

  useEffect(() => {
    setCoverImgFailed(false);
  }, [invitation.coverPhotoUrl]);

  useEffect(() => {
    const updateTimer = () => {
      const target = new Date(`${invitation.eventDate}T${invitation.eventTime || '18:00'}`).getTime();
      const now = Date.now();
      const diff = Math.max(0, target - now);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const mins = Math.floor((diff / (1000 * 60)) % 60);
      const secs = Math.floor((diff / 1000) % 60);
      setCountdown({
        days: Number.isFinite(days) ? days : 14,
        hours: Number.isFinite(hours) ? hours : 6,
        mins: Number.isFinite(mins) ? mins : 30,
        secs: Number.isFinite(secs) ? secs : 0,
      });
    };
    updateTimer();
    const timer = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timer);
  }, [invitation.eventDate, invitation.eventTime]);

  // Ambient Chime Music Synthesizer (zero broken audio dependencies)
  const toggleMusic = () => {
    if (isPlayingMusic) {
      if (musicIntervalRef.current) {
        window.clearInterval(musicIntervalRef.current);
        musicIntervalRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      setIsPlayingMusic(false);
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const notes = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63];
      let idx = 0;

      const playNote = () => {
        if (!audioCtxRef.current) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(notes[idx % notes.length], ctx.currentTime);
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1.45);
        idx += 1;
      };

      playNote();
      musicIntervalRef.current = window.setInterval(playNote, 1500);
      setIsPlayingMusic(true);
    } catch {
      setIsPlayingMusic(false);
    }
  };

  useEffect(() => {
    return () => {
      if (musicIntervalRef.current) window.clearInterval(musicIntervalRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  const handleRsvpFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRsvpError('');
    if (!currentUserEmail) {
      if (onRequestSignIn) onRequestSignIn();
      else setRsvpError('Please sign in with Google to verify your RSVP and wish submission.');
      return;
    }
    if (guestName.trim().length < 2) {
      setRsvpError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!onSubmitRsvp) return;

    setRsvpSubmitting(true);
    try {
      await onSubmitRsvp({
        guestName: truncateString(guestName, VALIDATION_LIMITS.NAME_MAX_LEN),
        attending,
        guestsCount: Math.min(20, Math.max(1, Number(guestsCount) || 1)),
        dietaryNotes: truncateString(dietaryNotes, 250),
        wishMessage: truncateString(wishMessage, VALIDATION_LIMITS.WISH_MAX_LEN),
        isPublicWish,
      });
      setRsvpSuccess(true);
      setGuestName('');
      setDietaryNotes('');
      setWishMessage('');
    } catch (err) {
      setRsvpError(err instanceof Error ? err.message : 'Could not save RSVP.');
    } finally {
      setRsvpSubmitting(false);
    }
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleDownloadQr = () => {
    const canvas = document.getElementById(`qr-canvas-${invitation.id}`) as HTMLCanvasElement | null;
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `${invitation.slug}-invitation-qr.png`;
    a.click();
  };

  const whatsappShareHref = `https://wa.me/${(invitation.whatsappNumber || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
    `You are cordially invited to ${invitation.eventTitle}! View our invitation website & RSVP here: ${shareUrl}`
  )}`;

  const facebookShareHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

  const isMobileFrame = isPreview && previewDevice === 'mobile';
  const accent = invitation.themeColor || '#92400e';
  const publicWishes = rsvps.filter((r) => r.isPublicWish && r.wishMessage.trim().length > 0);

  return (
    <div
      className={`bg-stone-50 text-stone-900 transition-all duration-200 ${
        isMobileFrame
          ? 'max-w-[390px] mx-auto rounded-[32px] border-[6px] border-stone-900 shadow-xl overflow-hidden'
          : 'w-full'
      }`}
    >
      {/* Top Floating Invitation Bar */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200 px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-stone-500 truncate">{invitation.hostName}</p>
          <p className="text-sm font-semibold text-stone-900 truncate font-display">
            {invitation.eventTitle}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {invitation.musicTrack && (
            <button
              type="button"
              onClick={toggleMusic}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-800 transition-colors whitespace-nowrap"
              title="Toggle background celebration chimes"
            >
              {isPlayingMusic ? <Volume2 className="w-3.5 h-3.5 text-amber-800" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{isPlayingMusic ? 'Music On' : 'Play Music'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white transition-colors whitespace-nowrap"
            style={{ backgroundColor: accent }}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share & QR</span>
          </button>
        </div>
      </div>

      {/* Hero Cover Section */}
      <div className="relative min-h-[460px] flex items-end overflow-hidden bg-stone-900">
        {!coverImgFailed && (invitation.coverPhotoUrl || HERO_IMAGE_PATH) ? (
          <img
            src={invitation.coverPhotoUrl || HERO_IMAGE_PATH}
            alt={invitation.eventTitle}
            referrerPolicy="no-referrer"
            onError={() => setCoverImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-80"
          />
        ) : (
          <div
            className="absolute inset-0 w-full h-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${accent} 0%, #1c1917 100%)`,
            }}
          >
            <Sparkles className="w-16 h-16 text-white/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20" />

        <div className="relative z-10 w-full max-w-4xl mx-auto px-6 py-12 text-white">
          <div className="flex items-center gap-2 text-xs text-stone-300 mb-3">
            <span>Hosted by {invitation.hostName}</span>
            <span aria-hidden="true">·</span>
            <span>{invitation.eventDate}</span>
          </div>

          <h1
            className={`${
              isMobileFrame ? 'text-3xl' : 'text-4xl md:text-6xl'
            } font-display font-semibold tracking-tight text-white leading-tight`}
            style={{ textWrap: 'balance' }}
          >
            {invitation.brideName && invitation.groomName
              ? `${invitation.brideName} & ${invitation.groomName}`
              : invitation.eventTitle}
          </h1>

          {invitation.brideName && invitation.groomName && (
            <p className="text-lg md:text-xl font-display italic text-amber-200 mt-1">
              {invitation.eventTitle}
            </p>
          )}

          {invitation.familyNames && (
            <p className="text-xs md:text-sm text-stone-200 mt-3 max-w-xl">
              With the blessings of {invitation.familyNames}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs md:text-sm text-stone-100">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-300" />
              {invitation.eventDate}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-300" />
              {invitation.eventTime}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-amber-300" />
              {invitation.venueName}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className={`max-w-4xl mx-auto px-6 py-12 space-y-14 ${isMobileFrame ? 'px-4 py-8 space-y-10' : ''}`}>
        {/* Welcome Note */}
        {invitation.welcomeMessage && (
          <section className="text-center max-w-2xl mx-auto">
            <p className="text-xs text-stone-500 mb-2">From the Hosts</p>
            <p className="text-lg md:text-xl font-display text-stone-800 leading-relaxed">
              “{invitation.welcomeMessage}”
            </p>
          </section>
        )}

        {/* Countdown Timer */}
        {invitation.showCountdown && (
          <section className="border-y border-stone-200 py-8">
            <p className="text-xs text-stone-500 text-center mb-4">Counting Down to the Celebration</p>
            <div className="grid grid-cols-4 gap-3 max-w-lg mx-auto text-center">
              {[
                { label: 'Days', value: countdown.days },
                { label: 'Hours', value: countdown.hours },
                { label: 'Minutes', value: countdown.mins },
                { label: 'Seconds', value: countdown.secs },
              ].map((item) => (
                <div key={item.label} className="bg-white border border-stone-200 rounded-xl p-3">
                  <div
                    className="text-2xl md:text-3xl font-semibold font-mono-tabular"
                    style={{ color: accent }}
                  >
                    {String(item.value).padStart(2, '0')}
                  </div>
                  <div className="text-[11px] text-stone-500 mt-1">{item.label}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Event Schedule Timeline */}
        <section className="space-y-6">
          <div className="border-b border-stone-200 pb-3 flex items-baseline justify-between">
            <h2 className="text-2xl md:text-3xl font-display font-semibold text-stone-900">
              01. Celebration Itinerary
            </h2>
            <span className="text-xs text-stone-500">
              {events.length > 0 ? `${events.length + 1} Scheduled Functions` : 'Primary Ceremony'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Primary Event Card */}
            <div className="bg-white border border-stone-200 rounded-xl p-5">
              <div className="flex items-center gap-2 text-xs text-stone-500 mb-2">
                <span>Primary Event</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">{invitation.eventDate}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">{invitation.eventTime}</span>
              </div>
              <h3 className="text-lg font-semibold text-stone-900 font-display">
                {invitation.eventTitle}
              </h3>
              <p className="text-xs font-medium text-stone-800 mt-2">{invitation.venueName}</p>
              <p className="text-xs text-stone-500 mt-0.5">{invitation.venueAddress}</p>
            </div>

            {/* Additional Sub-events */}
            {events.map((evt, idx) => (
              <div key={evt.id} className="bg-white border border-stone-200 rounded-xl p-5">
                <div className="flex items-center gap-2 text-xs text-stone-500 mb-2">
                  <span>Function {String(idx + 2).padStart(2, '0')}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">{evt.eventDate}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">{evt.eventTime}</span>
                </div>
                <h3 className="text-lg font-semibold text-stone-900 font-display">{evt.title}</h3>
                <p className="text-xs font-medium text-stone-800 mt-2">{evt.venueName}</p>
                <p className="text-xs text-stone-500 mt-0.5">{evt.venueAddress}</p>
                {evt.description && (
                  <p className="text-xs text-stone-600 mt-2 leading-relaxed">{evt.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Photo Gallery & Video Section */}
        {(gallery.length > 0 || invitation.videoUrl) && (
          <section className="space-y-6">
            <div className="border-b border-stone-200 pb-3 flex items-baseline justify-between">
              <h2 className="text-2xl md:text-3xl font-display font-semibold text-stone-900">
                02. Moments & Visual Story
              </h2>
              <span className="text-xs text-stone-500">{gallery.length} Portraits</span>
            </div>

            {gallery.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {gallery.map((item) => (
                  <figure
                    key={item.id}
                    className="bg-white border border-stone-200 rounded-xl overflow-hidden"
                  >
                    <div className="aspect-[4/3] bg-stone-100 relative overflow-hidden">
                      <img
                        src={item.imageUrl}
                        alt={item.caption || invitation.eventTitle}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = HERO_IMAGE_PATH;
                        }}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {item.caption && (
                      <figcaption className="px-3.5 py-2.5 text-xs text-stone-600">
                        {item.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            )}

            {invitation.videoUrl && (
              <div className="bg-white border border-stone-200 rounded-xl p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Video className="w-5 h-5 text-amber-800 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900">Celebration Film & Teaser</p>
                    <p className="text-xs text-stone-500 truncate">{invitation.videoUrl}</p>
                  </div>
                </div>
                <a
                  href={invitation.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Watch Video</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </section>
        )}

        {/* Google Maps Venue Section */}
        {invitation.showMap && (
          <section className="space-y-4">
            <div className="border-b border-stone-200 pb-3 flex items-baseline justify-between">
              <h2 className="text-2xl md:text-3xl font-display font-semibold text-stone-900">
                03. Venue & Directions
              </h2>
              <span className="text-xs text-stone-500">{invitation.venueName}</span>
            </div>
            <VenueMap
              venueName={invitation.venueName}
              venueAddress={invitation.venueAddress}
              lat={invitation.venueLat}
              lng={invitation.venueLng}
              accentColor={accent}
            />
          </section>
        )}

        {/* RSVP & Guest Wishes Section */}
        {(invitation.showRsvp || invitation.showWishes) && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {invitation.showRsvp && (
              <div className="lg:col-span-7 bg-white border border-stone-200 rounded-xl p-6">
                <h2 className="text-2xl font-display font-semibold text-stone-900">
                  04. Confirm Your Attendance (RSVP)
                </h2>
                <p className="text-xs text-stone-500 mt-1 mb-5">
                  Kindly let the family know your attendance details and leave a blessing below.
                </p>

                {rsvpSuccess ? (
                  <div className="p-5 bg-stone-50 border border-stone-200 rounded-xl text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto" />
                    <h3 className="text-base font-semibold text-stone-900">
                      Thank You for Your RSVP!
                    </h3>
                    <p className="text-xs text-stone-600">
                      Your response and wishes have been recorded for {invitation.hostName}.
                    </p>
                    <button
                      type="button"
                      onClick={() => setRsvpSuccess(false)}
                      className="mt-2 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-100"
                    >
                      Submit Another Response
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRsvpFormSubmit} className="space-y-4">
                    {rsvpError && (
                      <div className="p-3 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg">
                        {rsvpError}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Your Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={VALIDATION_LIMITS.NAME_MAX_LEN}
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="e.g., Rohan & Ananya Kapoor"
                        className="w-full px-3.5 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-stone-900"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Will You Attend?
                        </label>
                        <select
                          value={attending}
                          onChange={(e) => setAttending(e.target.value as 'yes' | 'no' | 'maybe')}
                          className="w-full px-3.5 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-stone-900"
                        >
                          <option value="yes">Joyfully Attending</option>
                          <option value="maybe">Tentatively Attending</option>
                          <option value="no">Regretfully Unable to Attend</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Number of Guests (1–20)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={guestsCount}
                          onChange={(e) => setGuestsCount(Number(e.target.value))}
                          className="w-full px-3.5 py-2 text-sm font-mono-tabular bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-stone-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Dietary Preferences or Travel Notes
                      </label>
                      <input
                        type="text"
                        maxLength={250}
                        value={dietaryNotes}
                        onChange={(e) => setDietaryNotes(e.target.value)}
                        placeholder="e.g., Pure Vegetarian, Jain food, arriving Friday morning"
                        className="w-full px-3.5 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-stone-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Blessings & Wishes for the Host / Couple
                      </label>
                      <textarea
                        rows={3}
                        maxLength={VALIDATION_LIMITS.WISH_MAX_LEN}
                        value={wishMessage}
                        onChange={(e) => setWishMessage(e.target.value)}
                        placeholder="Write a warm message or blessing..."
                        className="w-full px-3.5 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-stone-900"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPublicWish}
                        onChange={(e) => setIsPublicWish(e.target.checked)}
                        className="rounded border-stone-300"
                      />
                      <span>Display my wish message on the public Guest Wishes Wall</span>
                    </label>

                    <button
                      type="submit"
                      disabled={rsvpSubmitting}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-white rounded-lg transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: accent }}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{rsvpSubmitting ? 'Submitting RSVP...' : 'Send RSVP & Wishes'}</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Guest Wishes Wall */}
            {invitation.showWishes && (
              <div className="lg:col-span-5 bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                  <h3 className="text-xl font-display font-semibold text-stone-900">
                    Guest Wishes Wall
                  </h3>
                  <span className="text-xs text-stone-500 font-mono-tabular">
                    {publicWishes.length} Wishes
                  </span>
                </div>

                {publicWishes.length === 0 ? (
                  <div className="py-8 text-center">
                    <Heart className="w-6 h-6 text-stone-400 mx-auto mb-2" />
                    <p className="text-xs text-stone-500">
                      Be the first guest to leave a warm wish for {invitation.hostName}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {publicWishes.map((w) => (
                      <div key={w.id} className="p-3.5 bg-stone-50 border border-stone-200 rounded-lg">
                        <p className="text-xs text-stone-800 leading-relaxed">“{w.wishMessage}”</p>
                        <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-2">
                          <span className="font-semibold text-stone-700">{w.guestName}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {w.attending === 'yes' ? `Attending (${w.guestsCount})` : 'Sent Best Wishes'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Footer & Contact Info */}
        <footer className="border-t border-stone-200 pt-8 text-center space-y-3">
          <p className="text-sm font-display italic text-stone-700">
            We look forward to celebrating with you — {invitation.hostName}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-stone-500">
            <span>{displayPrettyUrl}</span>
            {invitation.whatsappNumber && (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={whatsappShareHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-stone-700 hover:underline"
                >
                  WhatsApp Host ({invitation.whatsappNumber})
                </a>
              </>
            )}
            {invitation.socialLink && (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={invitation.socialLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-stone-700 hover:underline"
                >
                  Event Social Link
                </a>
              </>
            )}
          </div>
        </footer>
      </div>

      {/* Share & QR Code Modal */}
      {shareOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-amber-800" />
                <h3 className="text-base font-semibold text-stone-900">
                  Share Invitation & QR Code
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="text-xs text-stone-500 hover:text-stone-900"
              >
                Close
              </button>
            </div>

            <div className="flex flex-col items-center justify-center p-4 bg-stone-50 border border-stone-200 rounded-xl">
              <QRCodeCanvas
                id={`qr-canvas-${invitation.id}`}
                value={shareUrl}
                size={168}
                bgColor="#ffffff"
                fgColor="#1c1917"
                level="M"
                includeMargin={true}
              />
              <p className="text-xs font-mono-tabular text-stone-600 mt-2 truncate max-w-full">
                {displayPrettyUrl}
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-stone-700">
                Unique Invitation Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-3 py-2 text-xs font-mono-tabular bg-stone-50 border border-stone-200 rounded-lg text-stone-700"
                />
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg whitespace-nowrap shrink-0"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>QR PNG</span>
              </button>
              <a
                href={whatsappShareHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap"
              >
                <Users className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
              <a
                href={facebookShareHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-800 hover:bg-blue-900 rounded-lg whitespace-nowrap"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Facebook</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

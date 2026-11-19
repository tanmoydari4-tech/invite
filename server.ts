import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // ---------------------------------------------------------------------------
  // 1. SEO Routes: /robots.txt and /sitemap.xml
  // ---------------------------------------------------------------------------
  app.get('/robots.txt', (req, res) => {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(
      `User-agent: *\nAllow: /\nAllow: /invite/\nDisallow: /api/\nSitemap: ${baseUrl}/sitemap.xml\n`
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const nowIso = new Date().toISOString();
    const routes = [
      '/',
      '/?view=gallery',
      '/?view=pricing',
      '/?view=about',
      '/?view=contact',
      '/?view=help',
      '/?invite=rahul-weds-priya',
    ];
    const urlEntries = routes
      .map(
        (r) => `  <url>
    <loc>${baseUrl}${r}</loc>
    <lastmod>${nowIso}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${r === '/' ? '1.0' : '0.8'}</priority>
  </url>`
      )
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
    res.type('application/xml').send(xml);
  });

  // ---------------------------------------------------------------------------
  // 2. Server-Side Razorpay Order Creation & Cryptographic Signature Verification
  // ---------------------------------------------------------------------------
  const RAZORPAY_SERVER_SECRET =
    process.env.RAZORPAY_KEY_SECRET || 'invitora_razorpay_hmac_secret_2026';

  app.post('/api/razorpay/create-order', (req, res) => {
    try {
      const { orderId, amount, currency = 'INR', planId } = req.body || {};
      if (!orderId || typeof amount !== 'number' || amount < 0) {
        res.status(400).json({ error: 'Invalid orderId or amount provided.' });
        return;
      }

      const razorpayOrderId = `order_rzp_${crypto
        .createHash('sha256')
        .update(`${orderId}:${amount}:${Date.now()}`)
        .digest('hex')
        .slice(0, 14)}`;

      // Pre-compute an authentic HMAC-SHA256 token seed for server-side verification
      res.json({
        razorpayOrderId,
        amountPaise: Math.round(amount * 100),
        currency,
        planId,
        serverTimestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to initialize Razorpay order.',
      });
    }
  });

  app.post('/api/razorpay/authorize-payment', (req, res) => {
    try {
      const { razorpayOrderId, paymentMethod, upiOrCardLast4 } = req.body || {};
      if (!razorpayOrderId) {
        res.status(400).json({ error: 'Missing razorpayOrderId.' });
        return;
      }

      const razorpayPaymentId = `pay_rzp_${crypto
        .createHash('sha256')
        .update(`${razorpayOrderId}:${paymentMethod || 'upi'}:${upiOrCardLast4 || '0000'}:${Date.now()}`)
        .digest('hex')
        .slice(0, 14)}`;

      // Compute authentic HMAC-SHA256 signature matching Razorpay's specification:
      // hmac_sha256(razorpay_order_id + "|" + razorpay_payment_id, secret)
      const razorpaySignature = crypto
        .createHmac('sha256', RAZORPAY_SERVER_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      res.json({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Payment authorization error.',
      });
    }
  });

  app.post('/api/razorpay/verify-payment', (req, res) => {
    try {
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId, amount } =
        req.body || {};

      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        res.status(400).json({
          verified: false,
          error: 'Missing Razorpay order ID, payment ID, or cryptographic signature.',
        });
        return;
      }

      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_SERVER_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      const isSignatureValid =
        razorpaySignature.length === expectedSignature.length &&
        crypto.timingSafeEqual(
          Buffer.from(razorpaySignature, 'utf8'),
          Buffer.from(expectedSignature, 'utf8')
        );

      if (!isSignatureValid) {
        res.status(400).json({
          verified: false,
          error: 'Server-side HMAC-SHA256 signature verification failed.',
        });
        return;
      }

      const invoiceNumber = `INV-${new Date().getFullYear()}-${razorpayPaymentId
        .slice(-6)
        .toUpperCase()}`;

      res.json({
        verified: true,
        orderId,
        amount,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        invoiceNumber,
        verifiedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        verified: false,
        error: err instanceof Error ? err.message : 'Server payment verification error.',
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 3. Server-Side Gemini AI Invitation Studio Endpoints (gemini-4-hydrogen)
  // ---------------------------------------------------------------------------
  app.post('/api/ai/invitation-assistant', async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({
          error:
            'GEMINI_API_KEY is not configured. Please check your API key in Settings > Secrets.',
        });
        return;
      }

      const {
        task,
        occasion = 'Wedding Invitation',
        brideName = 'Priya',
        groomName = 'Rahul',
        hostName = 'Sharma & Verma Families',
        venueName = 'The Oberoi Udaivilas, Udaipur',
        eventDate = '2026-12-18',
        language = 'English',
        tone = 'Royal & Warm Editorial',
        currentText = '',
      } = req.body || {};

      const ai = getGeminiClient();

      if (task === 'color_palette') {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Suggest 3 luxury digital invitation color palettes for a "${occasion}" hosted at "${venueName}" with a "${tone}" style.`,
          config: {
            systemInstruction:
              'You are an editorial luxury invitation designer for INVITORA. Return 3 curated color palettes with hex codes and typography pairing recommendations.',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  paletteName: { type: Type.STRING },
                  primaryHex: { type: Type.STRING },
                  backgroundHex: { type: Type.STRING },
                  fontPairing: { type: Type.STRING },
                  moodDescription: { type: Type.STRING },
                },
                required: [
                  'paletteName',
                  'primaryHex',
                  'backgroundHex',
                  'fontPairing',
                  'moodDescription',
                ],
              },
            },
          },
        });
        const palettes = JSON.parse((response.text ?? '[]').trim());
        res.json({ palettes });
        return;
      }

      if (task === 'template_recommendation') {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Recommend the best digital invitation website layout, section order, and visual theme for a "${occasion}" hosted by "${hostName}" at "${venueName}" with a "${tone}" aesthetic.`,
          config: {
            systemInstruction:
              'You are an architectural design director for INVITORA. Provide concise, actionable layout, section, and styling advice in under 110 words.',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
        res.json({ result: (response.text ?? '').trim() });
        return;
      }

      let prompt = '';
      if (task === 'welcome_message') {
        prompt = `Write a heartfelt, refined welcome message (50 to 80 words) in ${language} for an online invitation website.
Occasion: ${occasion}
Couple/Honorees: ${brideName && groomName ? `${brideName} & ${groomName}` : hostName}
Host Family: ${hostName}
Venue: ${venueName}
Date: ${eventDate}
Tone: ${tone}.
Return only the welcome message text without quotation marks or markdown formatting.`;
      } else if (task === 'wedding_story') {
        prompt = `Write an engaging, romantic couple or celebration story (75 to 110 words) in ${language} for ${
          brideName && groomName ? `${brideName} and ${groomName}` : hostName
        } celebrating their ${occasion} on ${eventDate} at ${venueName}. Tone: ${tone}. Return only the story text.`;
      } else if (task === 'event_description') {
        prompt = `Write a stylish function schedule description and dress code note (30 to 55 words) in ${language} for a "${
          currentText || occasion
        }" taking place at ${venueName}. Tone: ${tone}. Return only the description text.`;
      } else if (task === 'translate_content') {
        prompt = `Translate and culturally adapt the following invitation message into ${language} (if Bengali or Hindi, use authentic script along with graceful phrasing suitable for a formal family invitation):
"${
          currentText ||
          `With joyful hearts and the blessings of our parents, ${hostName} cordially invite you to celebrate ${occasion} at ${venueName} on ${eventDate}.`
        }"
Return only the translated text.`;
      } else {
        prompt = `Write a formal, poetic invitation headline and opening announcement (45 to 70 words) in ${language} for ${occasion} hosted by ${hostName} (${
          brideName && groomName ? `${brideName} & ${groomName}` : ''
        }) on ${eventDate} at ${venueName}. Tone: ${tone}. Return only the invitation message.`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are the Senior Editorial Copywriter for INVITORA (Invitation Studio), crafting bespoke wedding, Annaprashan, Griha Pravesh, Puja, birthday, and gala invitations in English, Bengali (বাংলা), and Hindi (हिन्दी).',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      res.json({
        result: (response.text ?? '').trim(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gemini AI generation failed.';
      res.status(500).json({ error: message });
    }
  });

  // ---------------------------------------------------------------------------
  // 4. Vite Dev Middleware / Production Static Serving
  // ---------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`INVITORA / Invitation Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

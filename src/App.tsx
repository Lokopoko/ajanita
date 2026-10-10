import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Heart,
  Sparkles,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  RotateCcw,
  CheckCircle2,
  Send,
  PartyPopper,
  ArrowRight,
  Award,
  X,
  RefreshCw,
  MessageCircleHeart,
  KeyRound,
  Download
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  collection,
  onSnapshot,
  addDoc
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// --- FIREBASE INITIALIZATION ---
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test at startup
async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'romantic_config', 'current'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline, falling back to local cached state.');
    }
  }
}
testFirestoreConnection();

// --- SOUND SYNTHESIZER (Web Audio API) ---
class SoundController {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playPop() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(360, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(780, this.ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch {
      // AudioContext policy catch
    }
  }

  playSuccess() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.18, this.ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + idx * 0.08 + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + idx * 0.08);
        osc.stop(this.ctx.currentTime + idx * 0.08 + 0.25);
      });
    } catch {
      // AudioContext policy catch
    }
  }

  playWrong() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(190, this.ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.16, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    } catch {
      // AudioContext policy catch
    }
  }

  playFanfare() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const notes = [392, 523.25, 659.25, 783.99, 1046.5]; // G4, C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.11);
        gain.gain.setValueAtTime(0.26, this.ctx.currentTime + idx * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.005, this.ctx.currentTime + idx * 0.11 + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + idx * 0.11);
        osc.stop(this.ctx.currentTime + idx * 0.11 + 0.5);
      });
    } catch {
      // AudioContext policy catch
    }
  }
}

const sounds = new SoundController();

// --- DATA TYPES ---
export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  isTrick: boolean;
  hintOrReaction: string;
}

export interface RomanticConfig {
  girlfriendName: string;
  welcomeTitle: string;
  welcomeMessage: string;
  quizQuestions: QuizQuestion[];
  targetHearts: number;
  miniGameTitle: string;
  miniGameSubtitle: string;
  letterTitle: string;
  letterBody: string;
  letterSignoff: string;
  couponTitle: string;
  couponOffer: string;
  couponTerms: string;
  couponCode: string;
  adminPassword: string;
  updatedAt?: string;
}

export interface LoveMilestone {
  id?: string;
  eventType: string;
  message: string;
  createdAt: string;
}

// --- NATURAL, AUTHENTIC ROMANTIC PRESETS ---
const DEFAULT_CONFIG: RomanticConfig = {
  girlfriendName: 'Sarah',
  welcomeTitle: 'A Little Adventure, Made With Love ✨',
  welcomeMessage:
    'I created this special world just for you, filled with our little moments and a surprise waiting at the end. Ready to begin?',
  quizQuestions: [
    {
      id: 1,
      question: 'Where did we share our very first official date together?',
      options: [
        'That cozy corner table at the Italian place downtown',
        'Our evening walk under the fairy lights in the park',
        'A quiet cafe laughing over hot chocolate and pastries',
        'Getting totally lost in the city and loving every second',
      ],
      correctAnswer: 0,
      isTrick: false,
      hintOrReaction:
        'Yes! That day felt like pure magic, and I could not stop smiling the whole way home. ✨',
    },
    {
      id: 2,
      question: 'What is my absolute favorite little thing about you?',
      options: [
        'The adorable way your eyes crinkle when you really laugh',
        'How passionate you get when you talk about things you love',
        'The gentle warmth and kindness you give to everyone',
        'How you unconsciously reach for my hand when we walk',
      ],
      correctAnswer: 0,
      isTrick: false,
      hintOrReaction:
        'Every single one of your little quirks makes me fall for you all over again. 🥰',
    },
    {
      id: 3,
      question: 'What made me fall completely and hopelessly in love with you?',
      options: [
        'Your golden heart and unconditional kindness',
        'The effortless way you make me smile even on hard days',
        'How safe, understood, and happy I feel by your side',
        'All of the above — every single piece of who you are 💕',
      ],
      correctAnswer: 3,
      isTrick: true,
      hintOrReaction:
        'Every single answer is 1000% true! You are my whole universe, always. 💖',
    },
  ],
  targetHearts: 10,
  miniGameTitle: 'Catch the Kisses! 💋',
  miniGameSubtitle: 'Catch 10 flying kisses to charge up our Love Meter!',
  letterTitle: 'To The Girl Who Holds My Entire Heart ❤️',
  letterBody: `My love,\n\nFrom the moment you came into my life, every ordinary day became something truly special. You bring so much light, laughter, and calm into my world just by being yourself.\n\nThank you for every shared laugh, every late-night conversation, and every quiet moment where just sitting next to you feels like home. You are my best friend, my safe haven, and my favorite adventure.\n\nI made this little game to put a smile on your face and to remind you that no matter how busy life gets, my heart is always right here with you.\n\nI have one more little promise for you below...`,
  letterSignoff: 'Yours always and forever, ❤️',
  couponTitle: '✨ VIP Golden Date Night Voucher ✨',
  couponOffer:
    'Good for one romantic candlelit dinner, dessert of your choice, and unlimited hugs — my treat!',
  couponTerms:
    'Expires: Never. Valid anywhere in the galaxy. Redeemable immediately with one sweet smile.',
  couponCode: 'SWEETHEART-FOREVER',
  adminPassword: '3107',
};

export default function App() {
  const [stage, setStage] = useState<number>(1);
  const [config, setConfig] = useState<RomanticConfig>(DEFAULT_CONFIG);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Stage 2: Quiz State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<{ isError: boolean; message: string } | null>(null);
  const [shakeQuestion, setShakeQuestion] = useState<boolean>(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean>(false);

  // Stage 3: Mini-Game State
  const [heartsCaught, setHeartsCaught] = useState<number>(0);
  const [activeMound, setActiveMound] = useState<number | null>(null);
  const [floatingPoints, setFloatingPoints] = useState<{ id: number; moundIndex: number; text: string }[]>([]);
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Stage 4: Finale State
  const [envelopeOpen, setEnvelopeOpen] = useState<boolean>(false);
  const [couponRedeemed, setCouponRedeemed] = useState<boolean>(false);
  const [replyMessage, setReplyMessage] = useState<string>('');
  const [replySent, setReplySent] = useState<boolean>(false);

  // Secret Vault (Admin) State
  const [showSecretModal, setShowSecretModal] = useState<boolean>(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [adminInputPassword, setAdminInputPassword] = useState<string>('');
  const [adminPasswordError, setAdminPasswordError] = useState<boolean>(false);
  const [adminShake, setAdminShake] = useState<boolean>(false);
  const [editableConfig, setEditableConfig] = useState<RomanticConfig>(DEFAULT_CONFIG);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [milestones, setMilestones] = useState<LoveMilestone[]>([]);

  // Sound sync
  useEffect(() => {
    sounds.enabled = soundEnabled;
  }, [soundEnabled]);

  // Sync config from Firebase Firestore in real-time
  useEffect(() => {
    const configDocRef = doc(db, 'romantic_config', 'current');
    const unsubscribe = onSnapshot(
      configDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const remoteData = docSnap.data() as Partial<RomanticConfig>;
          const merged: RomanticConfig = {
            ...DEFAULT_CONFIG,
            ...remoteData,
            quizQuestions:
              remoteData.quizQuestions && remoteData.quizQuestions.length > 0
                ? (remoteData.quizQuestions as QuizQuestion[])
                : DEFAULT_CONFIG.quizQuestions,
          };
          setConfig(merged);
          setEditableConfig(merged);
        } else {
          // Initialize default in Firestore
          setDoc(configDocRef, DEFAULT_CONFIG).catch((err) => {
            console.warn('Initial config sync notice:', err);
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'romantic_config/current');
      }
    );

    // Sync Milestones
    const milestonesColRef = collection(db, 'milestones');
    const unsubMilestones = onSnapshot(
      milestonesColRef,
      (snapshot) => {
        const list: LoveMilestone[] = [];
        snapshot.forEach((snap) => {
          list.push({ id: snap.id, ...(snap.data() as Omit<LoveMilestone, 'id'>) });
        });
        list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
        setMilestones(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'milestones');
      }
    );

    return () => {
      unsubscribe();
      unsubMilestones();
    };
  }, []);

  const recordMilestone = async (eventType: string, message: string) => {
    try {
      await addDoc(collection(db, 'milestones'), {
        eventType,
        message,
        createdAt: new Date().toISOString(),
      });
    } catch {
      // Non-blocking
    }
  };

  // --- MINI-GAME LOGIC ---
  useEffect(() => {
    if (stage === 3) {
      if (heartsCaught >= config.targetHearts) return;

      const scheduleNextMound = () => {
        const delay = Math.floor(Math.random() * 500) + 650;
        gameTimerRef.current = setTimeout(() => {
          const randomIndex = Math.floor(Math.random() * 9);
          setActiveMound(randomIndex);

          const hideDelay = setTimeout(() => {
            setActiveMound((curr) => (curr === randomIndex ? null : curr));
            scheduleNextMound();
          }, 1150);

          return () => clearTimeout(hideDelay);
        }, delay);
      };

      scheduleNextMound();

      return () => {
        if (gameTimerRef.current) clearTimeout(gameTimerRef.current);
      };
    }
  }, [stage, heartsCaught, config.targetHearts]);

  const handleCatchHeart = (index: number) => {
    if (activeMound !== index) return;
    sounds.playPop();
    setActiveMound(null);

    const newCount = heartsCaught + 1;
    setHeartsCaught(newCount);

    const reactionWords = ['+1 Kiss! 💋', 'Muah! 💕', 'So Sweet! ✨', 'Gotcha! 🌸'];
    const randomWord = reactionWords[Math.floor(Math.random() * reactionWords.length)];
    const pointId = Date.now() + Math.random();
    setFloatingPoints((prev) => [...prev, { id: pointId, moundIndex: index, text: randomWord }]);
    setTimeout(() => {
      setFloatingPoints((prev) => prev.filter((p) => p.id !== pointId));
    }, 850);

    if (newCount >= config.targetHearts) {
      sounds.playFanfare();
      recordMilestone('MINI_GAME_COMPLETED', `Caught all ${config.targetHearts} kisses with 100% Love Meter!`);
      triggerConfetti();
    }
  };

  // --- QUIZ HANDLERS ---
  const handleAnswerSelect = (optionIndex: number) => {
    if (isAnswerCorrect) return;
    setSelectedOption(optionIndex);

    const currentQ = config.quizQuestions[currentQuestionIndex];
    if (!currentQ) return;

    const isCorrect = currentQ.isTrick || optionIndex === currentQ.correctAnswer;

    if (isCorrect) {
      sounds.playSuccess();
      setIsAnswerCorrect(true);
      setQuizFeedback({ isError: false, message: currentQ.hintOrReaction });
      triggerMiniConfetti();

      setTimeout(() => {
        if (currentQuestionIndex + 1 < config.quizQuestions.length) {
          setCurrentQuestionIndex((prev) => prev + 1);
          setSelectedOption(null);
          setQuizFeedback(null);
          setIsAnswerCorrect(false);
        } else {
          recordMilestone('QUIZ_COMPLETED', 'Successfully answered all trivia questions!');
          sounds.playFanfare();
          triggerConfetti();
          setStage(3);
        }
      }, 1500);
    } else {
      sounds.playWrong();
      setShakeQuestion(true);
      setQuizFeedback({
        isError: true,
        message: 'Aww, nice try my love! Pick again, you got this! 💕',
      });
      setTimeout(() => {
        setShakeQuestion(false);
      }, 450);
    }
  };

  // --- CONFETTI EFFECTS ---
  const triggerConfetti = () => {
    confetti({
      particleCount: 90,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#f472b6', '#ec4899', '#c084fc', '#fbcfe8', '#fef08a', '#fb7185'],
    });
  };

  const triggerMiniConfetti = () => {
    confetti({
      particleCount: 30,
      spread: 40,
      origin: { y: 0.7 },
      colors: ['#f472b6', '#fbcfe8', '#e9d5ff'],
    });
  };

  const handleOpenEnvelope = () => {
    if (!envelopeOpen) {
      sounds.playFanfare();
      setEnvelopeOpen(true);
      recordMilestone('ENVELOPE_OPENED', 'Opened the love letter & revealed the secret coupon!');
      setTimeout(() => triggerConfetti(), 100);
      setTimeout(() => triggerConfetti(), 450);
    }
  };

  const handleRedeemCoupon = () => {
    if (!couponRedeemed) {
      sounds.playSuccess();
      setCouponRedeemed(true);
      recordMilestone('COUPON_REDEEMED', `Claimed coupon: "${config.couponOffer}"`);
      triggerConfetti();
    }
  };

  const handleSendSweetReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim()) return;
    try {
      await recordMilestone('GIRLFRIEND_NOTE', replyMessage.trim());
      sounds.playSuccess();
      setReplySent(true);
      setReplyMessage('');
      triggerMiniConfetti();
    } catch {
      // Handled
    }
  };

  // --- SECRET VAULT (ADMIN) HANDLERS ---
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminInputPassword.trim() === config.adminPassword) {
      setIsAdminAuthenticated(true);
      setAdminPasswordError(false);
      setEditableConfig({ ...config });
    } else {
      sounds.playWrong();
      setAdminPasswordError(true);
      setAdminShake(true);
      setTimeout(() => setAdminShake(false), 450);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveSuccessMsg('');
    try {
      const configDocRef = doc(db, 'romantic_config', 'current');
      const payload: RomanticConfig = {
        ...editableConfig,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(configDocRef, payload);
      setConfig(payload);
      setSaveSuccessMsg('✨ All memories and changes saved to cloud!');
      sounds.playSuccess();
      setTimeout(() => setSaveSuccessMsg(''), 3500);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'romantic_config/current');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fff7fa] text-stone-800 flex flex-col relative overflow-hidden select-none font-sans">
      {/* Floating Ambient Pastel Petals & Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-40">
        <div className="absolute top-12 left-10 text-pink-300 text-2xl animate-float">🌸</div>
        <div className="absolute top-36 right-14 text-purple-300 text-3xl animate-float-slow">✨</div>
        <div className="absolute bottom-28 left-14 text-rose-300 text-2xl animate-float">💖</div>
        <div className="absolute bottom-36 right-24 text-pink-300 text-2xl animate-float-slow">🌷</div>
        <div className="absolute top-1/2 left-6 text-purple-200 text-xl animate-float">⭐</div>
        <div className="absolute top-1/4 right-8 text-pink-200 text-2xl animate-float-slow">💌</div>
      </div>

      {/* Top Bar */}
      <header className="relative z-10 w-full px-4 py-3 sm:px-8 flex justify-between items-center bg-white/70 backdrop-blur-md border-b border-pink-100 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-500 shadow-inner">
            <Heart className="w-4 h-4 fill-pink-500 text-pink-500 animate-pulse" />
          </div>
          <span className="font-bold text-pink-800 text-sm sm:text-base tracking-wide">
            Our Love Story
          </span>
        </div>

        {/* Stage Flow Dots */}
        <div className="flex items-center gap-1.5 bg-pink-50/90 px-3 py-1 rounded-full border border-pink-200/80">
          {[
            { num: 1, label: 'Start' },
            { num: 2, label: 'Trivia' },
            { num: 3, label: 'Kisses' },
            { num: 4, label: 'Letter' },
          ].map((st) => (
            <button
              key={st.num}
              onClick={() => {
                sounds.playPop();
                setStage(st.num);
              }}
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all ${
                stage === st.num
                  ? 'bg-rose-400 text-white shadow-xs scale-105'
                  : stage > st.num
                  ? 'text-pink-600 bg-pink-100/70 hover:bg-pink-200'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Sound FX Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              sounds.playPop();
            }}
            title={soundEnabled ? 'Mute Sounds' : 'Turn on Sounds'}
            className="p-2 rounded-full bg-pink-50 hover:bg-pink-100 text-pink-600 transition-all border border-pink-200 shadow-xs active:scale-95"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-3xl mx-auto w-full">
        {/* STAGE 1: LANDING PAGE */}
        {stage === 1 && (
          <div className="w-full max-w-md bg-white/90 backdrop-blur-md border border-pink-200/80 rounded-3xl p-6 sm:p-10 shadow-xl shadow-pink-100/50 text-center flex flex-col items-center transition-all">
            {/* Cute Couple Illustrated Keepsake */}
            <div className="relative mb-5">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-pink-200 via-rose-100 to-purple-200 p-1.5 shadow-md rotate-2 hover:rotate-0 transition-transform">
                <div className="w-full h-full bg-white rounded-2xl flex flex-col items-center justify-center">
                  <span className="text-4xl sm:text-5xl">🥰</span>
                  <span className="text-[10px] font-bold text-pink-500 mt-1 uppercase tracking-wider">
                    For {config.girlfriendName}
                  </span>
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-rose-500 text-white p-1 rounded-full shadow-xs">
                <Heart className="w-3.5 h-3.5 fill-white" />
              </div>
            </div>

            <div className="inline-block bg-pink-50 text-rose-600 px-4 py-1 rounded-full text-xs font-semibold mb-3 border border-pink-200">
              A surprise for my sweetheart
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-800 mb-2 tracking-tight">
              {config.welcomeTitle}
            </h1>

            <p className="text-stone-600 text-sm sm:text-base leading-relaxed mb-8 max-w-sm">
              {config.welcomeMessage}
            </p>

            {/* Bouncing Press Start Button */}
            <button
              onClick={() => {
                sounds.playSuccess();
                setStage(2);
                triggerMiniConfetti();
              }}
              className="group relative inline-flex items-center justify-center px-8 py-4 text-base sm:text-lg font-bold text-white transition-all bg-gradient-to-r from-pink-500 via-rose-500 to-purple-500 rounded-full shadow-lg shadow-pink-400/30 hover:shadow-pink-400/50 hover:scale-105 active:scale-95 animate-bounce"
            >
              <Heart className="w-5 h-5 mr-2 fill-white animate-pulse" />
              <span>Press Start 💕</span>
              <Sparkles className="w-4 h-4 ml-2 group-hover:rotate-45 transition-transform" />
            </button>
          </div>
        )}

        {/* STAGE 2: MEMORY QUIZ (Couples Trivia) */}
        {stage === 2 && (
          <div
            className={`w-full max-w-lg bg-white/95 backdrop-blur-md border border-pink-200 rounded-3xl p-6 sm:p-8 shadow-xl shadow-pink-100/50 transition-all ${
              shakeQuestion ? 'animate-shake' : ''
            }`}
          >
            {/* Header with question counter */}
            <div className="flex justify-between items-center mb-5">
              <span className="bg-pink-100/80 text-rose-700 text-xs font-bold px-3 py-1 rounded-full border border-pink-200">
                Memory {currentQuestionIndex + 1} of {config.quizQuestions.length}
              </span>
              <div className="flex items-center gap-1.5">
                {config.quizQuestions.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-2 rounded-full transition-all ${
                      idx === currentQuestionIndex
                        ? 'w-6 bg-rose-500'
                        : idx < currentQuestionIndex
                        ? 'w-3 bg-pink-400'
                        : 'w-3 bg-pink-100'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Question Text */}
            <h2 className="text-lg sm:text-xl font-bold text-stone-800 mb-6 leading-snug">
              {config.quizQuestions[currentQuestionIndex]?.question}
            </h2>

            {/* Answer Options */}
            <div className="space-y-3 mb-6">
              {config.quizQuestions[currentQuestionIndex]?.options.map((option, optIdx) => {
                const isSelected = selectedOption === optIdx;
                let btnStyle =
                  'bg-pink-50/60 hover:bg-pink-100/80 text-stone-800 border-pink-200 hover:border-pink-300';

                if (isSelected) {
                  if (quizFeedback && !quizFeedback.isError) {
                    btnStyle = 'bg-emerald-500 text-white border-emerald-600 shadow-md scale-102';
                  } else if (quizFeedback && quizFeedback.isError) {
                    btnStyle = 'bg-rose-400 text-white border-rose-500 shadow-xs';
                  }
                }

                return (
                  <button
                    key={optIdx}
                    onClick={() => handleAnswerSelect(optIdx)}
                    disabled={isAnswerCorrect}
                    className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border transition-all flex items-center justify-between font-medium text-sm sm:text-base active:scale-98 ${btnStyle}`}
                  >
                    <span>{option}</span>
                    <span className="ml-3 shrink-0">
                      {isSelected && quizFeedback && !quizFeedback.isError ? (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      ) : (
                        <Heart className="w-4 h-4 fill-pink-200 text-pink-300" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sweet Playful Feedback Banner (No alert!) */}
            {quizFeedback && (
              <div
                className={`p-3.5 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 border animate-pop-heart ${
                  quizFeedback.isError
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                <span className="text-lg">{quizFeedback.isError ? '🥺' : '🥰'}</span>
                <span>{quizFeedback.message}</span>
              </div>
            )}
          </div>
        )}

        {/* STAGE 3: MINI-GAME ('Catch the Kisses') */}
        {stage === 3 && (
          <div className="w-full max-w-md bg-white/95 backdrop-blur-md border border-pink-200 rounded-3xl p-6 sm:p-8 shadow-xl shadow-pink-100/50 text-center flex flex-col items-center">
            <div className="mb-4">
              <h2 className="text-xl sm:text-2xl font-extrabold text-stone-800 flex items-center justify-center gap-2">
                <span>{config.miniGameTitle}</span>
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 mt-1">{config.miniGameSubtitle}</p>
            </div>

            {/* Love Meter */}
            <div className="w-full bg-pink-100 rounded-full h-6 p-0.5 border border-pink-200 mb-6 relative overflow-hidden shadow-inner">
              <div
                className="bg-gradient-to-r from-pink-400 via-rose-500 to-purple-500 h-full rounded-full transition-all duration-300 flex items-center justify-end pr-2 text-white font-bold text-xs"
                style={{ width: `${Math.min(100, (heartsCaught / config.targetHearts) * 100)}%` }}
              >
                {heartsCaught > 0 && <span>💖</span>}
              </div>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-stone-700 pointer-events-none">
                Love Meter: {heartsCaught} / {config.targetHearts} Kisses
              </span>
            </div>

            {/* 3x3 Garden Cloud Grid */}
            <div className="grid grid-cols-3 gap-3 w-full aspect-square p-3 bg-pink-50/70 rounded-3xl border border-pink-200 shadow-inner">
              {Array.from({ length: 9 }).map((_, index) => {
                const isActive = activeMound === index;
                const pointForThis = floatingPoints.find((p) => p.moundIndex === index);

                return (
                  <div
                    key={index}
                    onClick={() => handleCatchHeart(index)}
                    className="relative rounded-2xl bg-gradient-to-b from-white to-pink-100/80 border border-pink-200 flex items-center justify-center cursor-pointer overflow-hidden shadow-xs hover:border-pink-300 transition-all active:scale-95 group"
                  >
                    {isActive ? (
                      <div className="absolute inset-0 flex items-center justify-center animate-pop-heart z-10">
                        <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center">
                          <span className="text-3xl filter drop-shadow-sm animate-gentle-pulse">
                            💋
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-pink-300/40 text-xl font-bold select-none group-hover:text-pink-300/60 transition-colors">
                        ☁️
                      </span>
                    )}

                    {pointForThis && (
                      <div className="absolute -top-1 font-bold text-xs text-rose-600 bg-white px-2 py-0.5 rounded-full border border-pink-200 shadow-xs animate-bounce z-20 pointer-events-none">
                        {pointForThis.text}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Success Prompt */}
            {heartsCaught >= config.targetHearts ? (
              <div className="w-full bg-gradient-to-r from-pink-100 via-rose-100 to-purple-100 border border-pink-300 rounded-2xl p-4 text-center mt-5 animate-pop-heart shadow-sm">
                <p className="font-extrabold text-rose-700 text-sm sm:text-base mb-1">
                  🎉 Love Meter at 100%!
                </p>
                <p className="text-xs text-rose-600 mb-3">
                  You caught all the kisses! Your secret surprise has unlocked.
                </p>
                <button
                  onClick={() => {
                    sounds.playFanfare();
                    setStage(4);
                  }}
                  className="px-6 py-2.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold text-sm shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2 mx-auto"
                >
                  <span>Open The Letter</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <p className="text-xs text-stone-500 mt-4">
                Tap the kisses as quickly as you can! ✨
              </p>
            )}
          </div>
        )}

        {/* STAGE 4: THE GRAND FINALE (Digital Envelope & Love Coupon) */}
        {stage === 4 && (
          <div className="w-full max-w-lg flex flex-col items-center">
            {!envelopeOpen ? (
              <div
                onClick={handleOpenEnvelope}
                className="w-full bg-gradient-to-br from-pink-100 via-rose-50 to-purple-100 border-2 border-pink-300/80 rounded-3xl p-8 sm:p-10 shadow-xl shadow-pink-200/60 cursor-pointer text-center relative overflow-hidden group hover:scale-102 active:scale-98 transition-all animate-gentle-pulse"
              >
                {/* Envelope Flap Accent */}
                <div className="absolute top-0 inset-x-0 h-16 bg-white/40 border-b border-pink-200 [clip-path:polygon(0_0,50%_100%,100%_0)]" />

                {/* Wax Seal */}
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-rose-600 to-pink-500 border-4 border-white shadow-lg flex items-center justify-center text-3xl text-white mb-4 group-hover:rotate-12 transition-transform">
                  💌
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-stone-800 mb-1.5 tracking-tight">
                  {config.letterTitle}
                </h2>
                <p className="text-rose-600 text-xs sm:text-sm font-semibold mb-6">
                  Written with love for {config.girlfriendName}
                </p>

                <div className="inline-flex items-center gap-2 bg-white/90 text-rose-600 font-bold px-6 py-2.5 rounded-full shadow-sm text-sm border border-pink-200 group-hover:bg-rose-500 group-hover:text-white transition-all">
                  <Sparkles className="w-4 h-4" />
                  <span>Tap to Break The Seal & Read</span>
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
            ) : (
              /* Opened Letter & Coupon */
              <div className="w-full space-y-6 animate-pop-heart">
                {/* Stationery Love Letter */}
                <div className="bg-[#fffdfa] border-2 border-pink-200/90 rounded-3xl p-6 sm:p-9 shadow-xl shadow-pink-100/60 relative overflow-hidden">
                  <div className="absolute top-5 right-5 w-12 h-14 border-2 border-dashed border-pink-300 bg-pink-50/70 rounded-md flex flex-col items-center justify-center text-pink-500 rotate-6 shadow-xs pointer-events-none">
                    <Heart className="w-4 h-4 fill-pink-400 text-pink-400" />
                    <span className="text-[8px] font-bold mt-1">LOVE</span>
                  </div>

                  <div className="mb-5 border-b border-pink-100 pb-3">
                    <span className="text-xs font-bold text-rose-500 uppercase tracking-widest">
                      A Letter For You
                    </span>
                    <h3 className="text-xl font-extrabold text-stone-800 mt-1">
                      {config.letterTitle}
                    </h3>
                  </div>

                  <div className="font-handwriting text-lg sm:text-xl text-stone-800 leading-relaxed space-y-4 whitespace-pre-line tracking-wide">
                    {config.letterBody}
                  </div>

                  <div className="mt-8 pt-4 border-t border-pink-100 text-right font-handwriting text-xl sm:text-2xl font-bold text-rose-600">
                    {config.letterSignoff}
                  </div>
                </div>

                {/* THE DIGITAL LOVE COUPON */}
                <div className="bg-gradient-to-r from-amber-50 via-rose-50 to-pink-50 border-2 border-dashed border-amber-300 rounded-3xl p-6 sm:p-7 shadow-lg relative overflow-hidden">
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#fff7fa] border-r-2 border-amber-300 pointer-events-none" />
                  <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#fff7fa] border-l-2 border-amber-300 pointer-events-none" />

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/80 pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-500" />
                      <h4 className="font-black text-amber-900 text-sm sm:text-base uppercase tracking-wider">
                        {config.couponTitle}
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-bold bg-amber-100 text-amber-800 px-3 py-1 rounded-full border border-amber-300 self-start sm:self-auto">
                      {config.couponCode}
                    </span>
                  </div>

                  <p className="text-base font-bold text-stone-800 mb-1.5 leading-snug">
                    {config.couponOffer}
                  </p>
                  <p className="text-xs text-stone-600 mb-5 italic">{config.couponTerms}</p>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                      <Heart className="w-3.5 h-3.5 fill-rose-500" />
                      <span>Issued to {config.girlfriendName}</span>
                    </div>

                    <button
                      onClick={handleRedeemCoupon}
                      disabled={couponRedeemed}
                      className={`px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all shadow-sm active:scale-95 ${
                        couponRedeemed
                          ? 'bg-emerald-500 text-white cursor-default'
                          : 'bg-gradient-to-r from-amber-500 to-rose-500 text-white hover:scale-105 hover:shadow-md'
                      }`}
                    >
                      {couponRedeemed ? '✨ REDEEMED WITH LOVE 💕' : 'Tap to Redeem Voucher 🎁'}
                    </button>
                  </div>
                </div>

                {/* Sweet note back */}
                <div className="bg-white/90 backdrop-blur-md border border-pink-200 rounded-3xl p-5 shadow-sm">
                  <h5 className="text-xs sm:text-sm font-bold text-stone-800 mb-1 flex items-center gap-1.5">
                    <MessageCircleHeart className="w-4 h-4 text-pink-500" />
                    <span>Send a Note Back</span>
                  </h5>
                  <p className="text-xs text-stone-500 mb-3">
                    Leave a sweet thought or reply, and it will be saved for me to read!
                  </p>

                  {replySent ? (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2.5 rounded-2xl text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Your note was received with so much love! 💕</span>
                    </div>
                  ) : (
                    <form onSubmit={handleSendSweetReply} className="flex gap-2">
                      <input
                        type="text"
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Say something sweet... 🥰"
                        className="flex-1 px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white"
                        maxLength={250}
                      />
                      <button
                        type="submit"
                        disabled={!replyMessage.trim()}
                        className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1 transition-all disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send</span>
                      </button>
                    </form>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-center gap-3 pt-1">
                  <button
                    onClick={() => {
                      triggerConfetti();
                      sounds.playFanfare();
                    }}
                    className="px-4 py-2 bg-pink-100 hover:bg-pink-200 text-pink-700 rounded-full text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <PartyPopper className="w-3.5 h-3.5" />
                    <span>Celebrate Again!</span>
                  </button>
                  <button
                    onClick={() => {
                      sounds.playPop();
                      setStage(1);
                      setCurrentQuestionIndex(0);
                      setSelectedOption(null);
                      setQuizFeedback(null);
                      setIsAnswerCorrect(false);
                      setHeartsCaught(0);
                    }}
                    className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-full text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Replay Story</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Discreet Footer with Subtle Keyhole Icon */}
      <footer className="relative z-10 w-full text-center py-4 px-4 text-xs text-stone-400 border-t border-pink-100 bg-white/40 flex items-center justify-center gap-2">
        <span>Made with love • Forever & Always</span>
        <button
          onClick={() => {
            sounds.playPop();
            setShowSecretModal(true);
          }}
          title="Secret Settings"
          className="p-1 rounded-full text-stone-300 hover:text-pink-400 transition-colors"
        >
          <KeyRound className="w-3.5 h-3.5" />
        </button>
      </footer>

      {/* --- SECRET VAULT (ADMIN) MODAL --- */}
      {showSecretModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-pink-200 shadow-2xl p-6 sm:p-8 relative my-8 max-h-[90vh] flex flex-col">
            <button
              onClick={() => {
                setShowSecretModal(false);
                setAdminInputPassword('');
                setAdminPasswordError(false);
              }}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Password Prompt — Password value is NEVER revealed or hinted in the UI! */}
            {!isAdminAuthenticated ? (
              <div
                className={`py-8 text-center flex flex-col items-center max-w-sm mx-auto ${
                  adminShake ? 'animate-shake' : ''
                }`}
              >
                <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center text-2xl mb-4 border border-rose-100">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-stone-800 mb-1">Secret Vault</h3>
                <p className="text-xs text-stone-500 mb-6">
                  Enter passcode to edit questions, memories, and surprise coupon.
                </p>

                <form onSubmit={handleAdminLogin} className="w-full space-y-3">
                  <input
                    type="password"
                    value={adminInputPassword}
                    onChange={(e) => setAdminInputPassword(e.target.value)}
                    placeholder="Enter passcode"
                    autoFocus
                    className={`w-full px-4 py-3 rounded-2xl border text-center font-mono text-base focus:outline-none focus:ring-2 ${
                      adminPasswordError
                        ? 'border-rose-400 focus:ring-rose-400 bg-rose-50'
                        : 'border-pink-200 focus:ring-rose-300 bg-white'
                    }`}
                  />
                  {adminPasswordError && (
                    <p className="text-xs text-rose-500 font-semibold">
                      Incorrect passcode. Access denied!
                    </p>
                  )}
                  <button
                    type="submit"
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-purple-600 text-white font-bold text-sm shadow-md hover:scale-102 active:scale-98 transition-all flex items-center justify-center gap-2"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Unlock Vault</span>
                  </button>
                </form>
              </div>
            ) : (
              /* Customizer Dashboard */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
                  <h3 className="text-base sm:text-lg font-bold text-stone-800">
                    Customize Memories & Content
                  </h3>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setStage(s);
                          setShowSecretModal(false);
                        }}
                        className="px-2 py-0.5 bg-pink-50 hover:bg-pink-100 border border-pink-200 text-pink-700 rounded-lg text-xs font-semibold"
                      >
                        Stage {s}
                      </button>
                    ))}
                  </div>
                </div>

                {saveSuccessMsg && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-2xl text-xs font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{saveSuccessMsg}</span>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto pr-1 space-y-5 text-xs sm:text-sm">
                  {/* General */}
                  <div className="space-y-3 bg-stone-50 p-4 rounded-2xl border border-stone-200">
                    <h4 className="font-bold text-stone-800 text-sm">👤 Recipient & Welcome</h4>
                    <div>
                      <label className="block text-stone-600 font-semibold mb-1">
                        Her Name / Nickname:
                      </label>
                      <input
                        type="text"
                        value={editableConfig.girlfriendName}
                        onChange={(e) =>
                          setEditableConfig({ ...editableConfig, girlfriendName: e.target.value })
                        }
                        className="w-full px-3 py-1.5 rounded-xl border border-stone-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-600 font-semibold mb-1">
                        Welcome Screen Title:
                      </label>
                      <input
                        type="text"
                        value={editableConfig.welcomeTitle}
                        onChange={(e) =>
                          setEditableConfig({ ...editableConfig, welcomeTitle: e.target.value })
                        }
                        className="w-full px-3 py-1.5 rounded-xl border border-stone-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-600 font-semibold mb-1">
                        Welcome Message:
                      </label>
                      <textarea
                        rows={2}
                        value={editableConfig.welcomeMessage}
                        onChange={(e) =>
                          setEditableConfig({ ...editableConfig, welcomeMessage: e.target.value })
                        }
                        className="w-full px-3 py-1.5 rounded-xl border border-stone-300 bg-white"
                      />
                    </div>
                  </div>

                  {/* Trivia Questions */}
                  <div className="space-y-4 bg-stone-50 p-4 rounded-2xl border border-stone-200">
                    <h4 className="font-bold text-stone-800 text-sm">
                      ❓ Trivia Questions & Options
                    </h4>
                    {editableConfig.quizQuestions.map((q, qIndex) => (
                      <div key={q.id} className="p-3 bg-white rounded-xl border border-stone-200 space-y-2">
                        <div className="font-bold text-xs text-rose-600">
                          Question {qIndex + 1} {q.isTrick ? '(Trick: All answers correct)' : ''}
                        </div>
                        <input
                          type="text"
                          value={q.question}
                          onChange={(e) => {
                            const updated = [...editableConfig.quizQuestions];
                            updated[qIndex] = { ...updated[qIndex], question: e.target.value };
                            setEditableConfig({ ...editableConfig, quizQuestions: updated });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-stone-300 font-medium"
                        />

                        <div className="space-y-1.5 pt-1">
                          <label className="text-[11px] font-semibold text-stone-500">
                            Options (Pick correct one):
                          </label>
                          {q.options.map((opt, optIndex) => (
                            <div key={optIndex} className="flex items-center gap-2">
                              {!q.isTrick && (
                                <input
                                  type="radio"
                                  name={`correct-${q.id}`}
                                  checked={q.correctAnswer === optIndex}
                                  onChange={() => {
                                    const updated = [...editableConfig.quizQuestions];
                                    updated[qIndex] = { ...updated[qIndex], correctAnswer: optIndex };
                                    setEditableConfig({ ...editableConfig, quizQuestions: updated });
                                  }}
                                />
                              )}
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const updated = [...editableConfig.quizQuestions];
                                  const opts = [...updated[qIndex].options];
                                  opts[optIndex] = e.target.value;
                                  updated[qIndex] = { ...updated[qIndex], options: opts };
                                  setEditableConfig({ ...editableConfig, quizQuestions: updated });
                                }}
                                className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-stone-200"
                              />
                            </div>
                          ))}
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-stone-500">
                            Reaction Message:
                          </label>
                          <input
                            type="text"
                            value={q.hintOrReaction}
                            onChange={(e) => {
                              const updated = [...editableConfig.quizQuestions];
                              updated[qIndex] = { ...updated[qIndex], hintOrReaction: e.target.value };
                              setEditableConfig({ ...editableConfig, quizQuestions: updated });
                            }}
                            className="w-full px-2.5 py-1 text-xs rounded-lg border border-stone-200"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Letter & Coupon */}
                  <div className="space-y-3 bg-stone-50 p-4 rounded-2xl border border-stone-200">
                    <h4 className="font-bold text-stone-800 text-sm">💌 Love Letter & Voucher</h4>
                    <div>
                      <label className="block text-stone-600 font-semibold mb-1">Letter Title:</label>
                      <input
                        type="text"
                        value={editableConfig.letterTitle}
                        onChange={(e) =>
                          setEditableConfig({ ...editableConfig, letterTitle: e.target.value })
                        }
                        className="w-full px-3 py-1.5 rounded-xl border border-stone-300"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-600 font-semibold mb-1">Letter Text:</label>
                      <textarea
                        rows={6}
                        value={editableConfig.letterBody}
                        onChange={(e) =>
                          setEditableConfig({ ...editableConfig, letterBody: e.target.value })
                        }
                        className="w-full px-3 py-1.5 rounded-xl border border-stone-300 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-600 font-semibold mb-1">Letter Sign-off:</label>
                      <input
                        type="text"
                        value={editableConfig.letterSignoff}
                        onChange={(e) =>
                          setEditableConfig({ ...editableConfig, letterSignoff: e.target.value })
                        }
                        className="w-full px-3 py-1.5 rounded-xl border border-stone-300"
                      />
                    </div>
                    <div className="border-t border-stone-200 pt-3 space-y-2">
                      <label className="block text-amber-800 font-bold">Coupon Offer:</label>
                      <input
                        type="text"
                        value={editableConfig.couponOffer}
                        onChange={(e) =>
                          setEditableConfig({ ...editableConfig, couponOffer: e.target.value })
                        }
                        className="w-full px-3 py-1.5 rounded-xl border border-stone-300"
                      />
                    </div>
                  </div>

                  {/* Notes Received */}
                  <div className="space-y-2 bg-pink-50/70 p-4 rounded-2xl border border-pink-200">
                    <h4 className="font-bold text-rose-800 text-sm flex items-center justify-between">
                      <span>Live Activity & Notes Received</span>
                      <span className="text-xs bg-rose-200 text-rose-800 px-2 py-0.5 rounded-full">
                        {milestones.length}
                      </span>
                    </h4>
                    {milestones.length === 0 ? (
                      <p className="text-xs text-stone-500 italic">No notes or redemptions yet.</p>
                    ) : (
                      <div className="max-h-36 overflow-y-auto space-y-2">
                        {milestones.map((m) => (
                          <div
                            key={m.id}
                            className="bg-white p-2.5 rounded-xl border border-pink-100 text-xs shadow-xs"
                          >
                            <div className="flex justify-between items-center text-[10px] text-stone-400 mb-1">
                              <span className="font-bold text-rose-600 uppercase">{m.eventType}</span>
                              <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-stone-800">{m.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Change Passcode */}
                  <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
                    <label className="block text-stone-700 font-semibold mb-1 text-xs">
                      Update Passcode:
                    </label>
                    <input
                      type="password"
                      value={editableConfig.adminPassword}
                      onChange={(e) =>
                        setEditableConfig({ ...editableConfig, adminPassword: e.target.value })
                      }
                      className="w-full px-3 py-1.5 rounded-xl border border-stone-300 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-3 mt-2">
                  <button
                    onClick={() => setShowSecretModal(false)}
                    className="px-4 py-2 rounded-xl border border-stone-300 text-stone-600 text-xs font-bold hover:bg-stone-50"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleSaveConfig}
                    disabled={isSaving}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-purple-600 text-white font-bold text-xs sm:text-sm shadow-md hover:scale-102 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Save to Cloud</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

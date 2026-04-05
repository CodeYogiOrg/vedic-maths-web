import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGame } from '@/contexts/GameContext';
import { RotateCcw, Play, Trophy, Target, Timer, Star, Zap, CheckCircle, XCircle, ChevronUp } from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────
const RODS = 7;
const BEAD_H = 30;
const BEAD_GAP = 6;
const STRIDE = BEAD_H + BEAD_GAP;
const SECTION_H = 4 * STRIDE + 8; // bottom section height

// ── Types ────────────────────────────────────────────────────────────────────
type Rod = { top: boolean; bottom: number }; // bottom: 0-4 active beads
type Abacus = Rod[];
type DrillState = 'idle' | 'playing' | 'checking' | 'done';

// ── Helpers ──────────────────────────────────────────────────────────────────
const initAbacus = (): Abacus => Array(RODS).fill(null).map(() => ({ top: false, bottom: 0 }));

const getAbacusValue = (a: Abacus): number =>
  a.reduce((sum, rod, i) => {
    const place = Math.pow(10, RODS - 1 - i);
    return sum + (rod.top ? 5 : 0) * place + rod.bottom * place;
  }, 0);

const valueToAbacus = (value: number): Abacus => {
  const a = initAbacus();
  let rem = Math.min(value, Math.pow(10, RODS) - 1);
  for (let i = 0; i < RODS; i++) {
    const place = Math.pow(10, RODS - 1 - i);
    const digit = Math.floor(rem / place);
    rem -= digit * place;
    a[i].top = digit >= 5;
    a[i].bottom = digit - (digit >= 5 ? 5 : 0);
  }
  return a;
};

const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const DRILL_LEVELS = [
  { id: 1, label: 'Easy',   labelHi: 'आसान',   min: 1,    max: 9,    time: 30 },
  { id: 2, label: 'Medium', labelHi: 'मध्यम',  min: 10,   max: 99,   time: 25 },
  { id: 3, label: 'Hard',   labelHi: 'कठिन',   min: 100,  max: 999,  time: 20 },
  { id: 4, label: 'Expert', labelHi: 'विशेषज्ञ', min: 1000, max: 9999, time: 15 },
];

const placeLabel = (rod: number) => {
  const val = Math.pow(10, RODS - 1 - rod);
  if (val >= 1000000) return '10L';
  if (val >= 100000)  return '1L';
  if (val >= 10000)   return '10K';
  if (val >= 1000)    return '1K';
  return val.toString();
};

// ── Bead Y positions ─────────────────────────────────────────────────────────
// beadIdx: 0 = closest to beam, 3 = furthest from beam
const bottomBeadY = (beadIdx: number, activeCount: number) => {
  if (beadIdx < activeCount) {
    // active → stack at top
    return beadIdx * STRIDE;
  } else {
    // inactive → hang at bottom
    const inactiveIdx = beadIdx - activeCount;          // 0 = first inactive from beam
    const totalInactive = 4 - activeCount;
    const fromBottom = totalInactive - 1 - inactiveIdx; // 0 = very bottom
    return SECTION_H - BEAD_H - fromBottom * STRIDE;
  }
};

const topBeadY = (active: boolean) => active ? 38 : 4;

// ── Sub-components ────────────────────────────────────────────────────────────

const Bead = ({
  active, y, onClick, color,
}: {
  active: boolean; y: number; onClick: () => void; color: 'primary' | 'warm' | 'muted';
}) => {
  const bg =
    color === 'primary' ? 'from-red-500 to-orange-400'
    : color === 'warm'  ? 'from-orange-400 to-yellow-300'
    : 'from-stone-200 to-stone-300 dark:from-stone-600 dark:to-stone-700';

  return (
    <motion.button
      onClick={onClick}
      animate={{ y }}
      transition={{ type: 'spring', stiffness: 600, damping: 35 }}
      whileTap={{ scale: 0.92 }}
      style={{ position: 'absolute', left: '50%', x: '-50%', height: BEAD_H }}
      className={`w-[70%] rounded-full bg-gradient-to-br ${bg} shadow-md border ${
        active ? 'border-white/30' : 'border-stone-300/50 dark:border-stone-500/30'
      } cursor-pointer select-none`}
    >
      {/* Shine */}
      <div className="absolute top-[20%] left-[20%] w-[30%] h-[25%] rounded-full bg-white/40" />
    </motion.button>
  );
};

const AbacusRod = ({
  rod, rodIdx, onChange,
}: {
  rod: Rod; rodIdx: number; onChange: (rod: Rod) => void;
}) => {
  const handleTop = () => onChange({ ...rod, top: !rod.top });

  const handleBottom = (beadIdx: number) => {
    // beadIdx 0 = closest to beam, 3 = furthest
    const newCount = beadIdx < rod.bottom ? beadIdx : beadIdx + 1;
    onChange({ ...rod, bottom: Math.max(0, Math.min(4, newCount)) });
  };

  return (
    <div className="flex flex-col items-center" style={{ width: `${100 / RODS}%` }}>
      {/* Place label */}
      <span className="text-[9px] sm:text-[10px] font-bold text-amber-800/70 mb-1 font-mono">
        {placeLabel(rodIdx)}
      </span>

      {/* Top section (heaven) */}
      <div className="relative w-full flex items-center justify-center" style={{ height: 76 }}>
        {/* Rod */}
        <div className="absolute inset-x-1/2 top-0 bottom-0 w-[3px] -translate-x-1/2 rounded-full bg-amber-700/60" />
        <Bead
          active={rod.top}
          y={topBeadY(rod.top)}
          onClick={handleTop}
          color={rod.top ? 'primary' : 'muted'}
        />
      </div>

      {/* Beam (center divider) */}
      <div className="w-full h-[10px] bg-gradient-to-b from-amber-600 to-amber-800 shadow-md z-10 relative" />

      {/* Bottom section (earth) */}
      <div className="relative w-full" style={{ height: SECTION_H }}>
        {/* Rod */}
        <div className="absolute inset-x-1/2 top-0 bottom-0 w-[3px] -translate-x-1/2 rounded-full bg-amber-700/60" />
        {[0, 1, 2, 3].map(bi => (
          <Bead
            key={bi}
            active={bi < rod.bottom}
            y={bottomBeadY(bi, rod.bottom)}
            onClick={() => handleBottom(bi)}
            color={bi < rod.bottom ? 'warm' : 'muted'}
          />
        ))}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const AbacusPage = () => {
  const { t } = useLanguage();
  const { addXP } = useGame();

  const [abacus, setAbacus] = useState<Abacus>(initAbacus());
  const [drillState, setDrillState] = useState<DrillState>('idle');
  const [drillLevel, setDrillLevel] = useState(0); // index into DRILL_LEVELS
  const [target, setTarget] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [xpFloat, setXpFloat] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentValue = getAbacusValue(abacus);
  const level = DRILL_LEVELS[drillLevel];

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (drillState !== 'playing') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { setDrillState('done'); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [drillState]);

  const newTarget = useCallback(() => {
    setAbacus(initAbacus());
    setTarget(randInt(level.min, level.max));
    setLastCorrect(null);
  }, [level]);

  const startDrill = () => {
    setScore(0);
    setStreak(0);
    setTimeLeft(level.time);
    setLastCorrect(null);
    setDrillState('playing');
    setAbacus(initAbacus());
    setTarget(randInt(level.min, level.max));
  };

  const checkAnswer = () => {
    const correct = currentValue === target;
    setLastCorrect(correct);
    if (correct) {
      setScore(s => s + 1);
      setStreak(s => s + 1);
      addXP(1);
      setXpFloat(true);
      setTimeout(() => setXpFloat(false), 1200);
      setTimeout(() => newTarget(), 800);
    } else {
      setStreak(0);
      // Show correct answer on abacus briefly
      setTimeout(() => {
        setAbacus(valueToAbacus(target));
        setTimeout(() => newTarget(), 1500);
      }, 600);
    }
  };

  const showHint = () => setAbacus(valueToAbacus(target));

  const updateRod = (i: number, rod: Rod) => {
    setAbacus(prev => prev.map((r, idx) => idx === i ? rod : r));
  };

  const stars = score >= 10 ? 3 : score >= 5 ? 2 : score >= 2 ? 1 : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="px-3 py-4 md:py-8 space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-xl">{t('Virtual Abacus', 'वर्चुअल अबेकस')}</h2>
          <p className="text-sm text-muted-foreground">{t('Realistic Soroban — tap beads to move', 'रियलिस्टिक सोरोबान — मोती टैप करें')}</p>
        </div>
        <button
          onClick={() => { setAbacus(initAbacus()); setDrillState('idle'); if (timerRef.current) clearInterval(timerRef.current); }}
          className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl border border-amber-200 dark:border-amber-800"
        >
          <RotateCcw className="w-5 h-5 text-amber-700 dark:text-amber-400" />
        </button>
      </div>

      {/* Value Display */}
      <motion.div
        key={currentValue}
        initial={{ scale: 0.97, opacity: 0.8 }}
        animate={{ scale: 1, opacity: 1 }}
        className="gradient-hero rounded-2xl p-5 text-center text-white relative overflow-hidden"
      >
        <p className="text-xs font-semibold opacity-70 uppercase tracking-wide">{t('Current Value', 'वर्तमान मान')}</p>
        <p className="text-5xl font-display font-bold mt-1 tracking-tight">{currentValue.toLocaleString('en-IN')}</p>
        {drillState === 'playing' && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/20 px-2.5 py-1 rounded-full">
            <Target className="w-3.5 h-3.5" />
            <span className="text-sm font-bold">{target.toLocaleString('en-IN')}</span>
          </div>
        )}
        {/* XP float */}
        <AnimatePresence>
          {xpFloat && (
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -40 }}
              exit={{ opacity: 0 }}
              className="absolute top-2 left-1/2 -translate-x-1/2 text-yellow-300 font-bold text-lg flex items-center gap-1"
            >
              <Zap className="w-4 h-4" /> +1 XP
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Abacus Frame */}
      <div
        className="rounded-2xl overflow-hidden shadow-elevated border-2 border-amber-700/40"
        style={{ background: 'linear-gradient(135deg, #92400e 0%, #b45309 40%, #92400e 100%)' }}
      >
        {/* Top frame strip */}
        <div className="h-3 bg-amber-900/60" />

        {/* Rods area */}
        <div className="bg-amber-50/95 dark:bg-amber-950/80 mx-2 rounded-sm px-2 py-1">
          <div className="flex">
            {abacus.map((rod, i) => (
              <AbacusRod key={i} rod={rod} rodIdx={i} onChange={r => updateRod(i, r)} />
            ))}
          </div>
        </div>

        {/* Bottom frame strip */}
        <div className="h-3 bg-amber-900/60" />
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-500 to-orange-400 shadow-sm" />
          <span>{t('Top bead = 5', 'ऊपर = 5')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-orange-400 to-yellow-300 shadow-sm" />
          <span>{t('Bottom bead = 1', 'नीचे = 1')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-stone-200 to-stone-300 shadow-sm border border-stone-300/50" />
          <span>{t('Inactive', 'निष्क्रिय')}</span>
        </div>
      </div>

      {/* ── Speed Drill ── */}
      <AnimatePresence mode="wait">
        {drillState === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-card rounded-2xl p-4 border border-border shadow-card space-y-3"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 gradient-primary rounded-xl flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-display font-bold text-sm">{t('Speed Drill', 'स्पीड ड्रिल')}</p>
                <p className="text-[11px] text-muted-foreground">{t('Set the abacus to show each number!', 'अबेकस पर नंबर दिखाओ!')}</p>
              </div>
            </div>

            {/* Level selector */}
            <div className="grid grid-cols-4 gap-2">
              {DRILL_LEVELS.map((lv, i) => (
                <button
                  key={lv.id}
                  onClick={() => setDrillLevel(i)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    drillLevel === i
                      ? 'gradient-primary text-white border-transparent shadow-warm scale-105'
                      : 'bg-muted text-muted-foreground border-border hover:border-primary/40'
                  }`}
                >
                  <span className="block">{lv.label}</span>
                  <span className="block text-[10px] opacity-70">{lv.min}–{lv.max > 999 ? lv.max.toLocaleString() : lv.max}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="flex items-center gap-1"><Timer className="w-3.5 h-3.5" /> {level.time}s per round</span>
              <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" /> {level.label} numbers</span>
            </div>

            <button
              onClick={startDrill}
              className="w-full gradient-primary text-white py-3 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-2 shadow-warm hover:scale-[1.02] transition-transform active:scale-95"
            >
              <Play className="w-4 h-4" /> {t('Start Drill', 'ड्रिल शुरू करो')}
            </button>
          </motion.div>
        )}

        {drillState === 'playing' && (
          <motion.div
            key="playing"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-card rounded-2xl p-4 border border-border shadow-card space-y-3"
          >
            {/* Stats bar */}
            <div className="flex items-center gap-3">
              {/* Timer */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-sm flex-1 justify-center ${
                timeLeft <= 5 ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
              }`}>
                <Timer className="w-4 h-4" />
                <span className="font-mono text-lg">{timeLeft}s</span>
              </div>
              {/* Score */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-level/10 font-bold text-sm flex-1 justify-center text-level">
                <Trophy className="w-4 h-4" />
                <span>{score}</span>
              </div>
              {/* Streak */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-100 dark:bg-orange-900/20 font-bold text-sm flex-1 justify-center text-orange-600">
                🔥 <span>{streak}</span>
              </div>
            </div>

            {/* Target */}
            <div className="text-center py-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">{t('Show this number:', 'यह नंबर दिखाओ:')}</p>
              <motion.p
                key={target}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl font-display font-bold text-foreground"
              >
                {target.toLocaleString('en-IN')}
              </motion.p>
            </div>

            {/* Feedback */}
            <AnimatePresence>
              {lastCorrect !== null && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className={`flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold ${
                    lastCorrect
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-600'
                      : 'bg-destructive/10 text-destructive'
                  }`}
                >
                  {lastCorrect ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {lastCorrect ? t('Correct! 🎉', 'सही! 🎉') : t(`Wrong! Showing answer...`, `गलत! जवाब दिखा रहे हैं...`)}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={showHint}
                className="flex-1 py-2.5 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
              >
                <ChevronUp className="w-3.5 h-3.5" /> {t('Show Hint', 'हिंट दिखाओ')}
              </button>
              <button
                onClick={checkAnswer}
                className="flex-[2] py-2.5 rounded-xl gradient-primary text-white text-sm font-bold shadow-warm hover:scale-[1.02] transition-transform active:scale-95 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" /> {t('Check Answer', 'जवाब जांचो')}
              </button>
            </div>
          </motion.div>
        )}

        {drillState === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl p-6 border border-border shadow-card text-center space-y-4"
          >
            <div className="text-5xl">{score === 0 ? '😅' : score >= 8 ? '🏆' : '⭐'}</div>
            <div>
              <p className="font-display font-bold text-xl">{t('Drill Complete!', 'ड्रिल पूरी!')}</p>
              <p className="text-sm text-muted-foreground mt-1">{level.label} Level • {level.time}s</p>
            </div>

            {/* Stars */}
            <div className="flex justify-center gap-2">
              {[0, 1, 2].map(i => (
                <Star
                  key={i}
                  className={`w-8 h-8 transition-all ${
                    i < stars ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'
                  }`}
                />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-primary/10 rounded-xl p-3">
                <p className="text-2xl font-display font-bold text-primary">{score}</p>
                <p className="text-xs text-muted-foreground">{t('Correct', 'सही')}</p>
              </div>
              <div className="bg-level/10 rounded-xl p-3">
                <p className="text-2xl font-display font-bold text-level">{score} XP</p>
                <p className="text-xs text-muted-foreground">{t('Earned', 'कमाए')}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {score === 0
                ? t('Keep practicing — you\'ll get it!', 'अभ्यास करते रहो!')
                : score >= 8
                ? t('Outstanding! You\'re an abacus master!', 'शानदार! तुम अबेकस मास्टर हो!')
                : t('Good job! Try a harder level!', 'अच्छा! कठिन स्तर आज़माओ!')}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setDrillState('idle')}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-bold hover:bg-muted transition-colors"
              >
                {t('Change Level', 'स्तर बदलो')}
              </button>
              <button
                onClick={startDrill}
                className="flex-[2] py-2.5 rounded-xl gradient-primary text-white text-sm font-bold shadow-warm flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" /> {t('Play Again', 'फिर खेलो')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* How to use */}
      {drillState === 'idle' && (
        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-4 border border-amber-200/50 dark:border-amber-800/30">
          <h3 className="font-display font-bold text-sm text-amber-900 dark:text-amber-300 mb-2">
            {t('How to use', 'कैसे उपयोग करें')}
          </h3>
          <div className="space-y-1.5 text-xs text-amber-800/80 dark:text-amber-400/80">
            <p>• {t('Top bead (red) = 5 when pushed toward beam', 'ऊपर का मोती (लाल) = बीम की तरफ → 5')}</p>
            <p>• {t('Bottom beads (orange) = 1 each when pushed toward beam', 'नीचे के मोती (नारंगी) = बीम की तरफ → 1 प्रत्येक')}</p>
            <p>• {t('Tap a bead to move it — beads snap to beam when active', 'मोती टैप करो — सक्रिय होने पर बीम से चिपक जाते हैं')}</p>
            <p>• {t('Each rod is a place value: ones, tens, hundreds…', 'हर रॉड एक स्थान मान है: इकाई, दहाई, सैकड़ा…')}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AbacusPage;

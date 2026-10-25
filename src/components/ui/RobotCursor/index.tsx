'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { IconSend } from '@tabler/icons-react';
import styles from './RobotCursor.module.css';

/* ── Constants ──────────────────────────────────────────────────────────────── */
const CONTENT_HALF = 584; // 1168px / 2
const ROBOT_W = 56;
const ROBOT_H = 56;
const TOPBAR_H = 48;
const CHAT_W = 230;
const CHAT_H_EST = 270;
const ROBOT_TRAVEL_MS = 2100;

const ROBOT_MSG = 'Voce sabe que aqui é só testes mesmo, certo? 😄';

const DRAG_PAD = 12;

/* ── Right-space bounds ─────────────────────────────────────────────────────── */
function getRightBounds() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 18;
  const xMin = vw / 2 + CONTENT_HALF + pad;
  const xMax = vw - ROBOT_W - pad;
  const yMin = TOPBAR_H + pad;
  const yMax = vh - ROBOT_H - pad;
  return {
    xMin,
    xMax,
    yMin,
    yMax,
    hasSpace: xMax - xMin > ROBOT_W,
  };
}

function randomPt(b: ReturnType<typeof getRightBounds>) {
  return {
    x: b.xMin + Math.random() * (b.xMax - b.xMin),
    y: b.yMin + Math.random() * (b.yMax - b.yMin),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampRobotPos(x: number, y: number) {
  return {
    x: clamp(x, DRAG_PAD, window.innerWidth - ROBOT_W - DRAG_PAD),
    y: clamp(y, TOPBAR_H + DRAG_PAD, window.innerHeight - ROBOT_H - DRAG_PAD),
  };
}

/* ── Bot replies ────────────────────────────────────────────────────────────── */
function getBotReply(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('sim') || m.includes('yes') || m.includes('claro'))
    return 'Sabia! 😄 Use à vontade.';
  if (m.includes('não') || m.includes('nao')) return 'Tudo bem, era só curiosidade 🤖';
  if (m.includes('oi') || m.includes('olá')) return 'Oi! Só sou um robô de testes 🟢';
  if (m.includes('obrigad')) return 'De nada! Estarei por aqui 👾';
  return `Anotado: "${msg}" 📝`;
}

export type Msg = { who: 'bot' | 'user'; text: string };

type InspectHealthyDetail = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

/* ── Wake robot from outside (search) ──────────────────────────────────────── */
export function wakeRobot() {
  window.dispatchEvent(new CustomEvent('robot:wake'));
}

/* ── Component ──────────────────────────────────────────────────────────────── */
export function RobotCursor() {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ x: -200, y: -200 });
  const [active, setActive] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatClosing, setChatClosing] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ who: 'bot', text: ROBOT_MSG }]);
  const [input, setInput] = useState('');
  const [blink, setBlink] = useState(false);
  const [moving, setMoving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [justInspected, setJustInspected] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const wanderRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const inspectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inspectCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Mark as mounted (avoids SSR hydration mismatch) and seed the initial
     position on the client. The synchronous setState on mount is required to
     flip from the server-rendered placeholder to the client state. */
  useEffect(() => {
    setMounted(true);
    const b = getRightBounds();
    if (b.hasSpace) setPos(randomPt(b));
  }, []);

  /* ── Wander ─────────────────────────────────────────────────────────────── */
  /* Keep the latest scheduler in a ref so the recursive setTimeout callback
     always calls the current version without self-referencing during init. */
  const scheduleWanderRef = useRef<() => void>(() => {});

  const scheduleWander = useCallback(() => {
    const delay = 3500 + Math.random() * 3000;
    wanderRef.current = setTimeout(() => {
      if (chatOpen || dragging || justInspected) {
        scheduleWanderRef.current();
        return;
      }
      const b = getRightBounds();
      if (b.hasSpace) {
        setMoving(true);
        setPos(randomPt(b));
        setTimeout(() => setMoving(false), 2200);
      }
      scheduleWanderRef.current();
    }, delay);
  }, [chatOpen, dragging, justInspected]);

  useEffect(() => {
    scheduleWanderRef.current = scheduleWander;
  }, [scheduleWander]);

  useEffect(() => {
    scheduleWander();
    return () => {
      if (wanderRef.current) clearTimeout(wanderRef.current);
    };
  }, [scheduleWander]);

  /* ── Resize: recalculate if bounds change ────────────────────────────────── */
  useEffect(() => {
    function onResize() {
      setPos((prev) => clampRobotPos(prev.x, prev.y));
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* ── Wake from search ────────────────────────────────────────────────────── */
  useEffect(() => {
    function onWake() {
      if (chatOpen) return;
      setActive(true);
      if (activeRef.current) clearTimeout(activeRef.current);
      activeRef.current = setTimeout(() => setActive(false), 4000);
    }
    window.addEventListener('robot:wake', onWake);
    return () => window.removeEventListener('robot:wake', onWake);
  }, [chatOpen]);

  /* ── React to Healthy click on project detail ───────────────────────────── */
  useEffect(() => {
    function onInspectHealthy(event: Event) {
      const custom = event as CustomEvent<InspectHealthyDetail>;
      const detail = custom.detail;
      if (!detail) return;

      const sideGap = 12;
      const yCenter = detail.top + detail.height / 2;
      const leftTargetX = detail.left - ROBOT_W - sideGap;
      const rightTargetX = detail.right + sideGap;

      const leftFits = leftTargetX >= DRAG_PAD;
      const rightFits = rightTargetX <= window.innerWidth - ROBOT_W - DRAG_PAD;
      const prefersRight = window.innerWidth - detail.right >= detail.left;

      const targetX = prefersRight
        ? rightFits
          ? rightTargetX
          : leftTargetX
        : leftFits
          ? leftTargetX
          : rightTargetX;

      const target = clampRobotPos(targetX, yCenter - ROBOT_H / 2);

      if (inspectTimerRef.current) clearTimeout(inspectTimerRef.current);
      if (inspectCooldownRef.current) clearTimeout(inspectCooldownRef.current);
      setChatOpen(false);
      setActive(true);
      setMoving(true);
      setJustInspected(true);
      setPos(target);
      setMsgs([{ who: 'bot', text: 'Nossa, o servidor está funcionando bem, né?' }]);

      inspectTimerRef.current = setTimeout(() => {
        setMoving(false);
        setChatOpen(true);
      }, ROBOT_TRAVEL_MS);

      /* After closing chat, prevent wander for 4s so robô stays put */
      inspectCooldownRef.current = setTimeout(() => {
        setJustInspected(false);
      }, 7000);
    }

    window.addEventListener('robot:inspect-healthy', onInspectHealthy as EventListener);
    return () => {
      window.removeEventListener('robot:inspect-healthy', onInspectHealthy as EventListener);
      if (inspectTimerRef.current) clearTimeout(inspectTimerRef.current);
      if (inspectCooldownRef.current) clearTimeout(inspectCooldownRef.current);
    };
  }, []);

  /* ── Blink ───────────────────────────────────────────────────────────────── */
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    function loop() {
      t = setTimeout(
        () => {
          setBlink(true);
          setTimeout(() => {
            setBlink(false);
            loop();
          }, 130);
        },
        2500 + Math.random() * 3000,
      );
    }
    loop();
    return () => clearTimeout(t);
  }, []);

  /* ── Focus input + scroll when chat opens ────────────────────────────────── */
  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [chatOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  /* ── Send message ────────────────────────────────────────────────────────── */
  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setMsgs((prev) => [...prev, { who: 'user', text }, { who: 'bot', text: getBotReply(text) }]);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    setActive(false);
    setDragging(true);
    dragRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - pos.x,
      offsetY: e.clientY - pos.y,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const { x: nextX, y: nextY } = clampRobotPos(
      e.clientX - drag.offsetX,
      e.clientY - drag.offsetY,
    );

    if (!drag.moved && (Math.abs(nextX - pos.x) > 2 || Math.abs(nextY - pos.y) > 2)) {
      drag.moved = true;
    }

    setMoving(false);
    setPos({ x: nextX, y: nextY });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setDragging(false);
    if (drag.moved) suppressClickRef.current = true;
    dragRef.current = null;
  }

  function handlePointerCancel(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setDragging(false);
    dragRef.current = null;
  }

  function handleRobotClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setChatOpen((p) => !p);
    setActive(false);
  }

  /* ── Inactivity: auto-close chat after 8s of no interaction ──────────────── */
  const scheduleInactivityClose = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

    inactivityTimerRef.current = setTimeout(() => {
      /* Fade-out animation */
      setChatClosing(true);
      setTimeout(() => {
        setChatOpen(false);
        setChatClosing(false);
      }, 200);
    }, 8000);
  }, []);

  useEffect(() => {
    if (!chatOpen) {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      return;
    }

    scheduleInactivityClose();

    const onActivity = () => scheduleInactivityClose();
    /* Capture the current node so cleanup detaches from the same element */
    const chatBox = chatBoxRef.current;

    /* Detect activity: mouse move, clicks, keyboard, scroll */
    document.addEventListener('mousemove', onActivity);
    document.addEventListener('click', onActivity);
    document.addEventListener('keydown', onActivity);
    chatBox?.addEventListener('scroll', onActivity);

    return () => {
      document.removeEventListener('mousemove', onActivity);
      document.removeEventListener('click', onActivity);
      document.removeEventListener('keydown', onActivity);
      chatBox?.removeEventListener('scroll', onActivity);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [chatOpen, scheduleInactivityClose]);

  if (!mounted) return null;

  const isGreen = active || chatOpen;
  const bounds = getRightBounds();
  if (!bounds.hasSpace) return null; // hide if no right space

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const leftSpace = pos.x;
  const rightSpace = vw - (pos.x + ROBOT_W);
  const topSpace = pos.y - TOPBAR_H;
  const bottomSpace = vh - (pos.y + ROBOT_H);

  const chatHorizontalClass =
    leftSpace < CHAT_W + DRAG_PAD && rightSpace >= CHAT_W + DRAG_PAD
      ? styles.chatRight
      : rightSpace < CHAT_W + DRAG_PAD && leftSpace >= CHAT_W + DRAG_PAD
        ? styles.chatLeft
        : rightSpace >= leftSpace
          ? styles.chatRight
          : styles.chatLeft;

  const chatVerticalClass =
    topSpace < CHAT_H_EST && bottomSpace > topSpace ? styles.chatBelow : styles.chatAbove;

  return (
    <div
      className={`${styles.root} ${dragging ? styles.dragging : ''}`}
      style={{ left: pos.x, top: pos.y }}
    >
      {/* ── Chat bubbles ───────────────────────────────────────────────────── */}
      {chatOpen && (
        <div
          ref={chatBoxRef}
          className={`${styles.chatBox} ${chatHorizontalClass} ${chatVerticalClass} ${chatClosing ? styles.chatClosing : ''}`}
        >
          <div className={styles.msgs}>
            {msgs.map((m, i) => (
              <div key={i} className={m.who === 'bot' ? styles.bubbleBot : styles.bubbleUser}>
                {m.text}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form className={styles.inputRow} onSubmit={handleSend}>
            <input
              ref={inputRef}
              className={styles.chatInput}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Responda…"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className={styles.sendBtn} aria-label="Enviar">
              <IconSend size={13} />
            </button>
          </form>
        </div>
      )}

      {/* ── Robot body ─────────────────────────────────────────────────────── */}
      <button
        className={`${styles.robot} ${isGreen ? styles.robotActive : ''} ${moving ? styles.moving : ''} ${dragging ? styles.robotDragging : ''}`}
        onClick={handleRobotClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        aria-label="Falar com o robô"
      >
        {isGreen ? (
          <div className={styles.blob}>
            <div className={styles.blobShine} />
            <div className={styles.blobEyes}>
              {[0, 1].map((i) => (
                <div key={i} className={`${styles.blobEye} ${blink ? styles.blink : ''}`}>
                  <div className={styles.blobPupil} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.idleFace}>
            <div className={styles.idleEyes}>
              <div className={`${styles.idleEye} ${blink ? styles.blink : ''}`} />
              <div className={`${styles.idleEye} ${blink ? styles.blink : ''}`} />
            </div>
          </div>
        )}
      </button>

      {/* Ground shadow */}
      <div className={`${styles.shadow} ${isGreen ? styles.shadowActive : ''}`} />
    </div>
  );
}

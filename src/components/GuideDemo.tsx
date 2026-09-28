'use client';

import type { Guide, GuideVariant } from '@/guides/types';
import { useTheme } from 'next-themes';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

function subscribeMotion(update: () => void) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', update);
  return () => query.removeEventListener('change', update);
}

function motionSnapshot() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function subscribeLanguage(update: () => void) {
  const observer = new MutationObserver(update);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  return () => observer.disconnect();
}

function languageSnapshot() {
  return document.documentElement.lang || 'en';
}

function timecode(seconds: number) {
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

function GuideInstructions({ guide, variant }: { guide: Guide; variant?: GuideVariant }) {
  return (
    <>
      <h2>Step by step</h2>
      <ol className="guide-instructions">
        {guide.steps.map(step => (
          <li key={step.id} id={`step-${step.id}`}>
            <strong>{step.title}</strong>
            <p>{step.text}</p>
            {variant?.steps.some(recorded => recorded.id === step.id) && (
              <a href={`#watch-${step.id}`}>Watch this step</a>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}

export function GuideDemo({ guide }: { guide: Guide }) {
  const { resolvedTheme } = useTheme();
  const [variants, setVariants] = useState<GuideVariant[]>([]);
  const language = useSyncExternalStore(subscribeLanguage, languageSnapshot, () => 'en').toLowerCase();
  const [mode, setMode] = useState('watch');
  const [stepId, setStepId] = useState(guide.steps[0]?.id ?? '');
  const reducedMotion = useSyncExternalStore(subscribeMotion, motionSnapshot, () => true);
  const [muted, setMuted] = useState(true);
  const [ringVariant, setRingVariant] = useState<string | null>(null);
  const [errorVariant, setErrorVariant] = useState<string | null>(null);
  const player = useRef<HTMLVideoElement>(null);
  const panel = useRef<HTMLElement>(null);
  const pendingSeek = useRef<string | null>(null);
  const manualPlayback = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastVariant = useRef<string | null>(null);
  const desiredTheme = resolvedTheme === 'dark' ? 'dark' : 'light';
  const selectedLanguage = [language, language.split('-')[0], 'en']
    .find(locale => variants.some(v => v.language.toLowerCase() === locale));
  const variant = variants
    .filter(v => v.language.toLowerCase() === selectedLanguage && v.theme === desiredTheme)
    .sort((a, b) => b.apiLevel - a.apiLevel)[0];
  const ring = !!variant && ringVariant === variant.id;
  const mediaError = !!variant && errorVariant === variant.id;
  const step = variant?.steps.find(s => s.id === stepId) ?? variant?.steps[0];
  const stepIndex = variant?.steps.findIndex(s => s.id === step?.id) ?? 0;
  const instruction = variant?.transcript.find(s => s.id === step?.id) ?? guide.steps.find(s => s.id === step?.id);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/guides/index.json', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Could not load captures');
        }
        return await response.json() as { schemaVersion: number; variants: GuideVariant[] };
      })
      .then((index) => {
        if (index.schemaVersion !== 1 || !Array.isArray(index.variants)) {
          throw new Error('Unsupported capture index');
        }
        const available = index.variants.filter(v => v.guide === guide.id);
        setVariants(available);
      })
      .catch(() => {
        // The written instructions remain available when the capture index cannot load.
      });
    return () => controller.abort();
  }, [guide.id]);

  useEffect(() => {
    const followHash = () => {
      const id = window.location.hash.replace(/^#watch-/, '');
      if (guide.steps.some(s => s.id === id)) {
        pendingSeek.current = id;
        manualPlayback.current = true;
        player.current?.pause();
        // Synchronize browser-owned URL state, including the initial deep link.
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setStepId(id);
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setMode('watch');
        panel.current?.scrollIntoView({ block: 'nearest' });
      }
    };
    followHash();
    window.addEventListener('hashchange', followHash);
    return () => window.removeEventListener('hashchange', followHash);
  }, [guide.steps]);

  useEffect(() => {
    const id = pendingSeek.current;
    const video = player.current;
    if (id !== null && video && video.readyState >= 1 && variant) {
      const target = variant.steps.find(s => s.id === id);
      if (target) {
        video.currentTime = target.startSeconds;
        pendingSeek.current = null;
      }
    }
  }, [stepId, variant, mode]);

  useEffect(() => {
    if (lastVariant.current !== null && lastVariant.current !== variant?.id) {
      if (advanceTimer.current !== null) {
        clearTimeout(advanceTimer.current);
        advanceTimer.current = null;
      }
      manualPlayback.current = true;
      pendingSeek.current = stepId;
      player.current?.pause();
    }
    if (variant) {
      lastVariant.current = variant.id;
    }
  }, [variant, stepId]);

  useEffect(() => {
    const video = player.current;
    if (!video || !variant || mode !== 'watch') {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting && !manualPlayback.current) {
        video.pause();
      } else if (entry?.isIntersecting && !reducedMotion && muted && !manualPlayback.current && pendingSeek.current === null) {
        void video.play().catch(() => {});
      }
    }, { threshold: 0.5 });
    observer.observe(video);
    return () => observer.disconnect();
  }, [variant, reducedMotion, muted, mode]);

  useEffect(() => {
    if (reducedMotion) {
      player.current?.pause();
    }
  }, [reducedMotion]);

  useEffect(() => {
    if (!ring) {
      return;
    }
    const timer = window.setTimeout(() => setRingVariant(null), 600);
    return () => window.clearTimeout(timer);
  }, [ring]);

  useEffect(() => () => {
    if (advanceTimer.current !== null) {
      clearTimeout(advanceTimer.current);
    }
  }, []);

  function selectStep(id: string) {
    if (advanceTimer.current !== null) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    setRingVariant(null);
    manualPlayback.current = true;
    setStepId(id);
    const target = variant?.steps.find(s => s.id === id);
    if (player.current && target && player.current.readyState >= 1) {
      player.current.currentTime = target.startSeconds;
    } else {
      pendingSeek.current = id;
    }
    window.history.replaceState(null, '', `#watch-${id}`);
  }

  if (!variant) {
    return <GuideInstructions guide={guide} />;
  }

  return (
    <>
      <section className="guide-demo" ref={panel} aria-label={`${guide.title} walkthrough`}>
        <div className="guide-controls" aria-label="Walkthrough mode">
          <button
            type="button"
            aria-pressed={mode === 'watch'}
            onClick={() => {
              pendingSeek.current = stepId;
              setMode('watch');
            }}
          >
            Watch
          </button>
          <button
            type="button"
            aria-pressed={mode === 'steps'}
            onClick={() => {
              player.current?.pause();
              setMode('steps');
            }}
          >
            Step through
          </button>
          {variant.narrated && mode === 'watch' && (
            <button
              type="button"
              onClick={() => {
                manualPlayback.current = true;
                setMuted(false);
                if (player.current) {
                  player.current.muted = false;
                  player.current.loop = false;
                  void player.current.play().catch(() => {});
                }
              }}
            >
              Listen
            </button>
          )}
        </div>
        <div className="guide-stage">
          <div className="guide-screen" style={{ aspectRatio: `${variant.width}/${variant.height}` }}>
            {mode === 'watch'
              ? (
                  <video
                    key={variant.id}
                    ref={player}
                    controls
                    playsInline
                    muted={muted}
                    loop={muted}
                    preload="metadata"
                    poster={variant.poster}
                    width={variant.width}
                    height={variant.height}
                    aria-label={guide.title}
                    onPointerDown={() => {
                      manualPlayback.current = true;
                    }}
                    onKeyDown={() => {
                      manualPlayback.current = true;
                    }}
                    onVolumeChange={() => setMuted(player.current?.muted ?? true)}
                    onError={() => setErrorVariant(variant.id)}
                    onLoadedMetadata={() => {
                      setErrorVariant(null);
                      const id = pendingSeek.current ?? stepId;
                      const target = variant.steps.find(s => s.id === id);
                      if (target && player.current) {
                        player.current.currentTime = target.startSeconds;
                      }
                      pendingSeek.current = null;
                    }}
                    onTimeUpdate={() => {
                      const position = player.current?.currentTime ?? 0;
                      const current = variant.steps.find(s => position >= s.startSeconds && position < s.endSeconds);
                      if (current) {
                        setStepId(current.id);
                      }
                    }}
                  >
                    <source src={variant.webm} type={variant.narrated ? 'video/webm; codecs="vp9,opus"' : 'video/webm; codecs="vp9"'} />
                    <source src={variant.mp4} type="video/mp4" />
                    <track kind="chapters" src={variant.chapters} srcLang="en" label="Steps" />
                    <track key={variant.captions ?? variant.chapters} kind="captions" src={variant.captions ?? variant.chapters} srcLang={variant.captions !== undefined ? variant.language : 'en'} label={variant.captions !== undefined ? variant.language : 'Instructions'} />
                  </video>
                )
              : step && (
                <>
                  {/* Screenshots are generated at their recorded dimensions; no image optimization is needed. */}
                  {/* eslint-disable-next-line next/no-img-element */}
                  <img src={step.image} alt={`${instruction?.title ?? guide.title}: captured app screen`} width={variant.width} height={variant.height} />
                  {step.hotspot && stepIndex < variant.steps.length - 1 && (
                    <button
                      type="button"
                      disabled={ring}
                      className={`guide-hotspot${ring ? ' guide-hotspot-active' : ''}`}
                      aria-label={`${instruction?.title ?? 'Continue'} — next step`}
                      style={{ left: `${step.hotspot.x * 100}%`, top: `${step.hotspot.y * 100}%`, width: `${step.hotspot.width * 100}%`, height: `${step.hotspot.height * 100}%` }}
                      onClick={() => {
                        setRingVariant(variant.id);
                        const next = variant.steps[stepIndex + 1];
                        if (next) {
                          advanceTimer.current = setTimeout(() => selectStep(next.id), reducedMotion ? 150 : 600);
                        }
                      }}
                    >
                      <span aria-hidden="true">●</span>
                    </button>
                  )}
                </>
              )}
          </div>
          <div className="guide-chapters">
            {mediaError && <p role="alert">Video playback is unavailable. Use Step through or the written instructions.</p>}
            <ol aria-label="Video chapters">
              {variant.steps.map(s => (
                <li key={s.id}>
                  <button type="button" aria-current={step?.id === s.id ? 'step' : undefined} onClick={() => selectStep(s.id)}>
                    <span className="guide-timecode">{timecode(s.startSeconds)}</span>
                    {guide.steps.find(item => item.id === s.id)?.title ?? s.id}
                  </button>
                </li>
              ))}
            </ol>
            <p aria-live={mode === 'steps' ? 'polite' : 'off'}>{instruction?.text}</p>
            <div className="guide-controls">
              <button
                type="button"
                disabled={stepIndex <= 0}
                onClick={() => {
                  const previous = variant.steps[stepIndex - 1];
                  if (previous) {
                    selectStep(previous.id);
                  }
                }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={stepIndex >= variant.steps.length - 1}
                onClick={() => {
                  const next = variant.steps[stepIndex + 1];
                  if (next) {
                    selectStep(next.id);
                  }
                }}
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => {
                  const first = variant.steps[0];
                  if (first) {
                    selectStep(first.id);
                  }
                }}
              >
                Restart
              </button>
            </div>
            <p className="guide-provenance">
              Recorded with ConnectBot
              {' '}
              {variant.appVersion}
              .
              {' '}
              {variant.narrated && 'AI-generated narration.'}
            </p>
            {variant.narrated && (
              <details>
                <summary>Narration transcript</summary>
                <div lang={variant.language} dir="auto">{variant.transcript.map(s => <p key={s.id}>{s.spoken ?? s.text}</p>)}</div>
              </details>
            )}
          </div>
        </div>
      </section>
      <GuideInstructions guide={guide} variant={mediaError ? undefined : variant} />
    </>
  );
}

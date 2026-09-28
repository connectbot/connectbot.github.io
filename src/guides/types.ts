export type GuideStep = { id: string; title: string; text: string; spoken?: string };

export type Guide = {
  id: string;
  title: string;
  description: string;
  steps: GuideStep[];
};

export type CaptureStep = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  image: string;
  hotspot?: { x: number; y: number; width: number; height: number };
};

export type GuideVariant = {
  id: string;
  guide: string;
  language: string;
  apiLevel: number;
  theme: 'light' | 'dark';
  appVersion: string;
  width: number;
  height: number;
  duration: number;
  poster: string;
  webm: string;
  mp4: string;
  chapters: string;
  captions?: string;
  narrated: boolean;
  transcript: GuideStep[];
  steps: CaptureStep[];
};

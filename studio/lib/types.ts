export type Action =
  | "idle"
  | "walk"
  | "point"
  | "grab"
  | "push"
  | "fall"
  | "celebrate"
  | "surprise";
export type Character = {
  id: string;
  kind: "stickman" | "observer";
  action: Action;
  x: number;
  toX: number;
  scale: number;
  accent: string;
};
export type Prop = {
  id: string;
  kind:
    | "hammer"
    | "feather"
    | "machine"
    | "table"
    | "ball"
    | "arrow"
    | "air"
    | "moon"
    | "book"
    | "chamber";
  x: number;
  y: number;
  toY: number;
  scale: number;
  toX?: number;
  attachTo?: string;
  releaseAt?: number;
  motion?: "ease" | "gravity";
};
export type Scene = {
  id: string;
  narration: string;
  background: "paper" | "lab" | "moon";
  transition: "cut" | "match";
  facts: string[];
  dramatization: boolean;
  characters: Character[];
  props: Prop[];
  camera: {
    mode: "hold" | "pan" | "follow" | "shake" | "zoom";
    zoom: number;
    pan: number;
  };
  sound: "none" | "click" | "whoosh" | "impact";
};
export type Plan = {
  version: 1;
  id: string;
  title: string;
  language: "en-US";
  voice: { provider: "apple"; name: string; rate: number };
  sources: { id: string; url: string; evidence: string }[];
  facts: { id: string; claim: string; source: string }[];
  scenes: Scene[];
};
export type Word = { text: string; start: number; end: number };

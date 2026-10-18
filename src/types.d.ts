declare module 'jsfxr' {
  export const sfxr: {
    toWebAudio(def: Record<string, number>, ctx: AudioContext): { buffer: AudioBuffer };
  };
}

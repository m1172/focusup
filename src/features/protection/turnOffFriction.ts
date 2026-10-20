/**
 * Turning protection on is easy (hold a button); turning it off is deliberately slow:
 * type a commitment sentence, then wait a minute with the option to keep it on.
 */
export const HOLD_TO_ENABLE_MS = 2000;
export const TURN_OFF_WAIT_MS = 60_000;

/** Lower-case, one kind of apostrophe, single spaces, no trailing full stop — so only the words count. */
export function normalizePhrase(text: string): string {
  return text.toLocaleLowerCase().replace(/[‘’ʻʼ`´]/g, "'").replace(/\s+/g, ' ').trim().replace(/[.!]+$/, '');
}

export function phraseMatches(input: string, phrase: string): boolean {
  return normalizePhrase(input) === normalizePhrase(phrase);
}

/** Whole seconds left until `endsAt`, never negative. */
export function secondsLeft(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** "1:00", "0:07". */
export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const fold = (char: string) => char.toLocaleLowerCase().replace(/[‘’ʻʼ`´]/, "'");

/**
 * Typing-game feedback: how many leading characters of the phrase are typed correctly
 * (case and apostrophe style don't matter) and whether something wrong follows them.
 */
export function typingProgress(input: string, phrase: string): { correct: number; mistake: boolean } {
  let correct = 0;
  while (correct < input.length && correct < phrase.length && fold(input[correct]!) === fold(phrase[correct]!)) correct += 1;
  return { correct, mistake: input.trimEnd().length > correct };
}

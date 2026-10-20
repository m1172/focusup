import { formatCountdown, phraseMatches, secondsLeft, typingProgress } from '../turnOffFriction';

const phrase = 'Men bu filtrni o‘z xohishim bilan o‘chiryapman va vaqtimni o‘zim nazorat qilaman';

describe('turn-off phrase', () => {
  it('accepts the sentence regardless of case, spacing, apostrophe style or a final full stop', () => {
    expect(phraseMatches(phrase, phrase)).toBe(true);
    expect(phraseMatches("men bu filtrni o'z xohishim bilan  o'chiryapman va vaqtimni o'zim nazorat qilaman.", phrase)).toBe(true);
    expect(phraseMatches('MEN BU FILTRNI OʻZ XOHISHIM BILAN OʻCHIRYAPMAN VA VAQTIMNI OʻZIM NAZORAT QILAMAN', phrase)).toBe(true);
  });

  it('rejects partial or different text', () => {
    expect(phraseMatches('Men bu filtrni o‘chiryapman', phrase)).toBe(false);
    expect(phraseMatches('', phrase)).toBe(false);
    expect(phraseMatches(phrase + ' hozir', phrase)).toBe(false);
  });
});

describe('one-minute wait', () => {
  it('counts down whole seconds and stops at zero', () => {
    expect(secondsLeft(61_000, 1_000)).toBe(60);
    expect(secondsLeft(61_000, 60_500)).toBe(1);
    expect(secondsLeft(61_000, 90_000)).toBe(0);
  });

  it('formats the countdown', () => {
    expect(formatCountdown(60)).toBe('1:00');
    expect(formatCountdown(7)).toBe('0:07');
  });
});

describe('typing game progress', () => {
  it('counts correct leading characters and flags the first mistake', () => {
    expect(typingProgress('', phrase)).toEqual({ correct: 0, mistake: false });
    expect(typingProgress('men bu', phrase)).toEqual({ correct: 6, mistake: false });
    expect(typingProgress("Men bu filtrni o'z", phrase)).toEqual({ correct: 18, mistake: false });
    expect(typingProgress('Men bx', phrase)).toEqual({ correct: 5, mistake: true });
    expect(typingProgress(phrase, phrase).correct).toBe(phrase.length);
  });
});

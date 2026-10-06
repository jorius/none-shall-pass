type Data = Record<string, string | number | boolean>;
type Umami = { track: (name: string, data?: Data) => unknown };

// Umami Cloud, cookieless; a blocked or missing tracker must never break the game.
export const track = (name: string, data?: Data): void => {
  try {
    const sent = (window as unknown as { umami?: Umami }).umami?.track(name, data);
    // Its request can still fail later, and that must not surface as an unhandled rejection either.
    if (sent instanceof Promise) sent.catch(() => {});
  } catch {
    /* tracker blocked */
  }
};

export const scoreBucket = (score: number): string =>
  score < 1000 ? '0-999' : score < 5000 ? '1k-4.9k' : score < 10000 ? '5k-9.9k' : score < 25000 ? '10k-24.9k' : score < 50000 ? '25k-49.9k' : '50k+';

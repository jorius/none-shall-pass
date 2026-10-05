// core
import { MAX_STEPS_PER_FRAME, STEP } from './constants';

// Fixed-timestep accumulator. A tab that was hidden for minutes comes back with a
// huge delta; the backlog is dropped so the run never fast-forwards.
export const frameSteps = (acc: number, deltaMs: number): { steps: number; acc: number } => {
  let a = acc + Math.max(0, deltaMs) / 1000;
  let steps = Math.floor(a / STEP + 1e-9);
  a -= steps * STEP;
  if (steps > MAX_STEPS_PER_FRAME) { steps = MAX_STEPS_PER_FRAME; a = 0; }
  return { steps, acc: Math.max(0, a) };
};

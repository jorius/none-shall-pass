// core
import type { RunEvent } from '../core/events';
import type { Screen } from '../core/keys';
import type { Run } from '../core/run';

// Everything that draws (Phaser views and DOM panels) implements some of these.
// `dt` is 0 whenever the simulation is not running; `time` keeps advancing unless paused.
export interface View {
  start?(run: Run): void;
  event?(ev: RunEvent, run: Run): void;
  frame?(run: Run | null, dt: number, time: number): void;
  pause?(paused: boolean): void;
  screen?(s: Screen): void;
  refresh?(run: Run | null): void;
}

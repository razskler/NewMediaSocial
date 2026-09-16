/**
 * Live-activity daemon: at every (randomized) tick one bot performs one
 * weighted-random action — like, comment, follow, reply or post. Bots
 * also organically engage with real users' posts because actions pick
 * from the most recent posts regardless of author.
 */

import {
  botComment,
  botCreatePost,
  botFollow,
  botLike,
  botReply,
} from "./actions";
import { botEnv } from "./env";
import { randomFrom } from "./personas";
import { listBots, type BotRecord } from "./registry";
import { runSeed } from "./seed";

type WeightedAction = {
  weight: number;
  run: (bot: BotRecord) => Promise<void>;
};

const ACTIONS: WeightedAction[] = [
  { weight: 40, run: botLike },
  { weight: 25, run: botComment },
  { weight: 15, run: botFollow },
  { weight: 10, run: botReply },
  { weight: 10, run: botCreatePost },
];

function pickAction(): WeightedAction {
  const total = ACTIONS.reduce((sum, a) => sum + a.weight, 0);
  let roll = Math.random() * total;
  for (const action of ACTIONS) {
    roll -= action.weight;
    if (roll <= 0) {
      return action;
    }
  }
  return ACTIONS[0];
}

let stopped = false;
let wake: (() => void) | null = null;

/** Sleeps `ms`, but resolves immediately when shutdown is requested. */
function interruptibleSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    wake = () => {
      clearTimeout(timer);
      resolve();
    };
  });
}

const stop = () => {
  stopped = true;
  wake?.();
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

export async function runDaemon(): Promise<void> {
  if ((await listBots()).length === 0) {
    console.log("[bots] empty registry, seeding first");
    await runSeed();
  }
  const bots = await listBots();
  console.log(
    `[bots] daemon started with ${bots.length} bots, tick every ` +
      `${Math.round(botEnv.tickMinMs / 1000)}-${Math.round(botEnv.tickMaxMs / 1000)}s`,
  );

  while (!stopped) {
    const tick =
      botEnv.tickMinMs +
      Math.random() * Math.max(0, botEnv.tickMaxMs - botEnv.tickMinMs);
    await interruptibleSleep(tick);
    if (stopped) {
      break;
    }
    const bot = randomFrom(bots);
    const action = pickAction();
    try {
      await action.run(bot);
    } catch (err) {
      console.error(`[bots] action failed: ${(err as Error).message}`);
    }
  }

  console.log("[bots] daemon stopped");
}

import { EventEmitter } from "node:events";

declare global {
  // eslint-disable-next-line no-var
  var _dmEventBus: EventEmitter | undefined;
}

export function dmEventBus(): EventEmitter {
  if (!globalThis._dmEventBus) {
    globalThis._dmEventBus = new EventEmitter();
    globalThis._dmEventBus.setMaxListeners(0);
  }
  return globalThis._dmEventBus;
}

export function dmUserEventName(userId: string): string {
  return `dm:user:${userId}`;
}

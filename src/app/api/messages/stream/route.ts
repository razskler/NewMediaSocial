import { createClient } from "@/lib/supabase/server";
import { dmEventBus, dmUserEventName } from "@/lib/events";
import type { DmEvent } from "@/lib/messages";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const bus = dmEventBus();
  const eventName = dmUserEventName(user.id);
  const encoder = new TextEncoder();
  let teardown: () => void = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | undefined;

      const cleanup = () => {
        if (closed) {
          return;
        }
        closed = true;
        bus.off(eventName, onEvent);
        if (heartbeat !== undefined) {
          clearInterval(heartbeat);
        }
        request.signal.removeEventListener("abort", cleanup);
        try {
          controller.close();
        } catch {
          // Stream already torn down by the client.
        }
      };
      teardown = cleanup;

      const send = (payload: string) => {
        if (closed) {
          return;
        }
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          cleanup();
        }
      };

      const onEvent = (event: DmEvent) => {
        send(`event: dm\ndata: ${JSON.stringify(event)}\n\n`);
      };

      heartbeat = setInterval(() => {
        send(": ping\n\n");
      }, 25_000);

      bus.on(eventName, onEvent);
      request.signal.addEventListener("abort", cleanup);

      send("retry: 3000\n\n");
      send(": connected\n\n");
    },
    cancel() {
      teardown();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

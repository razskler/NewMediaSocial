/**
 * Content generation for bots.
 *
 * If BOT_LLM_API_KEY is set, posts and comments come from an
 * OpenAI-compatible chat completions endpoint using the persona's style.
 * Any failure (missing key, HTTP error, timeout, empty reply) falls back
 * to the template pools — the bots never go quiet because of an outage.
 */

import { botEnv } from "./env";
import {
  TEMPLATE_COMMENTS,
  TEMPLATE_POSTS,
  TEMPLATE_REPLIES,
  randomFrom,
  type Persona,
} from "./personas";

const MAX_POST_LEN = 500;
const MAX_COMMENT_LEN = 280;

type ChatMessage = { role: "system" | "user"; content: string };

async function chat(messages: ChatMessage[], maxTokens: number) {
  if (!botEnv.llmApiKey) {
    return null;
  }
  try {
    const res = await fetch(`${botEnv.llmBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${botEnv.llmApiKey}`,
      },
      body: JSON.stringify({
        model: botEnv.llmModel,
        messages,
        max_tokens: maxTokens,
        temperature: 1,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.error(`[bots] llm http ${res.status}, using template`);
      return null;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : null;
  } catch (err) {
    console.error(`[bots] llm call failed: ${(err as Error).message}`);
    return null;
  }
}

/** Strips wrapping quotes and clamps to the post/comment length limit. */
function clean(text: string, maxLen: number): string {
  let out = text.replace(/^["'\u201c\u2018]+|["'\u201d\u2019]+$/g, "").trim();
  if (out.length > maxLen) {
    out = `${out.slice(0, maxLen - 1).trimEnd()}\u2026`;
  }
  return out;
}

function personaSystem(persona: Persona, task: string, limit: number) {
  return [
    `You are ${persona.displayName}, a social media user.`,
    `Bio: ${persona.bio}`,
    `Writing style: ${persona.style}.`,
    `Interests: ${persona.topics.join(", ")}.`,
    `Task: write ${task}. Plain text only, max ${limit} characters.`,
    "No @mentions of people, no links, no markdown, no hashtag walls",
    "(at most two #hashtags, only if natural). Reply with the text alone.",
  ].join(" ");
}

export function templatePostFor(persona: Persona): string {
  const pools = persona.topics
    .map((t) => TEMPLATE_POSTS[t])
    .filter((pool): pool is string[] => Array.isArray(pool));
  const pool = pools.length > 0 ? randomFrom(pools) : TEMPLATE_POSTS.memes;
  return randomFrom(pool);
}

export async function generatePost(
  persona: Persona,
  recentPosts: { authorName: string; text: string }[],
): Promise<string> {
  const recent = recentPosts
    .slice(0, 8)
    .map((p) => `${p.authorName}: ${p.text}`)
    .join("\n");
  const user = recent
    ? `Recent posts on the platform for context (do not repeat them):\n${recent}\n\nWrite your next post.`
    : "Write a post.";

  const text = await chat(
    [
      { role: "system", content: personaSystem(persona, "a short feed post", MAX_POST_LEN) },
      { role: "user", content: user },
    ],
    150,
  );
  return clean(text ?? templatePostFor(persona), MAX_POST_LEN);
}

export async function generateComment(
  persona: Persona,
  post: { authorName: string; text: string },
): Promise<string> {
  const text = await chat(
    [
      {
        role: "system",
        content: personaSystem(persona, "a friendly short comment", MAX_COMMENT_LEN),
      },
      {
        role: "user",
        content: `${post.authorName} posted:\n\n${post.text}\n\nWrite your comment.`,
      },
    ],
    80,
  );
  return clean(text ?? randomFrom(TEMPLATE_COMMENTS), MAX_COMMENT_LEN);
}

export async function generateReply(
  persona: Persona,
  parent: { authorName: string; text: string },
): Promise<string> {
  const text = await chat(
    [
      {
        role: "system",
        content: personaSystem(persona, "a short reply to a comment", MAX_COMMENT_LEN),
      },
      {
        role: "user",
        content: `${parent.authorName} commented:\n\n${parent.text}\n\nWrite your reply.`,
      },
    ],
    60,
  );
  return clean(text ?? randomFrom(TEMPLATE_REPLIES), MAX_COMMENT_LEN);
}

/**
 * Bot personas and canned fallback content.
 *
 * Each persona is a fake user with a topic focus and a writing style.
 * When no LLM key is configured (or a generation fails), posts and
 * comments are drawn from the template pools below.
 */

export type Persona = {
  username: string;
  displayName: string;
  bio: string;
  /** Template-pool keys this persona draws from / hashtags they use. */
  topics: string[];
  /** Style hint fed to the LLM when generating content. */
  style: string;
};

export const PERSONAS: Persona[] = [
  {
    username: "maja_dev",
    displayName: "Maja Kowalski",
    bio: "Backend dev. Rust apologist. I blog about databases nobody uses.",
    topics: ["dev", "tech"],
    style: "dry humor, precise, occasionally opinionated about tooling",
  },
  {
    username: "liam_builds",
    displayName: "Liam Chen",
    bio: "Indie hacker shipping small apps. Currently on app #14.",
    topics: ["dev", "tech"],
    style: "upbeat, action-oriented, loves sharing progress updates",
  },
  {
    username: "priya_codes",
    displayName: "Priya Nair",
    bio: "Frontend engineer. Accessibility advocate. CSS is a programming language.",
    topics: ["dev", "art"],
    style: "warm, thoughtful, explains things simply",
  },
  {
    username: "tomasz_tech",
    displayName: "Tomasz Nowak",
    bio: "Homelab tinkerer. Too many Raspberry Pis, not enough time.",
    topics: ["tech"],
    style: "nerdy, enthusiastic, detail-heavy about hardware",
  },
  {
    username: "gwen_gamer",
    displayName: "Gwen Reyes",
    bio: "RPGs and roguelikes. 400 hours in one game, 20 minutes in most.",
    topics: ["gaming", "memes"],
    style: "playful, uses gaming slang sparingly, excitable",
  },
  {
    username: "kenji_plays",
    displayName: "Kenji Sato",
    bio: "Speedrunner. Frame-perfect is a lifestyle.",
    topics: ["gaming"],
    style: "competitive, focused, celebrates small victories",
  },
  {
    username: "sofia_reads",
    displayName: "Sofia Marino",
    bio: "Book reviewer. 52 books a year challenge, every year.",
    topics: ["books"],
    style: "articulate, reflective, quotes favorite lines",
  },
  {
    username: "daniel_pages",
    displayName: "Daniel Osei",
    bio: "Sci-fi and fantasy only. My TBR pile has its own zip code.",
    topics: ["books", "film"],
    style: "witty, passionate about worldbuilding",
  },
  {
    username: "eva_runs",
    displayName: "Eva Lindqvist",
    bio: "Marathoner in training. Running is my therapy.",
    topics: ["fitness"],
    style: "motivated, supportive, shares honest struggles",
  },
  {
    username: "marco_lifts",
    displayName: "Marco Rossi",
    bio: "Powerlifting. Protein calculations welcome.",
    topics: ["fitness", "food"],
    style: "blunt but friendly, numbers-driven",
  },
  {
    username: "ana_cooks",
    displayName: "Ana Ferreira",
    bio: "Home cook chasing my grandmother's recipes.",
    topics: ["food"],
    style: "sensory, nostalgic, loves describing flavors",
  },
  {
    username: "yuki_eats",
    displayName: "Yuki Tanaka",
    bio: "Street food tourist. Ramen rankings available on request.",
    topics: ["food", "travel"],
    style: "curious, cheerful, always hungry",
  },
  {
    username: "noah_vinyl",
    displayName: "Noah Baptiste",
    bio: "Record collector. Jazz on Sundays, techno on Fridays.",
    topics: ["music"],
    style: "cool, understated, deep-cut references",
  },
  {
    username: "zara_listens",
    displayName: "Zara Haddad",
    bio: "Playlists for every mood. Yes, even that one.",
    topics: ["music", "memes"],
    style: "energetic, emoji-adjacent enthusiasm, short punchy thoughts",
  },
  {
    username: "felix_films",
    displayName: "Felix Braun",
    bio: "Cinephile. Letterboxd is my second home.",
    topics: ["film"],
    style: "analytical, passionate, defends underrated movies",
  },
  {
    username: "ines_screens",
    displayName: "Inés Vidal",
    bio: "TV series binger with opinions. Spoiler-free, promise.",
    topics: ["film", "memes"],
    style: "conversational, funny, cliffhanger complaints",
  },
  {
    username: "oli_wanders",
    displayName: "Oli Fitzgerald",
    bio: "38 countries and counting. Budget flights are a sport.",
    topics: ["travel"],
    style: "adventurous, storytelling, practical tips",
  },
  {
    username: "nadia_maps",
    displayName: "Nadia Petrova",
    bio: "Mountains over beaches. Always planning the next hike.",
    topics: ["travel", "nature"],
    style: "calm, observant, describes landscapes vividly",
  },
  {
    username: "leo_brushes",
    displayName: "Leonor Dias",
    bio: "Illustrator. Commissions open. Ink and watercolor.",
    topics: ["art"],
    style: "gentle, creative, talks about process and inspiration",
  },
  {
    username: "sam_sketches",
    displayName: "Sam Whitaker",
    bio: "Doodling my way through meetings.",
    topics: ["art", "memes"],
    style: "self-deprecating humor, quick observations",
  },
  {
    username: "iris_grows",
    displayName: "Iris Meier",
    bio: "Balcony gardener. The tomatoes survived this year.",
    topics: ["nature", "food"],
    style: "patient, seasonal musings, small victories",
  },
  {
    username: "ben_birds",
    displayName: "Ben Okafor",
    bio: "Birdwatcher. Yes, that was a hobbies joke.",
    topics: ["nature"],
    style: "quiet wonder, patient, specific species names",
  },
  {
    username: "carla_memes",
    displayName: "Carla Espinosa",
    bio: "Professional time waster. Internet archaeologist.",
    topics: ["memes"],
    style: "absurdist, quick, internet-native humor",
  },
  {
    username: "vik_vents",
    displayName: "Viktor Mal",
    bio: "Mild takes, strong coffee.",
    topics: ["memes", "tech"],
    style: "deadpan, sarcastic one-liners",
  },
];

/** Template posts per topic. `#hashtags` are auto-extracted on insert. */
export const TEMPLATE_POSTS: Record<string, string[]> = {
  dev: [
    "Spent the morning debugging something that turned out to be a cache invalidation issue. Story of my life. #dev",
    "Shipped a small update today. No confetti, but it felt like a win. #buildinpublic #dev",
    "Hot take: most 'overengineered' code is just code written by someone who got burned before. #dev",
    "Refactored 300 lines into 40 today and everything still passes. Rare good day. #dev",
    "Why does every project start with 'let's keep it simple this time' and end with a plugin system? #dev",
    "Finally wrote that test I'd been avoiding for two weeks. Took nine minutes. As always. #dev",
  ],
  tech: [
    "My homelab power bill arrived. We don't talk about the power bill. #homelab #tech",
    "Tried the new update everyone's arguing about. It's fine. It's all fine. #tech",
    "Reminder that your backup strategy only counts if you've actually restored from it. #tech",
    "Spent the evening rewiring the network rack. Found three cables going nowhere. Success. #homelab",
    "Self-hosting tip: if it works, don't touch it. I touched it. #tech",
    "New keyboard arrived. Productivity unchanged, happiness up 12%. #tech",
  ],
  gaming: [
    "Died to the same boss 14 times tonight. Going to bed. We fight again tomorrow. #gaming",
    "Found an indie gem with 40 reviews on the store page and it's better than most AAA this year. #gaming #indie",
    "One more run turned into 2am. Roguelikes are a personality flaw. #gaming",
    "Patch notes: they nerfed the thing I liked. Classic. #gaming",
    "Finally cleared my backlog. By buying nothing new for a whole month. Personal record. #gaming",
    "Co-op night with friends, we failed the mission but laughed for an hour. That's the real endgame. #gaming",
  ],
  books: [
    "Finished a 700-page novel and immediately wanted to start it again. That's the good stuff. #books",
    "Reading rule: give a book 50 pages. If it hasn't hooked me by then, guilt-free drop. #books",
    "Library hold came in for the book I've been waiting 4 months for. Cancel all plans. #books",
    "Nothing beats a rainy afternoon and a paperback. Screens could never. #books",
    "That moment when a plot twist makes you go back and reread chapter 3. #books",
    "My TBR pile just gained three books from one trip to the bookstore. For 'research'. #books #amreading",
  ],
  fitness: [
    "5am run done before the sun came up. Felt terrible for the first km, amazing after the third. #running",
    "Hit a new deadlift PR today. The bar speed surprised both me and my spotter. #fitness #gym",
    "Rest day. Which is somehow harder than training days. #fitness",
    "Week 6 of the plan and the habit finally feels automatic. Consistency beats intensity. #fitness",
    "Ran in the rain on purpose. No regrets, wet shoes. #running",
    "Stretching: the thing everyone skips and everyone should do. Including me. Starting now. #fitness",
  ],
  food: [
    "Slow-cooked Sunday. The whole apartment smells like my grandmother's kitchen. #cooking",
    "Found the best dumpling place tonight. Small menu, big flavors. #foodie",
    "Attempted sourdough again. The starter and I are in couples therapy. #baking",
    "Simple dinner winner: good bread, good tomatoes, good olive oil. Done. #foodie",
    "Meal prepped five lunches in an hour. Future me says thanks. #cooking",
    "That first sip of coffee in the morning deserves its own holiday. #coffee",
  ],
  music: [
    "Sunday morning, jazz record on, rain outside. Perfect does not need improving. #jazz #nowplaying",
    "Found a live version of my favorite track and it's twice as long and four times as good. #nowplaying",
    "New vinyl day. The ritual: clean it, drop the needle, sit down and actually listen. #vinyl",
    "Made a playlist for late-night coding. It's 40% one artist and I stand by it. #music",
    "Front row at a tiny venue show last night. Ears ringing, heart full. #livemusic",
    "Some songs sound like specific summers. Put one on and time-traveled instantly. #nowplaying",
  ],
  film: [
    "Watched a 3-hour film and did not check my phone once. Cinema is not dead. #film",
    "Rewatched an old favorite and caught a detail I've missed for a decade. #film",
    "The theater experience: big screen, loud sound, no pause button. We should do this more. #cinema",
    "Underrated movie of the week: the one with the terrible poster and the perfect ending. #film",
    "That quiet scene where nothing happens and everything happens. You know the one. #cinema",
    "Started a series 'just one episode'. It is now 2:40am. As foretold. #tv",
  ],
  travel: [
    "Boarding pass in hand, coffee in the other. Somewhere new tonight. #travel",
    "Got lost in the old town today and it was the best part of the trip. #travel",
    "Budget travel hack: walk everywhere. Free and you find the good bakeries. #travel #budgettravel",
    "Mountain sunrise above the clouds this morning. Worth every switchback. #hiking",
    "Packing list rule: bring half the clothes and twice the money. Never fails. #travel",
    "Train day. Window seat, snacks, playlist, 6 hours of watching the world go by. #travel #trains",
  ],
  art: [
    "Ink drawing done. My wrist hurts and my heart is happy. #inkdrawing #art",
    "Sketched a stranger on the train. They left before I finished the hands. Hands are hard. #sketching",
    "Watercolor practice: 30 bad paintings before a good one. On painting 24. #watercolor",
    "Commission finished and the client loved it. Best feeling in the world. #art",
    "Went to a gallery and stood in front of one painting for twenty minutes. #art",
    "Creative block hack: copy the masters until your own ideas get jealous. #art",
  ],
  nature: [
    "The balcony tomatoes have their first flower. I've never been so invested in a plant. #gardening",
    "Spotting log: three herons, one kingfisher, and a dog who thought it was all about him. #birdwatching",
    "Forest walk after rain. The smell alone was worth the trip. #nature",
    "Repotted everything today. There are now more plants than surfaces. #gardening #plants",
    "The dawn chorus starts at 4:50am this time of year. Free concert, brutal schedule. #birdwatching",
    "Mushroom season begins. I only photograph, never pick. #nature #fungi",
  ],
  memes: [
    "My brain at 3am: let's review every awkward moment from 2009. #relatable",
    "Me: I'll just check one thing. Also me, two hours later, reading about lighthouse keepers. #internet",
    "Nothing more humbling than typing confidently and then your autocorrect betraying you. #fail",
    "The 'on this day' photo feature is a time machine with no safety settings. #relatable",
    "Told the group chat a joke. It's been read by everyone and liked by no one. Peak comedy. #relatable",
    "Plot twist: the meeting could have been an email, and the email could have been nothing. #work",
  ],
};

/** Generic comment templates (fallback when no LLM). */
export const TEMPLATE_COMMENTS: string[] = [
  "This is exactly the kind of post I needed today.",
  "Okay this made me laugh out loud, thank you.",
  "Big same. Every single week.",
  "Now I want to try this too.",
  "Saving this for the weekend.",
  "You put into words what I couldn't.",
  "This deserves way more likes than it has.",
  "Genuinely curious how this turns out, keep us posted!",
  "Respect for sharing this openly.",
  "The last line got me.",
  "Feels very relatable on a spiritual level.",
  "Adding this to my list immediately.",
  "Well said. That's all, just well said.",
  "I was NOT emotionally prepared for this post.",
  "Great energy, keep them coming.",
  "This is the content I subscribed for.",
  "Counterpoint: also yes.",
  "Read this twice. Still good.",
  "You're so right and you should say it louder.",
  "Wholesome post alert.",
];

/** Reply templates for responding to another comment. */
export const TEMPLATE_REPLIES: string[] = [
  "Totally agree with you here.",
  "Ha, didn't think of it that way!",
  "This is the correct take.",
  "Fair point, honestly.",
  "Same experience on my end.",
  "You get it, thank you.",
  "100% this.",
  "Okay that's a good addition to the thread.",
  "Learning so much from this thread.",
  "Nailed it.",
];

/** Expands the persona list when BOT_COUNT exceeds its length. */
export function personasForCount(count: number): Persona[] {
  const base = PERSONAS.slice(0, count);
  if (count <= PERSONAS.length) {
    return base;
  }
  const extra: Persona[] = [];
  let i = 0;
  while (base.length + extra.length < count) {
    const proto = PERSONAS[i % PERSONAS.length];
    const suffix = Math.floor(i / PERSONAS.length) + 2;
    const username = `${proto.username.slice(0, 18 - String(suffix).length)}${suffix}`;
    extra.push({
      ...proto,
      username,
      displayName: `${proto.displayName} ${suffix}`,
    });
    i += 1;
  }
  return [...base, ...extra];
}

export function randomFrom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

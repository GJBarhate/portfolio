import LIVE_STATUS from './liveStatus.json'

export const SOCIALS = {
  github: 'https://github.com/GJBarhate',
  leetcode: 'https://leetcode.com/u/chgyCygKwQ/',
  codechef: 'https://www.codechef.com/users/gaurav_jb',
  linkedin: 'https://www.linkedin.com/in/gaurav-barhate-056175271/',
  email: 'gauravbarhate55@gmail.com',
  phone: '+91 93733 27427',
}

/*
 * W4 — the `now` line. Kept as data, not markup, because the whole point is
 * that it stays current: one edit here updates the status pill, and a stale
 * date is worse than no date at all.
 */
export const NOW = {
  availability: 'OPEN TO WORK',
  availableFrom: 'Immediately',
  focus: 'Real-time systems & AI pipelines',
  editor: 'VS Code · Vim keys · Vite',
}

export const STATS = [
  { label: 'LeetCode Max Rating', value: 1972, suffix: '', tag: 'Knight Rank', accent: 'plasma' },
  { label: 'Problems Solved', value: 800, suffix: '+', tag: 'LeetCode, CodeChef, GFG', accent: 'cyan' },
  { label: 'Projects Deployed', value: 5, suffix: '+', tag: 'Live in production', accent: 'plasma' },
  { label: 'Real-time Technologies Used', value: 5, suffix: '', tag: 'WebSockets, WebRTC, CRDT', accent: 'cyan' },
]

export const RATING_HISTORY = [
  1200, 1320, 1410, 1380, 1520, 1610, 1590, 1700, 1755, 1690,
  1800, 1860, 1820, 1909, 1875, 1930, 1902, 1972,
]

export const SKILLS = [
  {
    category: 'Frontend',
    color: 'plasma',
    items: ['React', 'Vite', 'Tailwind', 'Framer Motion', 'GSAP', 'R3F'],
  },
  {
    category: 'Backend',
    color: 'cyan',
    items: ['Node.js', 'Express', 'REST', 'JWT Auth', 'Razorpay', 'Cloudinary'],
  },
  {
    category: 'Realtime',
    color: 'plasma',
    items: ['Socket.IO', 'WebRTC', 'Yjs CRDT', 'Redis Pub/Sub'],
  },
  {
    category: 'AI',
    color: 'cyan',
    items: ['Gemini API', 'Prompt Pipelines', 'Multi-key Rotation', 'Judge0'],
  },
  {
    category: 'Data',
    color: 'plasma',
    items: ['MongoDB', 'Mongoose', 'Redis', 'Aggregation Pipelines'],
  },
  {
    category: 'Competitive Programming',
    color: 'cyan',
    items: ['DSA', 'Graphs', 'DP', 'LeetCode Knight', 'CodeChef'],
  },
]

const PROJECT_DEFS = [
  {
    id: 'peercode',
    title: 'PeerCode',
    tagline: 'Real-time coding interview platform',
    description:
      'A platform for practicing coding interviews with another person. It supports live video calls over WebRTC, a code editor that stays in sync between both users in real time using Yjs CRDT, code execution through Judge0, AI-driven mock interviews using the Gemini API with voice support, and a leaderboard that ranks users after each practice match.',
    tech: ['MERN', 'Socket.IO', 'WebRTC', 'Yjs CRDT', 'Monaco', 'Gemini AI', 'Judge0', 'Razorpay', 'Redis'],
    outcome:
      'Two people run a full mock interview — synced editor, live video and AI feedback — without leaving the tab.',
    accent: '#8b5cf6',
    architecture: ['React + Monaco', 'Socket.IO', 'Yjs CRDT', 'Judge0 / Gemini'],
    metrics: [
      { value: '<80ms', label: 'EDITOR SYNC' },
      { value: '2-peer', label: 'WEBRTC ROOMS' },
      { value: '9', label: 'SERVICES WIRED' },
    ],
    imageAlts: {
      'peercode-landing.webp': 'PeerCode landing page introducing peer-to-peer mock coding interviews',
      'peercode-dashboard.webp': 'PeerCode dashboard listing past practice sessions and match history',
      'peercode-editor.webp': 'PeerCode interview room: Monaco editor synced between two users beside a live WebRTC video call',
      'peercode-leaderboard.webp': 'PeerCode leaderboard ranking users by rating after practice matches',
    },
    images: [
      'peercode-landing.webp',
      'peercode-dashboard.webp',
      'peercode-editor.webp',
      'peercode-leaderboard.webp',
    ],
    live: 'https://peercode-iota.vercel.app/',
    repo: 'https://github.com/GJBarhate/peercode',
  },
  {
    id: 'flowshield',
    title: 'FlowShield',
    tagline: 'Webhook monitoring and reliability tool',
    description:
      'A tool for monitoring and securing incoming webhooks. It provides per-project API keys, tracks event delivery with automatic retries on failure, shows success and failure analytics, and includes a real-time console for debugging webhook issues before they affect production.',
    tech: ['MERN', 'Webhooks', 'Real-time Events', 'API Key Auth', 'Redis'],
    outcome:
      'Failed webhook deliveries retry automatically and surface in a live console before they reach production.',
    accent: '#22d3ee',
    architecture: ['Webhook in', 'API-key gate', 'Retry queue', 'Live console'],
    metrics: [
      { value: '5×', label: 'RETRY BACKOFF' },
      { value: 'per-project', label: 'API KEYS' },
      { value: 'realtime', label: 'EVENT CONSOLE' },
    ],
    imageAlts: {
      'flowshield-dashboard.webp': 'FlowShield dashboard showing webhook delivery success and failure analytics',
      'flowshield-projects.webp': 'FlowShield project list, each with its own API key and event volume',
      'flowshield-detail.webp': 'FlowShield event detail view with the request payload and its retry attempts',
    },
    images: ['flowshield-dashboard.webp', 'flowshield-projects.webp', 'flowshield-detail.webp'],
    live: 'https://flowshield-delta.vercel.app/login',
    repo: 'https://github.com/GJBarhate/flowshield',
  },
  {
    id: 'voiceans',
    title: 'VoiceAns',
    tagline: 'AI voice interview coach',
    description:
      'A real-time interview coach powered by Google Gemini. Tap the mic and ask a question out loud — speech is transcribed in the browser, shown for review and editing, then answered by Gemini as structured, interview-ready bullet points. Includes typed input, chat history, user profiles, and light/dark themes.',
    tech: ['React', 'Node.js', 'Express', 'Gemini AI', 'Web Speech API', 'MongoDB', 'JWT', 'Tailwind CSS'],
    outcome:
      'Turns a spoken answer into scored, written feedback in one pass, so practice does not need a second person.',
    accent: '#34d399',
    architecture: ['Web Speech API', 'Transcript review', 'Gemini prompt', 'Scored answer'],
    metrics: [
      { value: '1 pass', label: 'SPEECH → FEEDBACK' },
      { value: 'in-browser', label: 'TRANSCRIPTION' },
      { value: 'JWT', label: 'AUTH + HISTORY' },
    ],
    imageAlts: {
      'voiceans-landing.webp': 'VoiceAns landing page with the microphone prompt for asking a question aloud',
      'voiceans-question.webp': 'VoiceAns showing a transcribed question above Gemini’s structured bullet-point answer',
      'voiceans-history.webp': 'VoiceAns chat history listing previously asked interview questions',
    },
    images: ['voiceans-landing.webp', 'voiceans-question.webp', 'voiceans-history.webp'],
    live: 'https://voice-ans-frontend.vercel.app/',
    repo: 'https://github.com/GJBarhate/voice-ans',
  },
  {
    id: 'onecart',
    title: 'OneCart',
    tagline: 'AI-powered e-commerce platform',
    description:
      'A full-stack e-commerce store with product collections, category and sub-category filters, search, and sorting. Shoppers manage a cart with size selection, check out, and track orders through a dedicated orders page. Includes JWT authentication, an admin panel for product management, and an integrated AI shopping assistant.',
    tech: ['React', 'Node.js', 'Express', 'MongoDB', 'JWT Auth', 'AI Assistant', 'REST API', 'Tailwind CSS'],
    outcome:
      'Search, cart and checkout run end to end on live payments, not a demo stub.',
    accent: '#f59e0b',
    architecture: ['Catalog + search', 'Cart / sizes', 'Checkout', 'Orders + admin'],
    metrics: [
      { value: 'end-to-end', label: 'CHECKOUT FLOW' },
      { value: 'role-based', label: 'ADMIN PANEL' },
      { value: 'AI', label: 'SHOPPING ASSISTANT' },
    ],
    imageAlts: {
      'onecart-home.webp': 'OneCart storefront home page with featured product collections',
      'onecart-collections.webp': 'OneCart collections page with category filters, search and sorting',
      'onecart-cart.webp': 'OneCart shopping cart with size selection and order total',
      'onecart-orders.webp': 'OneCart orders page tracking the status of past purchases',
    },
    images: ['onecart-home.webp', 'onecart-collections.webp', 'onecart-cart.webp', 'onecart-orders.webp'],
    live: 'https://ai-powered-ecommerce-platform-frontendone.onrender.com/',
    repo: 'https://github.com/GJBarhate/ai-powered-ecommerce-platform',
  },
  {
    id: 'lms',
    title: 'Virtual Courses',
    tagline: 'Learning management system',
    description:
      'A learning management system with separate student and educator roles. Educators publish and manage courses; students browse a catalog spanning web development, AI/ML, data science and more, search courses with AI, enroll, and learn through structured lectures. Supports email and Google sign-in with role-based access.',
    tech: ['React', 'Node.js', 'Express', 'MongoDB', 'Google OAuth', 'JWT', 'AI Search', 'REST API'],
    outcome:
      'Instructors publish a course and enrol paying students without touching the database.',
    accent: '#f472b6',
    architecture: ['Google OAuth', 'Role router', 'Course catalog', 'Lecture player'],
    metrics: [
      { value: '2 roles', label: 'STUDENT / EDUCATOR' },
      { value: 'AI', label: 'COURSE SEARCH' },
      { value: 'OAuth + JWT', label: 'SIGN-IN' },
    ],
    imageAlts: {
      'lms-landing.webp': 'Virtual Courses landing page introducing the learning management system',
      'lms-courses.webp': 'Virtual Courses catalog spanning web development, AI/ML and data science tracks',
      'lms-signup.webp': 'Virtual Courses sign-up screen offering email and Google sign-in with a role choice',
    },
    images: ['lms-landing.webp', 'lms-courses.webp', 'lms-signup.webp'],
    live: 'https://learning-management-system-frontend-tx7b.onrender.com/signup',
    repo: 'https://github.com/GJBarhate/learning-management-system',
  },
]

/*
 * W2 — live status pings. `npm run check:live` pings every deployed app and
 * writes liveStatus.json; the badge on each card is therefore a build-time
 * fact, not a runtime fetch. Zero requests on the visitor's machine.
 */
export const PROJECTS = PROJECT_DEFS.map((p) => ({
  ...p,
  status: LIVE_STATUS[p.id] || 'unknown',
}))

export const TIMELINE = [
  {
    year: '2022',
    title: 'Started B.Tech in Computer Science',
    desc: 'Began my degree and started learning data structures and algorithms on my own, alongside coursework.',
  },
  {
    year: '2023',
    title: 'Started competitive programming',
    desc: 'Crossed 200 problems solved and began competing in rated LeetCode contests.',
  },
  {
    year: '2024',
    title: 'Kept building DSA fundamentals',
    desc: 'Continued solving problems regularly and steadily climbed LeetCode contest rating.',
  },
  {
    year: '2025',
    title: 'Built full-stack projects with the MERN stack',
    desc: 'Built and deployed full-stack applications with payment integration, media handling, and AI features using the Gemini API.',
  },
  {
    year: '2026',
    title: 'Reached LeetCode Knight, graduated, shipped 5+ production apps',
    desc: 'Reached a peak rating of 1972 on LeetCode, placing in the Knight tier with 800+ problems solved. Completed my B.Tech in Computer Science, and built and deployed PeerCode, FlowShield, VoiceAns, OneCart, and a full LMS to production.',
  },
]

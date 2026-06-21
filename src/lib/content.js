export const SOCIALS = {
  github: 'https://github.com/GJBarhate',
  leetcode: 'https://leetcode.com/u/chgyCygKwQ/',
  codechef: 'https://www.codechef.com/users/gaurav_jb',
  linkedin: 'https://www.linkedin.com/in/gaurav-barhate-056175271/',
  email: 'gauravjbarhate554@gmail.com',
  phone: '+91 93733 27427',
}

export const STATS = [
  { label: 'LeetCode Rating', value: 1909, suffix: '', tag: 'Knight Rank', accent: 'plasma' },
  { label: 'Problems Solved', value: 600, suffix: '+', tag: 'LeetCode, CodeChef, GFG', accent: 'cyan' },
  { label: 'Projects Deployed', value: 2, suffix: '', tag: 'Live in production', accent: 'plasma' },
  { label: 'Real-time Technologies Used', value: 5, suffix: '', tag: 'WebSockets, WebRTC, CRDT', accent: 'cyan' },
]

export const RATING_HISTORY = [
  1200, 1320, 1410, 1380, 1520, 1610, 1590, 1700, 1755, 1690,
  1800, 1860, 1820, 1900, 1875, 1909,
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

export const PROJECTS = [
  {
    id: 'peercode',
    title: 'PeerCode',
    tagline: 'Real-time coding interview platform',
    description:
      'A platform for practicing coding interviews with another person. It supports live video calls over WebRTC, a code editor that stays in sync between both users in real time using Yjs CRDT, code execution through Judge0, AI-driven mock interviews using the Gemini API with voice support, and a leaderboard that ranks users after each practice match.',
    tech: ['MERN', 'Socket.IO', 'WebRTC', 'Yjs CRDT', 'Monaco', 'Gemini AI', 'Judge0', 'Razorpay', 'Redis'],
    accent: '#8b5cf6',
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
    accent: '#22d3ee',
    images: ['flowshield-dashboard.webp', 'flowshield-projects.webp', 'flowshield-detail.webp'],
    live: 'https://flowshield-delta.vercel.app/login',
    repo: 'https://github.com/GJBarhate/flowshield',
  },
]

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
    title: 'Reached LeetCode Knight, graduated, shipped PeerCode & FlowShield',
    desc: 'Reached a peak rating of 1909 on LeetCode, placing in the Knight tier. Completed my B.Tech in Computer Science, and built and deployed PeerCode and FlowShield to production.',
  },
]

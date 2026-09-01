// Seed/demo content matching design/MUT Tech Community.dc.html.
// Public pages read from here until Phase 5-7 back projects/events/challenges
// with real DB-backed models.

export const interestOptions = [
  "Backend",
  "Frontend",
  "Mobile",
  "AI / ML",
  "Cybersecurity",
  "Cloud",
  "Systems",
  "Embedded",
  "Data",
  "DevOps",
  "Open Source",
  "Robotics",
];

export const goalOptions = [
  "Build projects",
  "Meet other developers",
  "Learn new technologies",
  "Participate in hackathons",
  "Improve my portfolio",
  "Contribute to open source",
];

export const experienceLevels = [
  { value: "starting", label: "Just getting started", tag: "level 01" },
  { value: "some_projects", label: "I've built a few projects", tag: "level 02" },
  { value: "independent", label: "Comfortable building independently", tag: "level 03" },
  { value: "advanced", label: "Advanced / experienced", tag: "level 04" },
] as const;

export const yearsOfStudy = ["1st", "2nd", "3rd", "4th"];

export const mutCourses = [
  "BSc Software Engineering",
  "BSc Computer Science",
  "BSc Information Technology",
  "BSc Computer Technology",
  "BSc Electrical & Electronic Engineering",
  "BSc Mechatronic Engineering",
  "Diploma in ICT",
];

// Sourced from the club's official Semester 2 2026 activity report
// (submitted to the Dean of Students, ref. MTC/2026/7406). Real numbers —
// update this alongside each semester's report rather than inventing figures.
export type PastEvent = {
  title: string;
  meta: string;
  date: string;
  venue: string;
  category: string;
  attendees: number;
  studentAttendees: number;
  sponsor: string;
  speakers: { name: string; role: string; org: string }[];
  outcome: string;
  image?: string;
};

export const pastEvents: PastEvent[] = [
  {
    title: "OKX Blockchain Talk",
    meta: "07 feb · 137 attended",
    date: "February 7",
    venue: "Assembly Hall",
    category: "Tech Talk / Guest Lecture",
    attendees: 137,
    studentAttendees: 134,
    sponsor: "OKX",
    speakers: [
      { name: "Ian Maguithi", role: "Speaker", org: "OKX" },
      { name: "Cynthia Wanjiku", role: "Speaker", org: "OKX" },
      { name: "Carol Hiri", role: "Speaker", org: "OKX" },
    ],
    outcome: "Over 100 students got acquainted with blockchain using OKX technologies.",
    image: "/images/okx_event.png",
  },
  {
    title: "MUT Tech Day",
    meta: "21 feb · 75 attended",
    date: "February 21",
    venue: "Assembly Hall",
    category: "Workshop",
    attendees: 75,
    studentAttendees: 70,
    sponsor: "Microsoft",
    speakers: [
      { name: "Julia Muiruri", role: "Cloud Advocate", org: "Microsoft" },
      { name: "Bethany Jepchumba", role: "AI Cloud Advocate", org: "Microsoft" },
      { name: "Mark Gatere", role: "Software Engineer", org: "Microsoft" },
      { name: "Stephen Karanja", role: "Software Engineer", org: "Microsoft" },
      { name: "Joylynn Kirui", role: "Cybersecurity Expert", org: "Prime Bank" },
    ],
    outcome: "Over 70 students were equipped with on-demand skills to navigate the current industry.",
    image: "/images/MUT_Tech_day.png",
  },
];

// eventsHeld/guestSpeakers/partnerOrgCount run higher than the two events
// detailed in pastEvents above and the 2 named orgs in partnerOrgs below —
// per the Chairperson, the official Dean-of-Students report (ref.
// MTC/2026/7406) only covers formally submitted events, not board-level
// ones run alongside it. totalAttendance stays scoped to the two events we
// have real per-event numbers for, not the wider board-level total.
export const semesterSummary = {
  period: "Semester 2 2026",
  eventsHeld: "10+",
  totalAttendance: 212,
  guestSpeakers: "15+",
  partnerOrgCount: "5+",
  // Named partners we have confirmed — the real count above (partnerOrgCount)
  // includes board-level partnerships not yet individually listed here.
  partnerOrgs: ["OKX", "Microsoft"],
  // Broader than partnerOrgs: every org a speaker came from, for the "trusted by" strip.
  speakerOrgs: ["OKX", "Microsoft", "Prime Bank"],
};

export const whyMutTech = [
  {
    title: "Real industry access",
    detail: "Engineers and advocates from OKX and Microsoft spoke to students last semester alone.",
  },
  {
    title: "You ship, not just attend",
    detail: "Weekly build challenges and real repos — not another WhatsApp group that goes quiet.",
  },
  {
    title: "Built by students, for students",
    detail: "Run by your peers on a build-in-public rhythm, not a once-a-semester assembly.",
  },
  {
    title: "Backed by the university",
    detail: "An official School of Computing & IT community, patroned by the Dean of SCIT.",
  },
];

export type Challenge = {
  slug: string;
  num: string;
  title: string;
  meta: string;
  state: string;
  subs: string;
  detail?: {
    difficulty: string;
    estTime: string;
    building: string;
    deadline: string;
    description: string;
    requirements: string[];
    submissions: { name: string; stack: string; when: string }[];
  };
};

export const challenges: Challenge[] = [
  {
    slug: "build-a-url-shortener",
    num: "15",
    title: "Build a URL Shortener",
    meta: "this week · closes sunday 11:59 pm",
    state: "open",
    subs: "126 building",
    detail: {
      difficulty: "intermediate",
      estTime: "~4 hours",
      building: "126",
      deadline: "2d 04h left",
      description: "Short links, redirects, a hit counter. Small enough for a weekend, deep enough to argue about.",
      requirements: [
        "POST a long URL, get a short code back",
        "GET the short code, redirect with 301",
        "Count hits per link",
        "Deploy it somewhere public",
        "Bonus: custom aliases, expiry, rate limiting",
      ],
      submissions: [
        { name: "Brian Otieno", stack: "go · sqlite · fly.io", when: "2h ago" },
        { name: "Njeri Kamau", stack: "python · fastapi · redis", when: "5h ago" },
        { name: "Ali Hassan", stack: "rust · axum", when: "yesterday" },
        { name: "Amina Wanjiku", stack: "node · postgres", when: "2d ago" },
      ],
    },
  },
  {
    slug: "rate-limiter-from-scratch",
    num: "14",
    title: "Rate limiter from scratch",
    meta: "closed 17 aug · won by Kevin Mwangi",
    state: "judged",
    subs: "31 submissions",
  },
  {
    slug: "parse-a-csv-without-a-library",
    num: "13",
    title: "Parse a CSV without a library",
    meta: "closed 10 aug",
    state: "judged",
    subs: "44 submissions",
  },
  {
    slug: "tiny-key-value-store",
    num: "12",
    title: "Tiny key-value store",
    meta: "closed 3 aug",
    state: "judged",
    subs: "22 submissions",
  },
  {
    slug: "mpesa-callback-simulator",
    num: "11",
    title: "M-Pesa callback simulator",
    meta: "closed 27 jul · used in production since",
    state: "judged",
    subs: "18 submissions",
  },
  {
    slug: "markdown-to-html",
    num: "10",
    title: "Markdown to HTML",
    meta: "closed 20 jul",
    state: "judged",
    subs: "52 submissions",
  },
];

export const communityFeed = [
  {
    initials: "AW",
    text: "Amina shipped an update to Community Management Tools.",
    kind: "shipped",
    when: "1h ago",
    color: "green",
  },
  {
    initials: "BO",
    text: "Brian opened a new project: Past Lens, a digital museum.",
    kind: "new project",
    when: "4h ago",
    color: "green",
  },
  {
    initials: "KM",
    text: "Kevin won Challenge #14 with a 40-line rate limiter.",
    kind: "challenge",
    when: "yesterday",
    color: "amber",
  },
  {
    initials: "JK",
    text: "Joy joined Origin Fest 2025 as a backend contributor.",
    kind: "joined project",
    when: "yesterday",
    color: "green",
  },
  {
    initials: "NK",
    text: "Njeri published “Understanding Rust ownership without the fear”.",
    kind: "article",
    when: "2d ago",
    color: "muted",
  },
  {
    initials: "FC",
    text: "Faith is looking for one Python person for AI and Robotics Sessions.",
    kind: "looking",
    when: "3d ago",
    color: "green",
  },
] as const;

export const lookingForContributors = [
  { name: "Community Management Tools", note: "3 spots · frontend, docs" },
  { name: "Origin Fest 2025", note: "2 spots · design, content" },
  { name: "AI and Robotics Sessions", note: "1 spot · python" },
];

export const learningPath = {
  title: "Backend Engineering",
  description:
    "Seven steps from “what is HTTP” to an API other people depend on. Every step ends in something you can run.",
  steps: [
    {
      title: "HTTP fundamentals",
      tag: "done",
      detail: "Requests, status codes, why 301 is not 302.",
      state: "done" as const,
    },
    { title: "Python", tag: "done", detail: "Enough to be dangerous: types, modules, virtualenvs.", state: "done" as const },
    { title: "FastAPI", tag: "done", detail: "Routing, validation, dependency injection.", state: "done" as const },
    {
      title: "Databases",
      tag: "in progress",
      detail: "Schema design, indexes, the N+1 problem.",
      state: "active" as const,
    },
    {
      title: "Authentication",
      tag: "next",
      detail: "Sessions vs tokens, hashing, what not to roll yourself.",
      state: "locked" as const,
    },
    {
      title: "Deployment",
      tag: "locked",
      detail: "One VPS, a reverse proxy, and logs you can read.",
      state: "locked" as const,
    },
    {
      title: "Observability",
      tag: "locked",
      detail: "Knowing it broke before a member tells you.",
      state: "locked" as const,
    },
  ],
  otherPaths: ["Systems Programming", "AI / ML", "Cybersecurity", "Frontend", "Cloud & DevOps"],
};

export const membershipFeeKes = 200;

export const membershipPerks = [
  "Member events & workshops",
  "Join club projects",
  "Weekly build challenges",
  "Member resources",
  "Community participation",
  "Public builder profile",
];

export const stats = [
  { value: "200+", label: "builders" },
  { value: "6", label: "active projects" },
  { value: "8", label: "upcoming events" },
  { value: "24", label: "challenges done" },
];

// Cumulative totals across the club's history, not just the semester covered
// by communityMilestones. Keep in sync with the Chairperson's own count —
// update the figures here, not the semesterSummary block below, which stays
// scoped to the official per-semester report it's sourced from.
export const communityMilestones = [
  { value: "200+", label: "builders" },
  { value: "20+", label: "events held" },
  { value: "10+", label: "guest speakers" },
  { value: "10+", label: "partner organizations" },
];

export const liveTicker = [
  { text: "Amina started Community Management Tools", color: "green" },
  { text: "Brian completed Challenge #14", color: "green" },
  { text: "Rust Workshop opens tomorrow", color: "amber" },
  { text: "3 new members joined", color: "green" },
  { text: "Njeri shipped Past Lens v2", color: "green" },
] as const;

// Leadership named in the club's official Semester 2 2026 activity report —
// only list people we have a real, sourced name and role for.
export type TeamMember = { name: string; role: string; meta: string; image?: string };

export const leadership: TeamMember[] = [
  { name: "Dr. John Ndia", role: "Club Patron", meta: "Dean, School of Computing & IT", image: "/images/J.Ndia.webp" },
  { name: "Dr. Jane Njuki", role: "Head of Innovations", meta: "SCIT", image: "/images/JNjuki.webp" },
  { name: "John Kagunda", role: "Chairperson", meta: "Reg. No. SC212/3223/2023", image: "/images/JKagunda.png" },
];

export const joinSteps = [
  {
    step: "01",
    title: "Create your account",
    detail: "Sign up with your email or Google — takes under a minute.",
  },
  {
    step: "02",
    title: "Tell us about you",
    detail: "Course, year, and what you want to build. Helps us point you at the right events and projects.",
  },
  {
    step: "03",
    title: "Start building",
    detail: "Join a weekly challenge, register for the next event, or pick up a project that's looking for hands.",
  },
];

export type GalleryPhoto = {
  caption: string;
  image: string;
};

export const galleryPhotos: GalleryPhoto[] = [
  { caption: "Fireside chat", image: "/images/fireside-chat.jpeg" },
  { caption: "Workshop in progress", image: "/images/workshop-in-progress.png" },
  { caption: "Guest speaker Q&A", image: "/images/guest_speaker_q_a.jpeg" },
  { caption: "TEDx Riara University", image: "/images/Tedx-Riara-University.jpeg" },
  { caption: "Community hangout", image: "/images/community-hangout.jpeg" },
  { caption: "Demo day", image: "/images/demo-day.jpeg" },
];

export const faqs = [
  {
    q: "Do I need coding experience to join?",
    a: "No. We have members ranging from just getting started to advanced — the weekly challenges and learning paths are built to meet you where you are.",
  },
  {
    q: "How much does membership cost?",
    a: `KSh ${membershipFeeKes} per semester. It covers member events, project access, weekly challenges, and a public builder profile.`,
  },
  {
    q: "Is this only for Computer Science students?",
    a: "No — we're open to students across Software Engineering, CS, IT, Computer Technology, Electrical & Electronic Engineering, Mechatronic Engineering, and the Diploma in ICT.",
  },
  {
    q: "What do I actually get as a member?",
    a: "Access to member-only events and workshops, the ability to join club projects, weekly build challenges, community resources, and a public profile showing what you've shipped.",
  },
  {
    q: "How often does the club actually meet?",
    a: "Weekly, not once a semester — build nights, study groups, and challenges run continuously alongside the bigger flagship events.",
  },
];

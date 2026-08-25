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

export type Project = {
  slug: string;
  name: string;
  blurb: string;
  stack: string[];
  state: string;
  stateColor: "green" | "amber" | "muted";
  people: string;
  activity: string;
  detail?: {
    contributors: number;
    openIssues: number;
    commitsThisMonth: number;
    about: string[];
    roadmap: { title: string; state: string; color: "green" | "amber" | "muted" }[];
    openRoles: string;
    repo: string;
    ghActivity: { text: string; color: "green" | "amber" | "muted" }[];
  };
};

export const projects: Project[] = [
  {
    slug: "campusconnect",
    name: "CampusConnect",
    blurb: "Everything happening on campus in one searchable feed. 900 weekly users.",
    stack: ["Python", "FastAPI", "Postgres"],
    state: "looking for contributors",
    stateColor: "green",
    people: "12 contributors",
    activity: "active today",
    detail: {
      contributors: 12,
      openIssues: 14,
      commitsThisMonth: 72,
      about: [
        "Students miss most of what happens on campus because information lives in WhatsApp groups and notice boards. CampusConnect pulls every club, lab session and lecture change into one feed you can actually search.",
        "Built and maintained entirely by club members. Deployed on a single VPS, no funding, 900 weekly users.",
      ],
      roadmap: [
        { title: "Event feed + search", state: "shipped · v1.0", color: "green" },
        { title: "Club calendar sync", state: "shipped · v1.4", color: "green" },
        { title: "Push notifications", state: "in progress · 2 contributors", color: "amber" },
        { title: "Android client", state: "looking for contributors", color: "muted" },
      ],
      openRoles: "Frontend · Mobile · Documentation",
      repo: "MurangaUniversityOfTechnology/campusconnect",
      ghActivity: [
        { text: "Amina merged #88 rate limiting", color: "green" },
        { text: "Brian opened #91 dark mode", color: "green" },
        { text: "Njeri requested review on #90", color: "amber" },
        { text: "milestone v1.5 · 6 of 9 issues closed", color: "muted" },
      ],
    },
  },
  {
    slug: "matboard",
    name: "MatBoard",
    blurb: "Matatu routes and fares for the Murang'a stage, built from paper timetables.",
    stack: ["Go", "Android"],
    state: "2 spots open",
    stateColor: "green",
    people: "5 contributors",
    activity: "4 hours ago",
  },
  {
    slug: "shamba-sense",
    name: "Shamba Sense",
    blurb: "Soil moisture sensors that text a farmer when the beans need water.",
    stack: ["C", "ESP32", "MQTT"],
    state: "1 spot · embedded",
    stateColor: "green",
    people: "3 contributors",
    activity: "yesterday",
  },
  {
    slug: "club-website",
    name: "Club Website",
    blurb: "This platform. Yes, you can contribute to the thing you are reading.",
    stack: ["React", "Vite"],
    state: "building",
    stateColor: "amber",
    people: "2 contributors",
    activity: "6 days ago",
  },
  {
    slug: "exam-scraper",
    name: "Exam Scraper",
    blurb: "Watched the portal for timetable changes. Retired when the portal got an API.",
    stack: ["Python"],
    state: "shipped · archived",
    stateColor: "muted",
    people: "4 contributors",
    activity: "archived may 2026",
  },
  {
    slug: "fee-splitter",
    name: "Fee Splitter",
    blurb: "Splits hostel bills between roommates over M-Pesa. Ten users, all of them roommates.",
    stack: ["Node", "Daraja"],
    state: "shipped",
    stateColor: "green",
    people: "2 contributors",
    activity: "shipped 2 weeks ago",
  },
];

export type EventItem = {
  slug: string;
  dow: string;
  day: string;
  mon: string;
  title: string;
  meta: string;
  audience: "open to all" | "members only";
  fee: string;
  capacity: string;
  cta: string;
  detail?: {
    date: string;
    time: string;
    venue: string;
    description: string;
    whatYoullBuild: string;
    schedule: { time: string; what: string }[];
    speaker: { name: string; meta: string };
    requirements: string[];
    whoShouldAttend: string;
  };
};

export const events: EventItem[] = [
  {
    slug: "rust-systems-workshop",
    dow: "FRI",
    day: "29",
    mon: "AUG",
    title: "Rust Systems Workshop",
    meta: "5:00 PM · Engineering Lab 2 · Kevin Mwangi",
    audience: "open to all",
    fee: "free",
    capacity: "8 of 30 seats left",
    cta: "Register",
    detail: {
      date: "29 August",
      time: "5:00 PM",
      venue: "Engineering Lab 2",
      description:
        "Build systems that actually understand memory. Three hours, one compiler, zero garbage collection.",
      whatYoullBuild:
        "A working key-value store with a write-ahead log — the same shape as the storage engine underneath Redis, but small enough to finish in one sitting. You leave with code on your GitHub.",
      schedule: [
        { time: "17:00", what: "Setup & why Rust exists" },
        { time: "17:30", what: "Ownership, borrowing, lifetimes" },
        { time: "18:15", what: "Build: append-only log" },
        { time: "19:15", what: "Build: index & recovery" },
        { time: "20:00", what: "Demos + pizza" },
      ],
      speaker: { name: "Kevin Mwangi", meta: "4th year · systems · club lead" },
      requirements: ["A laptop with Rust installed", "Comfort with any one language", "Active club membership"],
      whoShouldAttend:
        "Anyone who has written a program and wondered where the memory went. Intermediate — you don't need Rust experience.",
    },
  },
  {
    slug: "deploy-night",
    dow: "TUE",
    day: "02",
    mon: "SEP",
    title: "Deploy Night: ship your side project",
    meta: "6:30 PM · Innovation Hub",
    audience: "members only",
    fee: "free",
    capacity: "19 of 40 seats left",
    cta: "Register",
  },
  {
    slug: "mut-mini-hackathon",
    dow: "SAT",
    day: "06",
    mon: "SEP",
    title: "MUT Mini-Hackathon",
    meta: "9:00 AM · Main Lab · lunch provided",
    audience: "open to all",
    fee: "KSh 100",
    capacity: "full · 7 waiting",
    cta: "Join waitlist",
  },
  {
    slug: "cloud-study-group",
    dow: "WED",
    day: "10",
    mon: "SEP",
    title: "Cloud Study Group: week 1",
    meta: "5:30 PM · Lab 4 · recurring",
    audience: "members only",
    fee: "free",
    capacity: "no cap",
    cta: "Register",
  },
  {
    slug: "alumni-panel",
    dow: "FRI",
    day: "19",
    mon: "SEP",
    title: "Alumni Panel: first job in tech",
    meta: "4:00 PM · Main Hall · 4 alumni",
    audience: "open to all",
    fee: "free",
    capacity: "registration opens 1 sep",
    cta: "Remind me",
  },
];

export const pastEvents = [
  { title: "Intro to Git & GitHub", meta: "14 aug · 41 attended" },
  { title: "Build Night: FastAPI", meta: "07 aug · 28 attended" },
  { title: "Cyber Awareness Clinic", meta: "31 jul · 63 attended" },
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
    text: "Amina shipped CampusConnect v2 — notifications are live for 900 users.",
    kind: "shipped",
    when: "1h ago",
    color: "green",
  },
  {
    initials: "BO",
    text: "Brian opened a new project: MatBoard, a matatu route board for the Murang'a stage.",
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
    text: "Joy joined CampusConnect as a backend contributor.",
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
    text: "Faith is looking for one embedded person for Shamba Sense.",
    kind: "looking",
    when: "3d ago",
    color: "green",
  },
] as const;

export const lookingForContributors = [
  { name: "CampusConnect", note: "3 spots · frontend, mobile, docs" },
  { name: "MatBoard", note: "2 spots · android, design" },
  { name: "Shamba Sense", note: "1 spot · embedded" },
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

export const stats = [
  { value: "37", label: "builders" },
  { value: "12", label: "active projects" },
  { value: "8", label: "upcoming events" },
  { value: "24", label: "challenges done" },
];

export const liveTicker = [
  { text: "Amina started CampusConnect", color: "green" },
  { text: "Brian completed Challenge #14", color: "green" },
  { text: "Rust Workshop opens tomorrow", color: "amber" },
  { text: "3 new members joined", color: "green" },
  { text: "Njeri shipped MatBoard v2", color: "green" },
] as const;

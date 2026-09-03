// The JSON shape this prompt asks for maps 1:1 onto the admin course-authoring
// API (createModule/createLesson/createModuleQuiz/createQuestion/createFinalExam
// in lib/api.ts) — see CourseAiImportPanel.tsx, which walks this structure and
// fires those calls in sequence. Keep the two in sync if either changes.
export function buildCourseAiPrompt(title: string, description: string): string {
  return `You are designing a self-paced online course for a university tech club. Produce the FULL course structure as a single JSON object — no other output.

COURSE
Title: ${title || "(fill in a title)"}
Description: ${description || "(fill in what this course should teach and who it's for)"}

Do this in three phases, in your own thinking, before producing the final JSON:

PHASE 1 — ROADMAP
Draft a complete learning roadmap for this course: the ordered list of topics a learner needs, from prerequisites through to the capstone-level skill. For each topic, note why it matters and what it unlocks next. This roadmap is not part of the output — it's how you decide the module breakdown below.

PHASE 2 — MODULES
Convert the roadmap into 4-8 modules. Each module must be a genuinely self-contained, learnable unit:
- A clear before/after: "after this module, the learner can do X."
- 2-5 short lessons (each roughly 10-15 minutes of reading), building on each other WITHIN the module — but the module as a whole must not depend on a LATER module's content.
- Each lesson has a title and a body written as real teaching content in plain text / light markdown (no HTML) — actually explain the concept with examples, not just a bullet-point summary or a list of links.
- video_url is optional per lesson. Only include one if you are highly confident it points to a real, stable, well-known resource (e.g. the technology's own official channel, freeCodeCamp, a well-known conference talk). If you are not certain a specific video exists at that exact URL, leave video_url as null — a broken link is worse than no link.
- Each module ends with a short quiz: 3-5 multiple-choice questions covering ONLY that module's material.

PHASE 3 — FINAL EXAM
One final exam covering the whole course: 30-50 multiple-choice questions drawn across ALL modules, weighted toward the material that matters most. Each question must stand alone — never write "as discussed in module 3", since a learner may see questions in any order.

QUIZ QUESTION RULES (every question, module quiz or final exam):
- 2-5 choices, exactly one correct — give each choice a short id ("a", "b", "c"...).
- Wrong choices should be genuinely plausible mistakes, not throwaway jokes — this is meant to actually test understanding.
- Write a real explanation for the correct answer (1-3 sentences) — the reasoning, not just "because it's correct."
- If (and only if) you're confident of a real, canonical reference that supports the answer — official docs, MDN, an RFC, a language spec — add it as a plain URL at the end of the explanation text (e.g. "Source: https://developer.mozilla.org/..."). Prefer a stable root-level docs page over guessing a deep link. You cannot browse the internet, so you cannot truly verify a URL is live — compensate by only ever citing well-known, unlikely-to-change resources, and omit the link entirely rather than invent one you're not sure of. A human will spot-check every link before this goes live.

OUTPUT
Return ONLY a single JSON object, no markdown code fence, no commentary before or after, in exactly this shape:

{
  "modules": [
    {
      "title": "string",
      "summary": "string, one sentence",
      "lessons": [
        { "title": "string", "body": "string, the actual lesson content", "video_url": "string or null" }
      ],
      "quiz": {
        "title": "string, e.g. 'Module 1 Quiz'",
        "pass_threshold_pct": 80,
        "questions": [
          {
            "prompt": "string",
            "choices": [ { "id": "a", "text": "string" }, { "id": "b", "text": "string" } ],
            "correct_choice_ids": ["a"],
            "explanation": "string"
          }
        ]
      }
    }
  ],
  "final_exam": {
    "title": "Final Exam",
    "intro_text": "string — a short heads-up that this is long (state the question count) and there's no going back once started",
    "pass_threshold_pct": 70,
    "questions": [ /* same question shape as above — 30 to 50 of them, spanning every module */ ]
  }
}`;
}

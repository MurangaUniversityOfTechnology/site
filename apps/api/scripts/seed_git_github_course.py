"""
Seeds "Git & GitHub for Beginners" — a free, Grokking-style intro course:
every concept ships with a small hands-on exercise before the explanation
lands, mermaid diagrams instead of a wall of theory, and a capstone that's
just "make a real GitHub account, push a real repo, paste the link."

One-shot: unlike seed_roadmaps.py this does NOT upsert — if a course with
this slug already exists, it exits without touching it (editing course
content after the fact is what the admin course editor is for). Leaves the
course unpublished — review it, then publish from /admin/courses.

Run with: .venv/bin/python scripts/seed_git_github_course.py
"""

from app.core.db import SessionLocal
from app.models.course import Course
from app.models.user import User
from app.services import course as course_service

SEED_ADMIN_EMAIL = "dev-admin@mut-tech.local"

COURSE_SLUG = "git-github-for-beginners"
COURSE_TITLE = "Git & GitHub for Beginners"
COURSE_SHORT_DESCRIPTION = (
    "Version control from absolute zero. No prior coding experience needed — by the end you'll have a real "
    "GitHub account and a repo you built and pushed yourself."
)
COURSE_DESCRIPTION = """Every developer's first real "oh, that's what that's for" moment is usually Git. Before that,
saving work means files named `project_final_v2_ACTUALLY_FINAL.docx`, or a folder called `backup (3)`. This course
fixes that, permanently.

You don't need to know how to code. You don't need a computer science background. You need a computer, about
three hours spread across a few sittings, and a willingness to type commands into a terminal and see what happens.

Every module ships a small hands-on exercise before the explanation — you'll feel *why* a feature exists before
you're told the theory. By the end, you'll have Git installed, a real GitHub account, and a real repository you
created, committed to, and pushed yourself — which is also the capstone project.
"""

MODULES = [
    {
        "title": "Why Bother? (Your First Commit)",
        "summary": "The pain Git solves, getting it installed, and your very first commit.",
        "lessons": [
            {
                "title": 'The "final_v2_ACTUALLY_FINAL.docx" Problem',
                "body": """Before we touch a single command, let's talk about the problem Git exists to solve — because
if you don't feel the problem, the tool just looks like extra homework.

**Try this thought experiment:** you're writing an essay. You save it as `essay.docx`. The next day you make
changes you're not sure about, so you save a copy: `essay_v2.docx`. A week later: `essay_v2_edited.docx`. The
night before it's due: `essay_v2_edited_FINAL.docx`, then `essay_v2_edited_FINAL_ACTUALLY.docx`.

Sound familiar? Now imagine that's not a 2-page essay — it's a folder of 40 code files, and you're not the only
person editing them. Your teammate emails you their version. Whose changes win? Did anyone lose the paragraph you
wrote at 1am?

This is **version control**: a system that remembers every change you've ever made to a project, who made it, and
why — without you ever needing a second copy of the file. **Git** is the version control system almost every
software team on Earth uses. **GitHub** is a website that hosts Git projects online so people can collaborate on
them (more on that distinction in Module 3 — it trips up almost everyone at first).

Here's the shape of what you're about to learn:

```mermaid
flowchart LR
    A["Working directory<br/>(your actual files)"] -->|"git add"| B["Staging area<br/>(what you're about to save)"]
    B -->|"git commit"| C["Repository<br/>(permanent history)"]
    C -->|"git push"| D["GitHub<br/>(hosted online)"]
```

That's the whole mental model. Every command you learn in this course is really just moving something along that
diagram. Next lesson: getting the tool installed so you can actually do this.
""",
            },
            {
                "title": "Installing Git & Saying Hello",
                "body": """**Try it:** open a terminal (Terminal on Mac, or Git Bash / PowerShell on Windows — if you
installed Git via [git-scm.com](https://git-scm.com/downloads) you'll have Git Bash) and type:

```bash
git --version
```

If you see something like `git version 2.43.0`, you're already set — skip to the config step below. If you get
"command not found", install Git first:

- **Windows:** download and run the installer from git-scm.com. Accept the defaults — they're fine for now.
- **Mac:** run `git --version` in Terminal anyway — macOS often offers to install it for you on the spot. If not,
  install [Homebrew](https://brew.sh) and run `brew install git`.
- **Linux:** `sudo apt install git` (Debian/Ubuntu) or `sudo dnf install git` (Fedora).

**Now tell Git who you are.** Every commit you ever make gets stamped with a name and email, so your teammates
(and future you) know who to blame — or thank. Run these two commands, with your own name and email:

```bash
git config --global user.name "Ada Lovelace"
git config --global user.email "ada@example.com"
```

The `--global` flag means "use this for every project on this computer" — you only have to do this once per
machine, not once per project.

**Why this matters:** without this, your first commit will fail with a mildly cryptic error about "author
identity unknown." You just prevented your first bug. Next lesson: turning a plain folder into an actual Git
repository, and making your first commit.
""",
            },
            {
                "title": "Your First Repository",
                "body": """Time for the real thing. **Try it, step by step:**

```bash
mkdir my-first-repo
cd my-first-repo
git init
```

`git init` turns this ordinary folder into a **repository** — a project Git is now watching for changes. Nothing
in the folder changed; Git just started paying attention (it added a hidden `.git` folder where all the history
lives — you'll never touch it directly).

Now create a file:

```bash
echo "Hello, Git!" > notes.txt
git status
```

`git status` is the command you'll run more than any other — it tells you what Git currently sees. It should
show `notes.txt` as an **untracked file**. Git noticed it exists, but you haven't told Git to start tracking it
yet. Let's do that:

```bash
git add notes.txt
git commit -m "Add notes.txt with a greeting"
```

`git add` moves the file into the **staging area** — the "about to save" pile from the diagram in lesson 1.1.
`git commit` takes a permanent snapshot of everything currently staged, labeled with the message you gave it.

**Check your work:**

```bash
git log
```

You should see your one commit, with your name, the message, and a timestamp. That's a real, permanent entry in
this project's history — it will still be there in ten years if you keep this repository around.

**Try it once more, to feel the pattern:** edit `notes.txt` (add another line), then repeat `git add notes.txt`
and `git commit -m "..."` with a new message. Run `git log` again — now there are two commits. This
edit → add → commit loop is 90% of daily Git use.

Ready to check you've got it? Take the module quiz below — you need every question right to move on (it's short
and nothing here is a trick question).
""",
            },
        ],
        "quiz": {
            "title": "Module 1 Quiz",
            "pass_threshold_pct": 100,
            "questions": [
                {
                    "prompt": "What does `git init` do to an existing folder?",
                    "choices": [
                        {"id": "a", "text": "Deletes all files in it and starts fresh"},
                        {
                            "id": "b",
                            "text": "Turns it into a Git repository Git will track, without changing its files",
                        },
                        {"id": "c", "text": "Uploads it to GitHub"},
                        {"id": "d", "text": "Creates a backup copy of the folder"},
                    ],
                    "correct_choice_ids": ["b"],
                    "explanation": "git init just adds a hidden .git folder so Git starts watching this directory — your actual files are untouched.",
                },
                {
                    "prompt": "You edited a file. What's the correct order to permanently save that change as a commit?",
                    "choices": [
                        {"id": "a", "text": "git commit, then git add"},
                        {"id": "b", "text": "git add, then git commit"},
                        {"id": "c", "text": "git push, then git add"},
                        {"id": "d", "text": "git status, then git push"},
                    ],
                    "correct_choice_ids": ["b"],
                    "explanation": "git add stages the change; git commit takes the permanent snapshot of whatever is staged.",
                },
                {
                    "prompt": "What command shows you the full history of commits in a repository?",
                    "choices": [
                        {"id": "a", "text": "git status"},
                        {"id": "b", "text": "git history"},
                        {"id": "c", "text": "git log"},
                        {"id": "d", "text": "git init"},
                    ],
                    "correct_choice_ids": ["c"],
                    "explanation": "git log lists every commit, in order, with its author, message, and timestamp.",
                },
                {
                    "prompt": "Why does every commit need `git config --global user.name` and `user.email` set first?",
                    "choices": [
                        {"id": "a", "text": "So Git can email you notifications"},
                        {
                            "id": "b",
                            "text": "So every commit is stamped with who made it",
                        },
                        {"id": "c", "text": "It's required to install Git"},
                        {"id": "d", "text": "It sets your GitHub password"},
                    ],
                    "correct_choice_ids": ["b"],
                    "explanation": "Git stamps every commit with an author name and email so history shows who changed what — it has nothing to do with your GitHub account or password.",
                },
            ],
        },
    },
    {
        "title": "Time Travel: History, Staging & Undo",
        "summary": "The staging area properly explained, reading history, undoing mistakes, and .gitignore.",
        "lessons": [
            {
                "title": "The Staging Area (Git's Waiting Room)",
                "body": """Module 1 had you run `git add` before every commit without much explanation of *why* that
extra step exists — most other tools just save the whole file. Here's the "why."

**Try it:** in your `my-first-repo` folder, edit `notes.txt` AND create a brand new file `todo.txt`. Now run:

```bash
git status
```

You'll see `notes.txt` listed as "modified" and `todo.txt` as "untracked" — but nothing has been staged yet. Now
stage only one of them:

```bash
git add notes.txt
git status
```

Notice `notes.txt` is now "staged" (green), while `todo.txt` is still sitting there untracked. **This is the
whole point of staging**: you can choose exactly what goes into the next commit, file by file, even change by
change within a file (`git add -p` does that, if you're curious later) — instead of every commit being forced to
include everything you've touched.

```mermaid
flowchart LR
    A["notes.txt (edited)<br/>todo.txt (new)"] -->|"git add notes.txt"| B["Staged: notes.txt<br/>Not staged: todo.txt"]
    B -->|"git commit"| C["Commit contains<br/>only notes.txt's change"]
```

**Why this matters:** real projects often have you mid-way through two unrelated changes at once. Staging lets
you commit the finished one cleanly, without bundling in the half-done other thing. Go ahead and finish the job:

```bash
git add todo.txt
git commit -m "Add todo.txt and update notes.txt"
```

Next up: actually reading that history back, and comparing versions.
""",
            },
            {
                "title": "Reading History: git log and git diff",
                "body": """You've used `git log` to see your commit list. Let's get more out of it, and learn to see
*exactly* what changed, not just that something did.

**Try it:**

```bash
git log --oneline
```

Same history, one line per commit — much easier to scan once you have more than three or four commits. Now edit
`notes.txt` again (add a line), but don't commit yet. Run:

```bash
git diff
```

This shows the exact lines added/removed since your last commit — added lines prefixed with `+`, removed with
`-`. This is the single most useful command for "wait, what did I actually change?" before you commit or ask
someone to review your work.

**One more:** after you commit that change, you can diff between any two commits, not just "now vs. last commit":

```bash
git log --oneline
git diff <first-commit-id> <second-commit-id>
```

(Copy two of the short IDs from the `git log --oneline` output.) You'll see this exact pattern — "what changed
between these two points" — is how code review works on GitHub too, just with a web UI instead of a terminal.

**Why this matters:** `git diff` before committing is a habit that catches embarrassing mistakes (a stray debug
line, an accidental file you didn't mean to touch) before they become permanent history. Next: what to do when
you catch one *after* it's already committed.
""",
            },
            {
                "title": "Undoing Mistakes (Everyone Makes Them)",
                "body": """Here's the fear that stops a lot of beginners: "what if I break something?" Git's entire
job is to make that fear unnecessary — almost nothing is permanent until you say so.

**Try it — undo an uncommitted change:** edit `notes.txt`, make it worse on purpose (type nonsense), then:

```bash
git status
```

Notice it suggests `git restore <file>` right there in the output. Run it:

```bash
git restore notes.txt
```

Open the file — your nonsense edit is gone, back to the last commit's version. That's a full undo of anything
not yet committed.

**Try it — undo a staged change:** stage a change with `git add`, then change your mind:

```bash
git restore --staged notes.txt
```

This un-stages it (back to "modified, not staged") without losing the edit itself — useful when you staged the
wrong file.

**What about an already-committed mistake?** That's what `git revert` is for — instead of erasing history (which
gets dangerous once you've pushed to GitHub and others may have that history too), it adds a *new* commit that
undoes an old one:

```bash
git log --oneline
git revert <commit-id>
```

**Why this matters:** notice the pattern — undoing gets progressively more deliberate the more "permanent" the
mistake is (uncommitted → staged → committed), and reverting a commit is itself just... another commit, fully
visible in history. Nothing silently vanishes. Next: keeping junk out of your repo in the first place.
""",
            },
            {
                "title": ".gitignore: Telling Git What to Ignore",
                "body": """Not everything in a project folder belongs in version control — think generated files,
downloaded dependencies, or your personal notes-to-self. Committing those bloats the repo and creates noisy,
meaningless diffs.

**Try it:** in your repo, create a file that's clearly "junk" — `secret_diary.txt` — then create a special file
named exactly `.gitignore` (yes, starting with a dot, no extension) containing:

```
secret_diary.txt
```

Now run `git status`. Notice `secret_diary.txt` no longer shows up as untracked at all — Git is deliberately
looking the other way. You can also ignore whole folders (`node_modules/`) or patterns (`*.log` ignores every
file ending in `.log`).

**Why this matters:** `.gitignore` is itself just a file you commit like any other, so the whole team shares the
same ignore rules automatically. Real projects almost always start with one — when you create your GitHub repo
in Module 3, you'll be offered a ready-made `.gitignore` for your project's language, and now you know exactly
what that file is actually doing.

You've now got the core daily-use toolkit: init, add, commit, status, diff, log, restore, revert, and
`.gitignore`. Take the quiz below, then it's time to put your work on the internet.
""",
            },
        ],
        "quiz": {
            "title": "Module 2 Quiz",
            "pass_threshold_pct": 100,
            "questions": [
                {
                    "prompt": "You've run `git add` on a file but haven't committed yet. Which command un-stages it without losing your edit?",
                    "choices": [
                        {"id": "a", "text": "git restore --staged <file>"},
                        {"id": "b", "text": "git revert <file>"},
                        {"id": "c", "text": "git init"},
                        {"id": "d", "text": "git log <file>"},
                    ],
                    "correct_choice_ids": ["a"],
                    "explanation": "git restore --staged moves a file back to 'modified, not staged' — the edit itself is untouched.",
                },
                {
                    "prompt": "What does `git diff` show you (with no other arguments)?",
                    "choices": [
                        {"id": "a", "text": "The list of all past commits"},
                        {
                            "id": "b",
                            "text": "The exact lines changed since your last commit",
                        },
                        {"id": "c", "text": "Which files are ignored"},
                        {"id": "d", "text": "Your GitHub username"},
                    ],
                    "correct_choice_ids": ["b"],
                    "explanation": "git diff compares your current uncommitted changes against the last commit, line by line.",
                },
                {
                    "prompt": "Why does Git prefer `git revert` over erasing history for an already-committed, already-pushed mistake?",
                    "choices": [
                        {
                            "id": "a",
                            "text": "Erasing history isn't possible in Git at all",
                        },
                        {
                            "id": "b",
                            "text": "revert adds a new commit undoing the old one, keeping history intact for anyone who already has it",
                        },
                        {"id": "c", "text": "revert is faster to type"},
                        {"id": "d", "text": "It automatically emails your teammates"},
                    ],
                    "correct_choice_ids": ["b"],
                    "explanation": "Once others may have pulled that history, rewriting it gets dangerous — revert undoes the change safely by adding new history instead of rewriting old history.",
                },
                {
                    "prompt": "What does adding `secret_diary.txt` to a `.gitignore` file do?",
                    "choices": [
                        {"id": "a", "text": "Deletes secret_diary.txt permanently"},
                        {"id": "b", "text": "Encrypts secret_diary.txt"},
                        {
                            "id": "c",
                            "text": "Tells Git to stop showing that file as untracked / stop tracking changes to it",
                        },
                        {
                            "id": "d",
                            "text": "Uploads secret_diary.txt to GitHub privately",
                        },
                    ],
                    "correct_choice_ids": ["c"],
                    "explanation": ".gitignore just tells Git which files/patterns to ignore entirely — the file still exists on disk, Git simply stops paying attention to it.",
                },
            ],
        },
    },
    {
        "title": "GitHub: Git's Home on the Internet",
        "summary": "The Git vs. GitHub distinction, creating your account, and pushing your first repo online.",
        "lessons": [
            {
                "title": "Git vs. GitHub (They're Not the Same Thing)",
                "body": """This confuses almost every beginner at least once, so let's kill it early: **Git** is the
version-control tool you've been using this whole course — it runs entirely on your computer, works with zero
internet connection, and has nothing to do with any particular website. **GitHub** is a company/website that
hosts Git repositories online, so you (and others) can access them from anywhere and collaborate.

You could use Git for your entire life and never touch GitHub. But GitHub adds the pieces that make
collaboration actually work: a permanent online home for your repo, a way for others to see and copy it, and
tools for proposing and discussing changes (pull requests — Module 4).

There are other sites like GitHub (GitLab, Bitbucket) — same idea, different company. GitHub is simply the most
widely used, and the one nearly every open-source project and tech employer expects you to have an account on.

```mermaid
flowchart LR
    subgraph Your computer
    A["Git<br/>(the tool)"]
    end
    subgraph Internet
    B["GitHub<br/>(hosts your repos)"]
    end
    A <-->|"git push / git pull"| B
```

Next lesson: creating your account — this is also most of the way to your capstone project.
""",
            },
            {
                "title": "Creating Your GitHub Account",
                "body": """**Try it:** go to [github.com/signup](https://github.com/signup) and create a free account.
A few honest tips before you do:

- **Pick your username carefully.** It becomes part of your profile URL (`github.com/your-username`) and shows
  up on every commit you ever push publicly. Something professional and close to your real name reads well on a
  future job application — `xX_coder_Xx` less so.
- **Use an email address you'll still have in five years.** Not a throwaway — you'll want this account long-term.
- **Verify your email** when prompted — some features (including creating repositories) need it.

Once you're in, go to your profile (click your avatar, top right → **Your profile**) and fill in a couple of
details: a real name, and optionally a short bio. This is the page that shows up when anyone — including a
future employer — looks you up.

**Why this matters:** a GitHub profile with real commits on it is one of the most common things employers
actually check for an entry-level developer. Everything you build in this course's exercises can live there
permanently. Next: getting your local repo from Module 1-2 actually onto this account.
""",
            },
            {
                "title": "Pushing Your First Repo to GitHub",
                "body": """You have a local repo (from Module 1) with a couple of commits. Let's put it on GitHub.

**Try it:**

1. On GitHub, click the **+** icon (top right) → **New repository**.
2. Name it `my-first-repo` (or anything you like), leave it **Public**, and — since your local folder already has
   commits — do **not** check "Add a README" (that would create a conflicting starting point; you'll add one
   from your own computer instead).
3. Click **Create repository**. GitHub shows you a page with some commands under "…or push an existing
   repository from the command line." That's exactly what you need.

Back in your terminal, inside `my-first-repo`, run the commands GitHub showed you — they'll look like this
(GitHub fills in your actual username and repo name):

```bash
git remote add origin https://github.com/your-username/my-first-repo.git
git branch -M main
git push -u origin main
```

- `git remote add origin <url>` tells your local repo "there's a copy of you that should live at this URL,
  and I'll call it `origin`" — this only needs doing once per repo.
- `git push` uploads your commits to that URL. `-u origin main` additionally remembers this pairing, so every
  push after this one can just be `git push`.

**Refresh the GitHub page** — your files and full commit history are now there, publicly visible, permanently
(well — until you delete the repo). Anyone with the URL can see it, clone it, or read every commit you made.

**Try it once more, to close the loop:** make one more small change locally, commit it, then just run:

```bash
git push
```

Refresh GitHub again — your new commit is there too. This add → commit → push loop is the daily rhythm of using
Git and GitHub together. You are extremely close to your capstone now — take this module's quiz, then Module 4
covers branches and working with others, and after that: ship the real thing.
""",
            },
        ],
        "quiz": {
            "title": "Module 3 Quiz",
            "pass_threshold_pct": 100,
            "questions": [
                {
                    "prompt": "What's the actual difference between Git and GitHub?",
                    "choices": [
                        {
                            "id": "a",
                            "text": "They're two names for the exact same tool",
                        },
                        {
                            "id": "b",
                            "text": "Git is the version-control tool on your computer; GitHub is a website that hosts Git repositories online",
                        },
                        {"id": "c", "text": "GitHub is required to use Git at all"},
                        {
                            "id": "d",
                            "text": "Git is only for private projects, GitHub only for public ones",
                        },
                    ],
                    "correct_choice_ids": ["b"],
                    "explanation": "Git works entirely offline on your machine; GitHub is a hosting service (one of several) built on top of it for sharing and collaborating.",
                },
                {
                    "prompt": "What does `git push` do?",
                    "choices": [
                        {"id": "a", "text": "Creates a new local commit"},
                        {
                            "id": "b",
                            "text": "Uploads your local commits to the remote (e.g. GitHub)",
                        },
                        {"id": "c", "text": "Downloads someone else's repository"},
                        {"id": "d", "text": "Deletes your local repository"},
                    ],
                    "correct_choice_ids": ["b"],
                    "explanation": "git push sends commits that exist locally up to the connected remote repository.",
                },
                {
                    "prompt": "Why does `git remote add origin <url>` only need to be run once per repository?",
                    "choices": [
                        {
                            "id": "a",
                            "text": "It permanently records where 'origin' points to for this repo, so future pushes don't need it repeated",
                        },
                        {
                            "id": "b",
                            "text": "It only works once, ever, per GitHub account",
                        },
                        {
                            "id": "c",
                            "text": "It's actually required before every single push",
                        },
                        {"id": "d", "text": "It expires after 24 hours"},
                    ],
                    "correct_choice_ids": ["a"],
                    "explanation": "That command just labels a remote URL as 'origin' for this repo — it's saved, so later pushes can just say `git push`.",
                },
                {
                    "prompt": 'You create a brand-new GitHub repo to hold an EXISTING local project with commits already in it. Should you check "Add a README" during creation?',
                    "choices": [
                        {"id": "a", "text": "Yes, always"},
                        {
                            "id": "b",
                            "text": "No — that creates a starting commit on GitHub that conflicts with your local history",
                        },
                        {"id": "c", "text": "It has no effect either way"},
                        {"id": "d", "text": "Only if the project is private"},
                    ],
                    "correct_choice_ids": ["b"],
                    "explanation": "Adding a README on GitHub creates an initial commit there — when your local repo already has its own separate history, that causes an avoidable conflict when you push.",
                },
            ],
        },
    },
    {
        "title": "Branches, and Working With Others",
        "summary": "Branches as parallel timelines, merging, and how forks/pull requests power open source.",
        "lessons": [
            {
                "title": "Branches: Parallel Universes for Your Code",
                "body": """Every repo you've made so far has had one single line of history: `main`. **Branches** let
you split off a parallel line to try something — a new feature, a risky experiment — without touching `main`
until you're ready.

```mermaid
gitGraph
   commit id: "main: setup"
   commit id: "main: homepage"
   branch feature-about-page
   checkout feature-about-page
   commit id: "add about page"
   commit id: "style about page"
   checkout main
   commit id: "main: fix typo"
   merge feature-about-page id: "merge: about page done"
```

Reading that diagram: work on `feature-about-page` happened in parallel with a small fix landing directly on
`main` — neither line blocked the other. When the feature was ready, `merge` folded its commits back into `main`.

**Why this matters:** without branches, you'd either have to finish every feature perfectly before committing
anything, or risk breaking `main` for everyone while you're mid-experiment. Branches remove that trade-off
entirely — `main` stays stable while you work.

Next lesson: actually creating one and merging it back, hands-on.
""",
            },
            {
                "title": "Making and Merging a Branch",
                "body": """**Try it**, in your repo from earlier modules:

```bash
git branch practice-branch
git checkout practice-branch
```

(Or do both in one step: `git checkout -b practice-branch`.) Confirm where you are:

```bash
git branch
```

The branch with a `*` next to it is the one you're currently "on." Now make a change and commit it, same as
always:

```bash
echo "This line only exists on practice-branch" >> notes.txt
git add notes.txt
git commit -m "Add a practice-branch-only line"
```

**Switch back and look:**

```bash
git checkout main
cat notes.txt
```

That line isn't there — because it only exists on `practice-branch`. Your `main` branch is exactly as it was.
Now bring it in:

```bash
git merge practice-branch
cat notes.txt
```

Now it's there — `main` has absorbed `practice-branch`'s commit. If you `git push` now, that merged change goes
to GitHub too, same as any other commit.

**Why this matters:** this exact workflow — branch, work, merge back — is what almost every professional team
does for every single change, just usually with GitHub's pull request UI wrapping the merge step (next lesson).
You just did the raw mechanics underneath that UI.
""",
            },
            {
                "title": "Forks & Pull Requests: How Open Source Works",
                "body": """You've learned to branch and merge within your own repo. But what if you want to contribute
to someone *else's* project — one you don't have push access to? That's what forks and pull requests are for.

A **fork** is your own personal copy of someone else's GitHub repository, under your account. You can push to
your fork freely — it's yours — without needing any permission on the original.

A **pull request** (PR) is a request you open on the original project: "here's a branch on my fork with some
changes — please review them, and if you like them, merge them into your project." The maintainer can comment,
ask for changes, or approve and merge it, all in GitHub's web interface.

```mermaid
flowchart LR
    A["Original project<br/>(you can't push here)"] -->|"Fork"| B["Your copy<br/>(you own this)"]
    B -->|"branch + commit + push"| C["Your branch on your fork"]
    C -->|"Open a Pull Request"| A
```

This is genuinely how the vast majority of open-source software gets built: thousands of contributors who don't
have direct write access, all proposing changes through forks and pull requests, reviewed by maintainers who do.
It's also exactly how you'll contribute to this club's own projects on GitHub.

**Why this matters:** you now understand every piece of the diagram from Lesson 1.1, plus the collaboration
model layered on top. That's the complete picture this course set out to teach. One quiz left, then the
capstone: make it real.
""",
            },
        ],
        "quiz": {
            "title": "Module 4 Quiz",
            "pass_threshold_pct": 100,
            "questions": [
                {
                    "prompt": "What is a Git branch, conceptually?",
                    "choices": [
                        {"id": "a", "text": "A backup copy of the entire repository"},
                        {
                            "id": "b",
                            "text": "A parallel line of commits that doesn't affect other branches until merged",
                        },
                        {
                            "id": "c",
                            "text": "A GitHub-only feature that doesn't exist in plain Git",
                        },
                        {"id": "d", "text": "A way to delete old commits"},
                    ],
                    "correct_choice_ids": ["b"],
                    "explanation": "A branch lets commits happen in parallel without touching other branches — merging is what brings them together.",
                },
                {
                    "prompt": "After merging practice-branch into main, where do practice-branch's commits now also exist?",
                    "choices": [
                        {"id": "a", "text": "Nowhere — merging deletes them"},
                        {
                            "id": "b",
                            "text": "Only on practice-branch, main is unaffected",
                        },
                        {"id": "c", "text": "On main too, since merge folds them in"},
                        {"id": "d", "text": "Only on GitHub, not locally"},
                    ],
                    "correct_choice_ids": ["c"],
                    "explanation": "git merge brings the other branch's commits into your current branch — after merging, main has them too.",
                },
                {
                    "prompt": 'What is a "fork" on GitHub?',
                    "choices": [
                        {"id": "a", "text": "A tool for eating your commits"},
                        {
                            "id": "b",
                            "text": "Your own personal copy of someone else's repository, which you can push to freely",
                        },
                        {"id": "c", "text": "A type of branch that can't be merged"},
                        {"id": "d", "text": "A premium GitHub feature"},
                    ],
                    "correct_choice_ids": ["b"],
                    "explanation": "Forking copies a repo to your own account so you can make changes without needing write access to the original.",
                },
                {
                    "prompt": "What does opening a Pull Request actually do?",
                    "choices": [
                        {
                            "id": "a",
                            "text": "Immediately merges your changes with no review",
                        },
                        {"id": "b", "text": "Deletes the original repository"},
                        {
                            "id": "c",
                            "text": "Asks the original project's maintainers to review and possibly merge your proposed changes",
                        },
                        {"id": "d", "text": "Downloads the project to your computer"},
                    ],
                    "correct_choice_ids": ["c"],
                    "explanation": "A PR is a request for review and merge — the maintainer stays in control of what actually lands in their project.",
                },
            ],
        },
    },
]

FINAL_EXAM = {
    "title": "Final Exam",
    "intro_text": (
        "18 questions covering everything from Module 1 to Module 4. No going back once you start, so make sure "
        "you've got a clear stretch of time — most people take 15-20 minutes."
    ),
    "pass_threshold_pct": 70,
    "questions": [
        {
            "prompt": "What core problem does version control (like Git) solve?",
            "choices": [
                {"id": "a", "text": "It makes your computer run faster"},
                {
                    "id": "b",
                    "text": "It remembers every change made to a project, by whom, without needing manual file copies",
                },
                {"id": "c", "text": "It automatically writes your code for you"},
                {"id": "d", "text": "It compresses files to save disk space"},
            ],
            "correct_choice_ids": ["b"],
            "explanation": "Version control replaces the 'essay_v2_FINAL_ACTUALLY.docx' pattern with a system that tracks every change and its author automatically.",
        },
        {
            "prompt": "Which command turns an ordinary folder into a Git repository?",
            "choices": [
                {"id": "a", "text": "git init"},
                {"id": "b", "text": "git start"},
                {"id": "c", "text": "git new"},
                {"id": "d", "text": "git create"},
            ],
            "correct_choice_ids": ["a"],
            "explanation": "git init adds a hidden .git folder so Git begins tracking that directory — no other files are changed.",
        },
        {
            "prompt": "Put these in the correct order a change moves through: staging area, working directory, repository.",
            "choices": [
                {"id": "a", "text": "Repository -> staging area -> working directory"},
                {"id": "b", "text": "Working directory -> staging area -> repository"},
                {"id": "c", "text": "Staging area -> working directory -> repository"},
                {
                    "id": "d",
                    "text": "They all happen at the same time, order doesn't matter",
                },
            ],
            "correct_choice_ids": ["b"],
            "explanation": "You edit files in the working directory, git add moves changes to staging, and git commit saves staged changes permanently to the repository.",
        },
        {
            "prompt": "Which command moves a changed file into the staging area?",
            "choices": [
                {"id": "a", "text": "git commit"},
                {"id": "b", "text": "git push"},
                {"id": "c", "text": "git add"},
                {"id": "d", "text": "git stage"},
            ],
            "correct_choice_ids": ["c"],
            "explanation": "git add stages a file — it does not yet make a permanent commit.",
        },
        {
            "prompt": 'What does `git commit -m "message"` do?',
            "choices": [
                {
                    "id": "a",
                    "text": "Permanently saves a snapshot of everything currently staged, labeled with that message",
                },
                {"id": "b", "text": "Uploads your code to GitHub"},
                {"id": "c", "text": "Deletes the staging area"},
                {"id": "d", "text": "Creates a new branch"},
            ],
            "correct_choice_ids": ["a"],
            "explanation": "A commit is a permanent, labeled snapshot of whatever is currently staged — nothing is sent anywhere until you push.",
        },
        {
            "prompt": "What does `git status` tell you?",
            "choices": [
                {"id": "a", "text": "Your GitHub account's status (active/suspended)"},
                {
                    "id": "b",
                    "text": "Which files are untracked, modified, or staged right now",
                },
                {"id": "c", "text": "The full history of every commit"},
                {"id": "d", "text": "Whether your internet connection is working"},
            ],
            "correct_choice_ids": ["b"],
            "explanation": "git status is a snapshot of the current state of your working directory and staging area, not history.",
        },
        {
            "prompt": "What does `git log` show?",
            "choices": [
                {"id": "a", "text": "A list of every file in the repository"},
                {
                    "id": "b",
                    "text": "The ordered history of commits, with author, message, and timestamp",
                },
                {"id": "c", "text": "Your uncommitted changes"},
                {"id": "d", "text": "Error messages from failed commands"},
            ],
            "correct_choice_ids": ["b"],
            "explanation": "git log lists the permanent commit history in order — for uncommitted changes you'd use git status or git diff instead.",
        },
        {
            "prompt": "With no other arguments, what does `git diff` compare?",
            "choices": [
                {"id": "a", "text": "Two different repositories"},
                {
                    "id": "b",
                    "text": "Your uncommitted working-directory changes against the last commit",
                },
                {"id": "c", "text": "Your local branch against GitHub"},
                {"id": "d", "text": "Two commits chosen at random"},
            ],
            "correct_choice_ids": ["b"],
            "explanation": "Plain git diff shows exactly what's changed since your last commit, line by line.",
        },
        {
            "prompt": "You've edited a file but not staged or committed it, and want to discard the edit entirely. What command does that?",
            "choices": [
                {"id": "a", "text": "git restore <file>"},
                {"id": "b", "text": "git revert <file>"},
                {"id": "c", "text": "git delete <file>"},
                {"id": "d", "text": "git commit --undo"},
            ],
            "correct_choice_ids": ["a"],
            "explanation": "git restore reverts an uncommitted change back to the last-committed version of the file.",
        },
        {
            "prompt": "Why does Git favor `git revert` over rewriting history for a mistake that's already been pushed?",
            "choices": [
                {
                    "id": "a",
                    "text": "revert is the only undo command that exists in Git",
                },
                {
                    "id": "b",
                    "text": "Rewriting shared history can silently break things for anyone who already pulled it; revert adds a safe new commit instead",
                },
                {"id": "c", "text": "revert is faster to type than other commands"},
                {"id": "d", "text": "GitHub blocks all other undo commands"},
            ],
            "correct_choice_ids": ["b"],
            "explanation": "Once history is shared, revert is the safe option — it undoes a change by adding new history rather than altering what others already have.",
        },
        {
            "prompt": "What does a `.gitignore` file do?",
            "choices": [
                {
                    "id": "a",
                    "text": "Lists files/patterns Git should not track or show as untracked",
                },
                {"id": "b", "text": "Deletes the listed files from disk"},
                {"id": "c", "text": "Password-protects the listed files"},
                {
                    "id": "d",
                    "text": "Automatically backs up the listed files to GitHub privately",
                },
            ],
            "correct_choice_ids": ["a"],
            "explanation": ".gitignore just tells Git to ignore matching files/folders — they still exist on disk, Git simply stops tracking them.",
        },
        {
            "prompt": "What is the actual relationship between Git and GitHub?",
            "choices": [
                {
                    "id": "a",
                    "text": "Git is the offline version-control tool; GitHub is a website that hosts Git repositories online",
                },
                {
                    "id": "b",
                    "text": "GitHub is required to use Git — Git cannot function without it",
                },
                {
                    "id": "c",
                    "text": "They are two different names for the same exact product",
                },
                {
                    "id": "d",
                    "text": "Git is for private code, GitHub is only for public code",
                },
            ],
            "correct_choice_ids": ["a"],
            "explanation": "Git runs entirely locally with no internet required; GitHub (one of several such services) hosts Git repos so people can collaborate online.",
        },
        {
            "prompt": "What does `git push` do?",
            "choices": [
                {
                    "id": "a",
                    "text": "Uploads your local commits to a connected remote, such as GitHub",
                },
                {
                    "id": "b",
                    "text": "Downloads someone else's repository to your computer",
                },
                {"id": "c", "text": "Creates a local commit"},
                {"id": "d", "text": "Deletes commits from GitHub"},
            ],
            "correct_choice_ids": ["a"],
            "explanation": "push sends commits that exist locally up to whatever remote you've connected (commonly named origin).",
        },
        {
            "prompt": "Before your very first commit will succeed, what must you configure once per computer?",
            "choices": [
                {"id": "a", "text": "Your GitHub password"},
                {"id": "b", "text": "git config --global user.name and user.email"},
                {"id": "c", "text": "A billing plan"},
                {"id": "d", "text": "A .gitignore file"},
            ],
            "correct_choice_ids": ["b"],
            "explanation": "Git stamps every commit with an author name and email — without configuring them, your first commit fails with an 'author identity unknown' error.",
        },
        {
            "prompt": "What is a Git branch?",
            "choices": [
                {
                    "id": "a",
                    "text": "A separate, full copy of the entire repository stored elsewhere",
                },
                {
                    "id": "b",
                    "text": "A parallel line of commits that doesn't affect other branches until it's merged",
                },
                {
                    "id": "c",
                    "text": "A GitHub-exclusive feature with no equivalent in plain Git",
                },
                {"id": "d", "text": "A permanent, unchangeable snapshot"},
            ],
            "correct_choice_ids": ["b"],
            "explanation": "Branches let work happen in parallel — main stays untouched by a branch's commits until you explicitly merge it.",
        },
        {
            "prompt": "After running `git merge feature-branch` while on `main`, what's true?",
            "choices": [
                {"id": "a", "text": "feature-branch is permanently deleted"},
                {"id": "b", "text": "main now also contains feature-branch's commits"},
                {"id": "c", "text": "Nothing changes until you also run git push"},
                {"id": "d", "text": "main is renamed to feature-branch"},
            ],
            "correct_choice_ids": ["b"],
            "explanation": "Merging folds the other branch's commits into your current branch immediately, locally — pushing is a separate, later step.",
        },
        {
            "prompt": 'What is a "fork" of a GitHub repository?',
            "choices": [
                {
                    "id": "a",
                    "text": "Your own personal copy of someone else's repository, which you can push to freely",
                },
                {"id": "b", "text": "A branch that automatically deletes itself"},
                {"id": "c", "text": "A paid GitHub feature"},
                {
                    "id": "d",
                    "text": "A tool for merging two unrelated repositories together",
                },
            ],
            "correct_choice_ids": ["a"],
            "explanation": "Forking gives you your own copy under your account, so you can make changes without needing write access to the original repo.",
        },
        {
            "prompt": "What does opening a Pull Request actually accomplish?",
            "choices": [
                {
                    "id": "a",
                    "text": "It immediately merges your branch into the target project with no review",
                },
                {
                    "id": "b",
                    "text": "It asks the target project's maintainers to review your proposed changes, and merge them if approved",
                },
                {"id": "c", "text": "It downloads the target project to your computer"},
                {"id": "d", "text": "It deletes your fork"},
            ],
            "correct_choice_ids": ["b"],
            "explanation": "A PR is a request for review — the maintainers of the target project decide whether and when to merge it.",
        },
    ],
}

CAPSTONE = {
    "title": "Ship Your First Repo",
    "instructions": """This is the whole point: turn everything from this course into one real, permanent, public
piece of work.

**What to do:**

1. If you haven't already (Module 3), create a free account at [github.com/signup](https://github.com/signup).
2. Create a new **public** repository — call it anything you like. A good, simple option: a repo named after
   your own username (e.g. `your-username`) with a `README.md` that's just a short paragraph about who you are
   and what you're learning — GitHub shows this specific repo's README on your profile page automatically.
3. On your computer: `git init` (if you didn't create it with a README on GitHub), write something in
   `README.md`, then `git add`, `git commit`, connect it with `git remote add origin ...`, and `git push`.
4. Make sure you have **at least one real commit** with a message that actually describes what you did — not
   just "commit 1".

**Submit the link to your repository below** (e.g. `https://github.com/your-username/your-repo`). A club admin
will check that it's public, has at least one commit, and has a README — then you're done.
""",
}


def main() -> None:
    db = SessionLocal()

    admin = db.query(User).filter(User.email == SEED_ADMIN_EMAIL).first()
    if not admin:
        raise SystemExit(
            f"Seed admin '{SEED_ADMIN_EMAIL}' not found — run this against a dev DB that has it."
        )

    if db.query(Course).filter(Course.slug == COURSE_SLUG).first():
        raise SystemExit(
            f"Course '{COURSE_SLUG}' already exists — edit it via /admin/courses instead of re-seeding."
        )

    course = course_service.create_course(
        db,
        admin,
        {
            "slug": COURSE_SLUG,
            "title": COURSE_TITLE,
            "short_description": COURSE_SHORT_DESCRIPTION,
            "description": COURSE_DESCRIPTION,
            "cover_image_url": None,
            "price_kes": 0,
            "difficulty": 1,
        },
    )

    for module_data in MODULES:
        module = course_service.create_module(
            db,
            admin,
            course,
            {"title": module_data["title"], "summary": module_data["summary"]},
        )
        for lesson_data in module_data["lessons"]:
            course_service.create_lesson(
                db,
                admin,
                module,
                {"title": lesson_data["title"], "body": lesson_data["body"]},
            )

        quiz_data = module_data["quiz"]
        quiz = course_service.create_module_quiz(
            db,
            admin,
            module,
            {
                "title": quiz_data["title"],
                "intro_text": None,
                "pass_threshold_pct": quiz_data["pass_threshold_pct"],
            },
        )
        for q in quiz_data["questions"]:
            course_service.create_question(
                db,
                admin,
                quiz,
                {
                    "prompt": q["prompt"],
                    "choices": q["choices"],
                    "correct_choice_ids": q["correct_choice_ids"],
                    "explanation": q["explanation"],
                },
            )

    final_exam = course_service.create_final_exam(
        db,
        admin,
        course,
        {
            "title": FINAL_EXAM["title"],
            "intro_text": FINAL_EXAM["intro_text"],
            "pass_threshold_pct": FINAL_EXAM["pass_threshold_pct"],
        },
    )
    for q in FINAL_EXAM["questions"]:
        course_service.create_question(
            db,
            admin,
            final_exam,
            {
                "prompt": q["prompt"],
                "choices": q["choices"],
                "correct_choice_ids": q["correct_choice_ids"],
                "explanation": q["explanation"],
            },
        )

    course_service.create_capstone(
        db,
        admin,
        course,
        {"title": CAPSTONE["title"], "instructions": CAPSTONE["instructions"]},
    )

    print(
        f"Seeded course '{COURSE_TITLE}' ({COURSE_SLUG}) with {len(MODULES)} modules, "
        f"{sum(len(m['lessons']) for m in MODULES)} lessons, {sum(len(m['quiz']['questions']) for m in MODULES)} module "
        f"quiz questions, a {len(FINAL_EXAM['questions'])}-question final exam, and a capstone. "
        "Draft — review and publish from /admin/courses."
    )


if __name__ == "__main__":
    main()

# Tech Club Digital Platform

## Complete UX, Product Flow & Design Direction

## 1. Product Vision

The website should feel like a **living digital clubhouse for builders**.

It is not primarily:

* a university information website
* a course platform
* an event calendar
* a payment portal

It is a community where students can:

**Discover → Join → Learn → Build → Collaborate → Ship → Showcase**

The website should make the visitor feel:

> "There are people here building interesting things. I want to be part of this."

---

# 2. Core Product Model

There are four primary states of a person.

```text
VISITOR
   ↓
ACCOUNT
   ↓
MEMBERSHIP PENDING
   ↓
ACTIVE MEMBER
```

An additional state exists for administrators:

```text
ACTIVE MEMBER
      ↓
   ADMIN ROLE
```

### Visitor

Can:

* browse homepage
* view public projects
* browse public events
* view public challenges
* read community articles
* view public member/project showcases
* sign up

Cannot:

* register for member-only activities
* join club projects
* submit challenges
* access member dashboard
* access private resources
* participate in private community areas

---

### Account

A user who has registered.

Can:

* access dashboard
* complete onboarding
* create/edit profile
* browse the member experience
* start membership activation
* see membership status

Cannot:

* access member-only participation
* register for restricted events
* join restricted projects
* submit member-only content

---

### Membership Pending

The user has initiated membership and/or successfully paid but is awaiting verification.

Can:

* see payment status
* see membership application status
* continue completing profile
* browse the community
* see what membership unlocks

Cannot:

* access full member functionality

---

### Active Member

Can:

* register for member events
* join projects
* participate in challenges
* publish eligible content
* access member resources
* interact with community features
* track achievements
* maintain a public profile

---

# 3. Visual Design Direction

## Theme: "Digital Workshop"

The visual metaphor is:

**A futuristic student engineering lab where everything is being built live.**

Avoid making it look like a corporate SaaS dashboard.

### Visual characteristics

Use:

* deep dark backgrounds
* near-black elevated surfaces
* electric green as the primary identity accent
* small amounts of secondary neon accents
* monospaced typography for technical metadata
* large expressive headings
* subtle technical grid patterns
* terminal-style labels
* thin borders
* soft glows
* cards that resemble physical "projects/artifacts"
* animated status indicators
* subtle ambient motion

### Design vocabulary

Examples:

```text
SYSTEM ONLINE
BUILDING
OPEN FOR CONTRIBUTORS
MEMBERSHIP ACTIVE
3 SPOTS AVAILABLE
EVENT STARTING SOON
PROJECT SHIPPED
```

These should appear as small visual elements rather than dominating the interface.

### Avoid

* generic blue university portal styling
* excessive gradients
* excessive glassmorphism
* overly futuristic sci-fi UI
* complicated dashboards
* excessive animations
* gamification everywhere

The website should feel **technical, youthful, creative, and trustworthy**.

---

# 4. Global Navigation

## Public navigation

```text
Logo

Explore
Projects
Events
Challenges
Learn
Community

            Sign In
            Join Club
```

On mobile:

```text
Logo                      ☰
```

---

## Authenticated navigation

```text
Logo

Explore
Projects
Events
Challenges
Learn
Community

-------------------------

Dashboard
My Profile
Membership

-------------------------

Notifications
Avatar
```

---

## Admin navigation

Additional admin entry:

```text
Admin
```

The admin area should be visually distinct but use the same design system.

---

# 5. Homepage Flow

## First impression

The homepage should immediately communicate activity.

### Hero

```text
BUILD.
LEARN.
SHIP.

A community of students building
real things with technology.

[ Join the Club ]
[ Explore Projects ]
```

Below:

```text
37 BUILDERS
12 ACTIVE PROJECTS
8 UPCOMING EVENTS
24 CHALLENGES COMPLETED
```

These numbers can animate subtly on first load.

---

## Live Community Strip

A horizontal activity ticker:

```text
● Amina started CampusConnect
● Brian completed Challenge #14
● Rust Workshop opens tomorrow
● 3 new members joined
```

Clicking an activity leads to the relevant content.

---

## Featured Project

Large immersive project card.

```text
FEATURED PROJECT

CampusConnect

Open-source platform for discovering
events around campus.

Python   FastAPI   PostgreSQL

12 contributors

[ Explore Project ]
```

Use an image/video/demo preview.

---

## Upcoming Events

Cards:

```text
FRI
29
AUG

Rust Systems Workshop

5:00 PM
Engineering Lab 2

[ View Event ]
```

---

## Challenge of the Week

Large interactive card:

```text
THIS WEEK'S BUILD

Build a URL Shortener

Difficulty: Intermediate
Estimated time: 4 hours

126 participants

[ Take Challenge ]
```

---

## Community Highlight

Show a member or team.

```text
MEMBER SPOTLIGHT

Amina

"I joined to learn backend
development. Six months later
I'm maintaining our API."

Backend • Python • Rust

[ View Profile ]
```

---

## Final CTA

```text
DON'T JUST WATCH.

BUILD WITH US.

[ Join the Club ]
```

---

# 6. Sign Up Flow

The signup experience should be intentionally short.

## Entry

User clicks:

```text
Join the Club
```

They see:

```text
JOIN THE BUILDERS

Create your account.

[ Continue with Google ]

──────── OR ────────

Email
[________________]

Password
[________________]

[ Create Account ]

Already have an account?
Sign in
```

---

## Google Signup

Flow:

```text
Join Club
   ↓
Continue with Google
   ↓
Google authentication
   ↓
Account created
   ↓
Onboarding
```

---

## Email Signup

Flow:

```text
Email + password
        ↓
Create account
        ↓
Verification email
        ↓
User verifies
        ↓
Continue onboarding
```

---

# 7. First Login / Onboarding

The onboarding should not feel like a boring registration form.

It should feel like:

> "Let's get to know the builder."

Progress indicator:

```text
01 Identity
02 Interests
03 Goals
04 Profile
05 Membership
```

---

## Step 1 — Identity

```text
What's your name?

First name
[ John ]

Last name
[ Doe ]

What should people call you?
[ John ]
```

---

## Step 2 — Technology Interests

Use interactive chips.

```text
WHAT ARE YOU INTO?

Select everything that interests you.

[ Backend ] [ Frontend ]
[ Mobile ] [ AI / ML ]
[ Cybersecurity ] [ Cloud ]
[ Systems ] [ Embedded ]
[ Data ] [ DevOps ]
[ Open Source ] [ Robotics ]

            [ Continue ]
```

Selected chips animate slightly.

---

## Step 3 — Experience

```text
WHERE ARE YOU RIGHT NOW?

○ Just getting started

○ I've built a few projects

○ Comfortable building independently

○ Advanced / experienced
```

This should never feel like an exam.

---

## Step 4 — Goals

```text
WHAT DO YOU WANT TO DO HERE?

[ Build projects ]

[ Meet other developers ]

[ Learn new technologies ]

[ Participate in hackathons ]

[ Improve my portfolio ]

[ Contribute to open source ]

[ Find collaborators ]
```

Multiple selections.

---

## Step 5 — Profile

```text
BUILD YOUR PROFILE

Profile photo
[ Upload ]

Bio
[ Tell the community about yourself... ]

GitHub
[ github.com/... ]

LinkedIn
[ ... ]

Portfolio
[ ... ]
```

These fields should be skippable except required identity fields.

---

# 8. Onboarding Completion

End with an immersive transition.

```text
WELCOME, JOHN.

You're officially part of the
community.

But there's one more step.

Activate your membership to
start participating.

[ Activate Membership ]
```

Animation:

```text
ACCOUNT CREATED
      ↓
PROFILE READY
      ↓
COMMUNITY DISCOVERED
      ↓
MEMBERSHIP
```

---

# 9. Dashboard — Unactivated Account

This is a crucial state.

The dashboard should **not pretend the user is already a member**.

Header:

```text
WELCOME BACK, JOHN.

Your account is ready.
Your membership isn't active yet.
```

Main card:

```text
MEMBERSHIP

You're one step away.

Unlock:

✓ Events
✓ Projects
✓ Challenges
✓ Community participation
✓ Member resources
✓ Member profile

              KSh 500 / year

[ Activate Membership ]
```

---

## Dashboard sections

Even before membership, allow:

```text
Explore
Upcoming Events
Projects
Challenges
Learning Paths
```

But locked actions should clearly explain why.

Example:

```text
JOIN PROJECT

🔒 Membership required

Activate your membership to
join projects.

[ Activate Membership ]
```

This is much better than simply disabling buttons.

---

# 10. Membership Activation Flow

User clicks:

```text
Activate Membership
```

## Step 1 — Review

```text
ACTIVATE MEMBERSHIP

2026 Club Membership

KSh 500

Membership period:
24 Aug 2026 — 23 Aug 2027

Includes:

✓ Member events
✓ Projects
✓ Challenges
✓ Community participation
✓ Member resources
✓ Public profile

[ Continue to Payment ]
```

---

# 11. Payment Flow

Collect/confirm phone number:

```text
PAY WITH M-PESA

Phone number

+254 7XX XXX XXX

We'll send an M-Pesa payment
request to this number.

Amount

KSh 500

[ Send Payment Request ]
```

Backend creates a payment transaction.

Use MpesaKit to initiate the STK Push and process the callback. MpesaKit currently documents M-Pesa Express/STK Push as operational and provides callback processing helpers for the integration.

---

## Payment Processing

After clicking:

```text
SEND PAYMENT REQUEST
```

Display:

```text
CHECK YOUR PHONE

We've sent an M-Pesa payment
request to +254 7XX XXX XXX.

Enter your M-Pesa PIN on your phone.

              ● ● ●
           
Waiting for confirmation...
```

Do NOT ask the user to enter their M-Pesa PIN inside the website.

---

## Payment States

### Waiting

```text
Waiting for M-Pesa confirmation...
```

Poll/subscription to backend payment status.

---

### Success

```text
✓ PAYMENT RECEIVED

Your membership payment has
been successfully received.

M-Pesa Receipt:
QGH7ABC123

Your membership is now
active.

[ Continue ]
```

---

### User cancelled

```text
PAYMENT CANCELLED

No money was charged.

[ Try Again ]
```

---

### Timeout / unknown result

```text
PAYMENT STATUS UNKNOWN

We haven't received confirmation yet.

Don't pay again.

We're checking with M-Pesa.

[ Check Again ]
```

This is extremely important for payment UX.

Never encourage duplicate payment when the network/callback state is uncertain.

---

### Failed

```text
PAYMENT FAILED

We couldn't complete the payment.

Reason:
Transaction cancelled / timed out / unavailable

[ Try Again ]
```

---

# 12. Membership Pending — waiting on payment, not approval

There is no post-payment waiting period anymore — the only "pending" state
left is the brief window between sending the STK push and Safaricom
confirming it (usually seconds). While that's in flight:

```text
Check your phone

We've sent an M-Pesa request to your phone.
Enter your M-Pesa PIN on your phone to approve KSh 200.

waiting for confirmation · 4s
```

If the callback hasn't landed within 20s, the backend actively asks
Safaricom for the real status via STK Query instead of continuing to wait
passively (see §41) — invisible to the member, it just resolves faster. Only
if that's *also* inconclusive does the UI, after 60s total, admit it doesn't
know yet:

```text
We haven't heard back yet

We're still checking with M-Pesa. Don't pay again —
if the payment does go through, we'll pick it up automatically.

[ Check Again ]
```

The moment payment confirms — by either path — membership is active. There
is no separate "application submitted, awaiting admin" step to depict.

---

# 13. Member Dashboard — Pending State

Dashboard banner, shown only during that same brief payment-confirmation
window:

```text
PAYMENT PENDING

Waiting for M-Pesa confirmation
```

Allow:

* profile editing
* public content browsing
* event discovery
* project discovery
* learning resources

Lock:

* member-only registration
* joining private projects
* member submissions
* member-only discussions

---

# 14. Admin Membership Approval — superseded

**This step no longer exists.** Membership now activates automatically the
moment payment succeeds (via Safaricom's callback, or the STK Query fallback
if the callback is dropped/delayed — see §41's payment flow) — there is no
admin review queue, no "Approve"/"Reject"/"Request More Information" actions,
and no separate `approval_pending` status to wait in.

The `/admin/memberships` page still exists, but only as a read-only roster
(filterable by active/all) for an admin to look up a member's payment and
status — there's nothing to action on it, because there's nothing pending.

The wireframes that used to live in this section (a "new membership" admin
notification, a review page with Approve/Reject/Request-more-info buttons)
are kept below only as a historical record of the original design — they
were removed from the actual product, not just hidden:

```text
NEW MEMBERSHIP (no longer sent — nothing to review)

John Doe

Software Engineering
Interests:
Backend · Rust · Open Source

Payment:
KSh 500
M-Pesa Receipt:
QGH7ABC123

[ Review ]
```

```text
MEMBERSHIP APPLICATION (page removed)

Profile
----------------
John Doe
Email
Phone
Course
Year
Interests
Goals

Payment
----------------
Amount: KSh 500
Receipt: QGH7ABC123
Status: Confirmed
Date: ...

Actions

[ Approve Membership ]

[ Reject ]

[ Request More Information ]
```

---

# 15. Instant Activation

The moment payment succeeds:

```text
Membership
PAYMENT_PENDING
   ↓
ACTIVE
```

Member receives:

```text
🎉 YOU'RE IN.

Your Tech Club membership is now active.

The community is waiting.

[ Explore the Community ]
```

Dashboard changes dramatically — and it happens in the same session as
paying, not after a wait for someone to click Approve.

---

# 16. Active Member Dashboard

The dashboard should become a **personal launchpad**.

```text
GOOD EVENING, JOHN.

MEMBER SINCE
24 AUG 2026

─────────────────────────────

YOUR ACTIVITY

3 Projects
5 Challenges
7 Events
2 Achievements

─────────────────────────────

CONTINUE BUILDING

CampusConnect
██████████░░ 72%

[ Continue Project ]

─────────────────────────────

UP NEXT

Rust Workshop
Friday · 5:00 PM

[ Register ]

─────────────────────────────

COMMUNITY

Amina just shipped CampusConnect v2.

[ View Activity ]
```

The dashboard should feel alive.

---

# 17. Member Profile

Profile is both personal and public.

```text
┌─────────────────────────────────┐
│        PROFILE                  │
│                                 │
│        [avatar]                 │
│        John Doe                 │
│        Backend Engineer         │
│                                 │
│ Backend · Rust · Python         │
│                                 │
│ [ GitHub ] [ LinkedIn ]         │
└─────────────────────────────────┘
```

Then:

```text
Projects
Challenges
Achievements
Events
About
```

---

## Profile visibility

Allow:

```text
Public
Club members
Private
```

Default public fields:

* name
* profile photo
* interests
* projects
* achievements

Never expose:

* phone number
* payment information
* administrative information

---

# 18. Event Discovery

Public event cards:

```text
UPCOMING EVENTS

29 AUG
Rust Systems Workshop

5:00 PM
Engineering Lab 2

Intermediate

[ Explore ]
```

---

# 19. Event Detail

The page should be immersive.

Hero:

```text
RUST
SYSTEMS
WORKSHOP

Build systems that actually
understand memory.

29 AUGUST
5:00 PM
ENGINEERING LAB 2
```

Then:

```text
ABOUT

WHAT YOU'LL BUILD

WHO SHOULD ATTEND

SCHEDULE

SPEAKER

REQUIREMENTS
```

---

# 20. Event Registration Flow

Visitor:

```text
[ Register ]
      ↓
Sign in / Create account
      ↓
Check membership
```

If not active:

```text
MEMBERSHIP REQUIRED

You need an active club membership
to register for this event.

[ Activate Membership ]
```

---

## Active Member

```text
REGISTER FOR EVENT

Rust Systems Workshop

Saturday, 29 August
5:00 PM
Engineering Lab 2

[ Confirm Registration ]
```

Then:

```text
REGISTRATION RECEIVED

Your registration has been submitted.

Status:
● Pending approval
```

---

# 21. Event Admin Approval

Admin receives registration:

```text
EVENT REGISTRATION

John Doe

Rust Systems Workshop

Member:
✓ Active

Registration:
Pending

[ Approve ]
[ Reject ]
[ Waitlist ]
```

Admin can bulk approve registrations.

---

# 22. Approved Event

Member sees:

```text
YOU'RE REGISTERED ✓

Rust Systems Workshop

29 AUG
5:00 PM

Engineering Lab 2

[ Add to Calendar ]
[ View Event ]
```

Optional:

QR/event pass:

```text
EVENT PASS

JOHN DOE

Rust Systems Workshop

[ QR CODE ]
```

The QR code can later be used for event attendance.

---

# 23. Event Day

Member dashboard:

```text
TODAY

RUST SYSTEMS WORKSHOP

Starts in

01 : 42 : 18

[ View Event Pass ]
```

After attendance is recorded:

```text
✓ ATTENDED

+5 community points
```

---

# 24. Projects

Projects page:

```text
BUILD WITH US

Projects created by members.

[ Explore ]
[ Start a Project ]
```

Project card:

```text
CampusConnect

Open-source campus events platform.

Python
FastAPI
PostgreSQL

8 contributors

🟢 Looking for contributors

[ View Project ]
```

---

# 25. Project Detail

```text
CAMPUSCONNECT

Build status:
● Active

8 contributors
14 issues
72 commits

──────────────────

ABOUT

──────────────────

TECH STACK

──────────────────

ROADMAP

──────────────────

CONTRIBUTORS

──────────────────

ACTIVITY
```

Primary action:

```text
[ Join Project ]
```

---

# 26. Joining a Project

Clicking Join:

```text
JOIN CAMPUSCONNECT

What would you like to contribute?

[ Backend ]
[ Frontend ]
[ Design ]
[ DevOps ]
[ Documentation ]
[ Testing ]

Why are you interested?

[_____________________]

[ Send Request ]
```

Project owner/admin may approve.

---

# 27. Challenges

Challenge page:

```text
THIS WEEK'S CHALLENGE

BUILD A URL SHORTENER

Difficulty
██████░░░

Estimated time
4 hours

Participants
126

Deadline
Sunday 11:59 PM

[ Start Challenge ]
```

---

# 28. Challenge Submission

```text
SUBMIT YOUR BUILD

GitHub Repository
[________________]

Live Demo
[________________]

What did you learn?

[________________]

Screenshots

[ Upload ]

[ Submit ]
```

After submission:

```text
SUBMISSION RECEIVED ✓
```

---

# 29. Community Activity

Activity page:

```text
COMMUNITY

🔥 Amina shipped CampusConnect v2

🚀 Brian opened a new project

🏆 Kevin won Challenge #14

👋 Jane joined the club

📚 John published:
"Understanding Rust Ownership"
```

This should feel like a lightweight builder feed, not a social-media clone.

---

# 30. Learning

Learning is a support layer rather than the primary product.

Instead of an enormous course platform:

```text
LEARN

Learning Paths

Backend Engineering
Systems Programming
AI / ML
Cybersecurity
Frontend
Cloud & DevOps
```

Each path:

```text
BACKEND ENGINEERING

Start
   ↓
HTTP fundamentals
   ↓
Python
   ↓
FastAPI
   ↓
Databases
   ↓
Authentication
   ↓
Deployment

PROJECT
Build a production API
```

The path should continuously point toward actual projects.

---

# 31. Community Recognition

Achievements:

```text
ACHIEVEMENTS

🔥 First Build
🎯 Challenge Complete
🚀 Project Shipped
🤝 Community Helper
🏆 Challenge Winner
💻 Open Source Contributor
🎤 Workshop Speaker
```

The design should avoid making the platform feel childish.

Recognition should feel like **engineering credentials**, not arcade trophies.

---

# 32. Notifications

Notifications should be useful.

Examples:

```text
Membership active ✓

Your project request was approved.

Rust Workshop registration confirmed.

Challenge deadline is tomorrow.

You were mentioned in CampusConnect.

Your article was published.
```

Avoid notifying users about every tiny action.

---

# 33. Admin Platform

Admin is a separate workspace.

Navigation:

```text
Overview
Members
Membership
Events
Registrations
Projects
Challenges
Content
Announcements
Payments
Reports
Settings
```

---

# 34. Admin Overview

```text
CLUB OVERVIEW

137
TOTAL MEMBERS

6
UNMATCHED PAYMENTS

8
UPCOMING EVENTS

12
ACTIVE PROJECTS
```

Activity:

```text
RECENT

+5 memberships
+17 event registrations
+2 projects
+32 challenge submissions
```

---

# 35. Membership Administration — read-only roster, no queue

Membership activates automatically on payment (§41), so there's no
application queue left to administer. `/admin/memberships` is a plain,
read-only roster for looking a member up — no bulk actions, because there's
nothing left to action:

```text
MEMBERS

John Doe       Payment ✓     Active
Amina Wanjiku  Payment ✓     Active
Brian Otieno   Payment ✓     Active
```

Filters:

```text
Active
All
```

Payment issues (a callback that never resolved, an STK push that failed)
are surfaced separately, in §36's payment reconciliation dashboard — not
mixed into this roster.

---

# 36. Payment Administration

This should be a reconciliation dashboard.

```text
PAYMENTS

Successful        KSh 68,500
Pending            KSh 1,000
Failed             KSh 500

────────────────────────────

Receipt
Member
Amount
Purpose
Status
Date
```

Important:

The admin should never manually mark a payment as successful merely because a user says they paid.

Payment state should come from the backend's M-Pesa transaction processing.

MpesaKit provides typed callback processing and transaction-status support that can support this backend reconciliation flow.

---

# 37. Event Administration

Create:

```text
Event title
Description
Date
Time
Venue
Capacity
Speaker
Membership requirement
Approval requirement
Status
```

Event states:

```text
Draft
Published
Registration Open
Registration Closed
Live
Completed
Cancelled
```

---

# 38. Content Approval

Some community content should require moderation.

Content states:

```text
Draft
Pending Review
Approved
Published
Rejected
Archived
```

Admin can approve:

* articles
* projects
* challenges
* announcements
* public showcases

---

# 39. Admin Audit Trail

Every important administrative action should be recorded.

Example:

```text
AUDIT LOG

24 Aug 20:21

Admin: Jane Doe

Approved registration:
#REG-00931
```

Membership activation itself isn't logged here anymore — it's automatic
(§41), not an admin action, so there's no admin to attribute it to. It's
still fully traceable, just via the payment record instead of the audit log.

This becomes especially valuable once multiple administrators exist.

---

# 40. Global State Model

The application should explicitly model state.

```text
USER

ACCOUNT
 ├── incomplete
 └── complete

MEMBERSHIP
 ├── none
 ├── payment_pending
 ├── payment_received
 ├── active          (auto-activates on successful payment — no admin approval step)
 ├── expired
 └── suspended
```

Event registration:

```text
EVENT_REGISTRATION
 ├── draft
 ├── pending
 ├── approved
 ├── rejected
 ├── waitlisted
 ├── attended
 └── cancelled
```

Payment:

```text
PAYMENT
 ├── initiated
 ├── pending
 ├── completed
 ├── failed
 ├── cancelled
 └── unknown
```

These states should drive the UI.

---

# 41. Critical UX Principle — revised

**Superseded.** This section originally argued for keeping payment success
and membership activation as two separate steps, gated by a human admin
review in between. That admin-review gate has been removed — payment
success is now itself the qualifying action, and membership activates
automatically:

```text
STK PUSH
   ↓
M-PESA PAYMENT
   ↓
PAYMENT CONFIRMED
   ↓
MEMBERSHIP ACTIVE
```

What's still true, and worth keeping from the original principle: **payment
state and authorization state remain two separate columns** (`Payment.status`
vs `Membership.status`, in separate tables) — a completed payment doesn't
directly imply "active" in the code, it's `_activate_membership()` reacting
to it. That distinction is what let the system add a second, automatic path
to the same activation (the STK Query fallback, for when Safaricom's
callback is dropped or delayed) without touching the membership model at
all. What changed is *who* (or what) is allowed to flip the switch — it used
to require a human admin in the loop; now the payment provider's own
confirmation is trusted directly.

---

# 42. The Complete User Journey

## New student

```text
LAND ON WEBSITE
      ↓
DISCOVER CLUB
      ↓
EXPLORE PROJECTS
      ↓
SEE UPCOMING EVENT
      ↓
CLICK JOIN
      ↓
SIGN UP WITH GOOGLE
      ↓
ONBOARDING
      ↓
PERSONAL DASHBOARD
      ↓
ACTIVATE MEMBERSHIP
      ↓
M-PESA STK PUSH
      ↓
PAYMENT CONFIRMED
      ↓
🎉 MEMBER ACTIVATED (instant — see §41)
      ↓
ENTER MEMBER DASHBOARD
      ↓
REGISTER FOR EVENT
      ↓
ADMIN APPROVES
      ↓
ATTEND EVENT
      ↓
JOIN PROJECT
      ↓
BUILD
      ↓
SUBMIT CHALLENGE
      ↓
EARN RECOGNITION
      ↓
SHOWCASE PROJECT
      ↓
HELP OTHER MEMBERS
```

---

# 43. The Emotional Journey

This is just as important as the functional journey.

```text
"I've never heard of this club."
             ↓
"This looks interesting."
             ↓
"These students are actually building things."
             ↓
"I want to join."
             ↓
"That was easy."
             ↓
"I'm officially a member."
             ↓
"I found a project."
             ↓
"I built something."
             ↓
"People noticed."
             ↓
"I belong here."
```

The product should optimize for **that emotional progression**.

---

# 44. Creative Interaction Opportunities

Do not animate everything.

Use moments of delight.

### Membership activation

The moment payment confirms:

```text
ACCOUNT
   ↓
MEMBER
```

The interface could briefly transform from:

```text
ACCOUNT ACCESS
```

to:

```text
MEMBER ACCESS
● ONLINE
```

with a subtle green pulse.

---

### Project shipped

When a project changes to shipped:

```text
BUILDING
██████████████████

SHIP IT

      ↓

🚀 SHIPPED
```

---

### Challenge completion

Instead of a generic toast:

```text
CHALLENGE COMPLETE

You just shipped another build.

+20 XP
```

---

### Event day

The event page gradually transforms as the event approaches.

```text
3 DAYS

→

TOMORROW

→

TODAY

01:42:18
```

---

# 45. Mobile Experience

Mobile should not feel like a desktop website squeezed down.

Bottom navigation:

```text
Home
Explore
Build
Activity
Profile
```

The `Build` tab opens:

```text
Projects
Challenges
Submit
```

Floating action:

```text
+
```

Potential actions:

```text
Start Project
Submit Challenge
Publish
```

---

# 46. Accessibility

The immersive visual language should not compromise accessibility.

Ensure:

* readable contrast
* keyboard navigation
* visible focus states
* reduced motion support
* semantic HTML
* screen-reader labels
* clear error states
* no information communicated by color alone

Animations should enhance meaning rather than hide it.

---

# 47. Empty States

Do not leave empty pages blank.

Example:

```text
NO PROJECTS YET

The first great project could be yours.

[ Start a Project ]
```

Challenges:

```text
NOTHING TO SHOW YET

Your first challenge is coming.

[ Explore Learning Paths ]
```

Events:

```text
QUIET WEEK

No events this week.

Check out what the community
is currently building.

[ Explore Projects ]
```

---

# 48. Error States

Errors should be human.

Instead of:

```text
ERR_PAYMENT_CALLBACK_504
```

show:

```text
WE'RE STILL CHECKING

M-Pesa hasn't confirmed the
payment yet.

Don't make another payment.

[ Check Status ]
```

Technical details can be visible to admins.

---

# 49. Core Product Loops

The website should be designed around several loops.

## Membership loop

```text
Discover
 ↓
Signup
 ↓
Pay
 ↓
Member
```

## Builder loop

```text
Discover Project
 ↓
Join
 ↓
Build
 ↓
Contribute
 ↓
Ship
 ↓
Showcase
```

## Learning loop

```text
Interested
 ↓
Learning Path
 ↓
Workshop
 ↓
Project
 ↓
Challenge
 ↓
Practice
```

## Community loop

```text
Attend
 ↓
Meet people
 ↓
Collaborate
 ↓
Build
 ↓
Share
 ↓
Help others
```

These loops are more important than any individual page.

---

# 50. MVP / Initial Build Scope

The first production version should prioritize:

### Public

* Homepage
* Projects
* Events
* Challenges
* Learning
* Community
* Sign up / Sign in

### Authenticated

* Onboarding
* Dashboard
* Profile
* Membership
* Payment
* Membership status
* Event registration

### Admin

* Dashboard
* Membership roster
* Event registration approvals
* Payments/reconciliation
* Events
* Projects
* Content moderation
* Audit log

Do NOT initially build:

* full messaging platform
* complex forums
* sophisticated course authoring
* complicated social feeds
* elaborate XP economy
* massive analytics system

Build the community mechanics first.

---

# 51. Final Experience

The ideal user should be able to say:

> "I came here because I saw a cool project."

Then:

> "I created an account."

Then:

> "I paid five hundred bob and got accepted."

Then:

> "I joined a project."

Then:

> "I went to a workshop."

Then:

> "I built something with three other students."

Then:

> "Now my profile shows what I've actually done."

That is the experience the entire product should serve.

## Product mantra

```text
DON'T JUST JOIN A CLUB.

BUILD SOMETHING.

WITH PEOPLE.

AND LEAVE WITH SOMETHING
YOU'RE PROUD TO SHOW.
```

This should be the north star for the design.

// Types used across more than one API domain — kept here instead of
// duplicated (or forced into one domain's file and imported sideways by
// unrelated ones).

export type PaymentStatus = "initiated" | "pending" | "completed" | "failed" | "cancelled" | "unknown";

export type ExperienceLevel = "starting" | "some_projects" | "independent" | "advanced";

export type ChoiceItem = { id: string; text: string };

export type Arm = { id: string; slug: string; name: string; position: number };

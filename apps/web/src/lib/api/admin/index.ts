// adminApi used to be one ~100-method object literal spanning 12 unrelated
// domains. Each domain now lives in its own file; this just merges their
// method objects back into a single `adminApi` so every existing call site
// (`adminApi.listCourses(...)`, `adminApi.overview()`, ...) keeps working.
import { adminOverviewApi } from "./overview";
import { adminUsersApi } from "./users";
import { adminMembersApi } from "./members";
import { adminEventsApi } from "./events";
import { adminContentApi } from "./content";
import { adminProjectsApi } from "./projects";
import { adminCoursesApi } from "./courses";
import { adminArmsApi } from "./arms";
import { adminRoadmapsApi } from "./roadmaps";
import { adminFormsApi } from "./forms";
import { adminUploadsApi } from "./uploads";

export * from "./overview";
export * from "./users";
export * from "./members";
export * from "./events";
export * from "./content";
export * from "./projects";
export * from "./courses";
export * from "./arms";
export * from "./roadmaps";
export * from "./forms";
export * from "./uploads";

export const adminApi = {
  ...adminOverviewApi,
  ...adminUsersApi,
  ...adminMembersApi,
  ...adminEventsApi,
  ...adminContentApi,
  ...adminProjectsApi,
  ...adminCoursesApi,
  ...adminArmsApi,
  ...adminRoadmapsApi,
  ...adminFormsApi,
  ...adminUploadsApi,
};

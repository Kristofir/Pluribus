import { defineSchema } from "convex/server";
import { authTables } from "@convex-dev/auth/server";

// No product tables until the first feature is defined.
export default defineSchema({ ...authTables });

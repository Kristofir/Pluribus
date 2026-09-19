/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as Canvas from "../Canvas.js";
import type * as Documents from "../Documents.js";
import type * as Health from "../Health.js";
import type * as Presence from "../Presence.js";
import type * as Users from "../Users.js";
import type * as auth from "../auth.js";
import type * as canvas_Actor from "../canvas/Actor.js";
import type * as canvas_Deletions from "../canvas/Deletions.js";
import type * as canvas_Documents from "../canvas/Documents.js";
import type * as canvas_Handlers from "../canvas/Handlers.js";
import type * as canvas_LegacyDocuments from "../canvas/LegacyDocuments.js";
import type * as canvas_Model from "../canvas/Model.js";
import type * as canvas_Persistence from "../canvas/Persistence.js";
import type * as documents_Access from "../documents/Access.js";
import type * as documents_Authors from "../documents/Authors.js";
import type * as documents_Authorship from "../documents/Authorship.js";
import type * as documents_ChildText from "../documents/ChildText.js";
import type * as documents_Persistence from "../documents/Persistence.js";
import type * as documents_Sync from "../documents/Sync.js";
import type * as http from "../http.js";
import type * as presence_Access from "../presence/Access.js";
import type * as presence_Handlers from "../presence/Handlers.js";
import type * as presence_Model from "../presence/Model.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  Canvas: typeof Canvas;
  Documents: typeof Documents;
  Health: typeof Health;
  Presence: typeof Presence;
  Users: typeof Users;
  auth: typeof auth;
  "canvas/Actor": typeof canvas_Actor;
  "canvas/Deletions": typeof canvas_Deletions;
  "canvas/Documents": typeof canvas_Documents;
  "canvas/Handlers": typeof canvas_Handlers;
  "canvas/LegacyDocuments": typeof canvas_LegacyDocuments;
  "canvas/Model": typeof canvas_Model;
  "canvas/Persistence": typeof canvas_Persistence;
  "documents/Access": typeof documents_Access;
  "documents/Authors": typeof documents_Authors;
  "documents/Authorship": typeof documents_Authorship;
  "documents/ChildText": typeof documents_ChildText;
  "documents/Persistence": typeof documents_Persistence;
  "documents/Sync": typeof documents_Sync;
  http: typeof http;
  "presence/Access": typeof presence_Access;
  "presence/Handlers": typeof presence_Handlers;
  "presence/Model": typeof presence_Model;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
  presence: import("@convex-dev/presence/_generated/component.js").ComponentApi<"presence">;
  prosemirrorSync: import("@convex-dev/prosemirror-sync/_generated/component.js").ComponentApi<"prosemirrorSync">;
};

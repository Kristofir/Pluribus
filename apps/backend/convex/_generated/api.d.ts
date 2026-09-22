/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as AgentAccess from "../AgentAccess.js";
import type * as Canvas from "../Canvas.js";
import type * as CanvasUrlImport from "../CanvasUrlImport.js";
import type * as Documents from "../Documents.js";
import type * as Health from "../Health.js";
import type * as Inbox from "../Inbox.js";
import type * as Presence from "../Presence.js";
import type * as ShareLinks from "../ShareLinks.js";
import type * as Sources from "../Sources.js";
import type * as Users from "../Users.js";
import type * as Workspaces from "../Workspaces.js";
import type * as agentAccess_Access from "../agentAccess/Access.js";
import type * as agentAccess_CanvasActions from "../agentAccess/CanvasActions.js";
import type * as agentAccess_CanvasReads from "../agentAccess/CanvasReads.js";
import type * as agentAccess_Context from "../agentAccess/Context.js";
import type * as agentAccess_Edits from "../agentAccess/Edits.js";
import type * as agentAccess_Mcp from "../agentAccess/Mcp.js";
import type * as agentAccess_Model from "../agentAccess/Model.js";
import type * as agentAccess_Tools from "../agentAccess/Tools.js";
import type * as agentAccess_Undo from "../agentAccess/Undo.js";
import type * as ai_OpenAi from "../ai/OpenAi.js";
import type * as auth from "../auth.js";
import type * as canvas_Actor from "../canvas/Actor.js";
import type * as canvas_Creations from "../canvas/Creations.js";
import type * as canvas_Deletions from "../canvas/Deletions.js";
import type * as canvas_Documents from "../canvas/Documents.js";
import type * as canvas_ElementLifecycles from "../canvas/ElementLifecycles.js";
import type * as canvas_GeometryHistory from "../canvas/GeometryHistory.js";
import type * as canvas_Handlers from "../canvas/Handlers.js";
import type * as canvas_History from "../canvas/History.js";
import type * as canvas_HistoryCredentials from "../canvas/HistoryCredentials.js";
import type * as canvas_HistoryModel from "../canvas/HistoryModel.js";
import type * as canvas_HistoryPersistence from "../canvas/HistoryPersistence.js";
import type * as canvas_Images from "../canvas/Images.js";
import type * as canvas_LegacyDocuments from "../canvas/LegacyDocuments.js";
import type * as canvas_Model from "../canvas/Model.js";
import type * as canvas_UrlImportAccess from "../canvas/UrlImportAccess.js";
import type * as canvas_UrlImportPolicy from "../canvas/UrlImportPolicy.js";
import type * as documents_Access from "../documents/Access.js";
import type * as documents_Authors from "../documents/Authors.js";
import type * as documents_Authorship from "../documents/Authorship.js";
import type * as documents_ChildText from "../documents/ChildText.js";
import type * as documents_Paragraphs from "../documents/Paragraphs.js";
import type * as documents_Persistence from "../documents/Persistence.js";
import type * as documents_Sync from "../documents/Sync.js";
import type * as http from "../http.js";
import type * as inbox_AgentMail from "../inbox/AgentMail.js";
import type * as inbox_Drafts from "../inbox/Drafts.js";
import type * as inbox_Jobs from "../inbox/Jobs.js";
import type * as inbox_Model from "../inbox/Model.js";
import type * as inbox_Provisioning from "../inbox/Provisioning.js";
import type * as inbox_Reconciliation from "../inbox/Reconciliation.js";
import type * as inbox_Sends from "../inbox/Sends.js";
import type * as integrations_Http from "../integrations/Http.js";
import type * as presence_Access from "../presence/Access.js";
import type * as presence_Agents from "../presence/Agents.js";
import type * as presence_Handlers from "../presence/Handlers.js";
import type * as presence_Model from "../presence/Model.js";
import type * as sources_Firecrawl from "../sources/Firecrawl.js";
import type * as sources_Jobs from "../sources/Jobs.js";
import type * as sources_Model from "../sources/Model.js";
import type * as sources_Persistence from "../sources/Persistence.js";
import type * as sources_Screenshot from "../sources/Screenshot.js";
import type * as workspaces_Access from "../workspaces/Access.js";
import type * as workspaces_Handlers from "../workspaces/Handlers.js";
import type * as workspaces_Provisioning from "../workspaces/Provisioning.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  AgentAccess: typeof AgentAccess;
  Canvas: typeof Canvas;
  CanvasUrlImport: typeof CanvasUrlImport;
  Documents: typeof Documents;
  Health: typeof Health;
  Inbox: typeof Inbox;
  Presence: typeof Presence;
  ShareLinks: typeof ShareLinks;
  Sources: typeof Sources;
  Users: typeof Users;
  Workspaces: typeof Workspaces;
  "agentAccess/Access": typeof agentAccess_Access;
  "agentAccess/CanvasActions": typeof agentAccess_CanvasActions;
  "agentAccess/CanvasReads": typeof agentAccess_CanvasReads;
  "agentAccess/Context": typeof agentAccess_Context;
  "agentAccess/Edits": typeof agentAccess_Edits;
  "agentAccess/Mcp": typeof agentAccess_Mcp;
  "agentAccess/Model": typeof agentAccess_Model;
  "agentAccess/Tools": typeof agentAccess_Tools;
  "agentAccess/Undo": typeof agentAccess_Undo;
  "ai/OpenAi": typeof ai_OpenAi;
  auth: typeof auth;
  "canvas/Actor": typeof canvas_Actor;
  "canvas/Creations": typeof canvas_Creations;
  "canvas/Deletions": typeof canvas_Deletions;
  "canvas/Documents": typeof canvas_Documents;
  "canvas/ElementLifecycles": typeof canvas_ElementLifecycles;
  "canvas/GeometryHistory": typeof canvas_GeometryHistory;
  "canvas/Handlers": typeof canvas_Handlers;
  "canvas/History": typeof canvas_History;
  "canvas/HistoryCredentials": typeof canvas_HistoryCredentials;
  "canvas/HistoryModel": typeof canvas_HistoryModel;
  "canvas/HistoryPersistence": typeof canvas_HistoryPersistence;
  "canvas/Images": typeof canvas_Images;
  "canvas/LegacyDocuments": typeof canvas_LegacyDocuments;
  "canvas/Model": typeof canvas_Model;
  "canvas/UrlImportAccess": typeof canvas_UrlImportAccess;
  "canvas/UrlImportPolicy": typeof canvas_UrlImportPolicy;
  "documents/Access": typeof documents_Access;
  "documents/Authors": typeof documents_Authors;
  "documents/Authorship": typeof documents_Authorship;
  "documents/ChildText": typeof documents_ChildText;
  "documents/Paragraphs": typeof documents_Paragraphs;
  "documents/Persistence": typeof documents_Persistence;
  "documents/Sync": typeof documents_Sync;
  http: typeof http;
  "inbox/AgentMail": typeof inbox_AgentMail;
  "inbox/Drafts": typeof inbox_Drafts;
  "inbox/Jobs": typeof inbox_Jobs;
  "inbox/Model": typeof inbox_Model;
  "inbox/Provisioning": typeof inbox_Provisioning;
  "inbox/Reconciliation": typeof inbox_Reconciliation;
  "inbox/Sends": typeof inbox_Sends;
  "integrations/Http": typeof integrations_Http;
  "presence/Access": typeof presence_Access;
  "presence/Agents": typeof presence_Agents;
  "presence/Handlers": typeof presence_Handlers;
  "presence/Model": typeof presence_Model;
  "sources/Firecrawl": typeof sources_Firecrawl;
  "sources/Jobs": typeof sources_Jobs;
  "sources/Model": typeof sources_Model;
  "sources/Persistence": typeof sources_Persistence;
  "sources/Screenshot": typeof sources_Screenshot;
  "workspaces/Access": typeof workspaces_Access;
  "workspaces/Handlers": typeof workspaces_Handlers;
  "workspaces/Provisioning": typeof workspaces_Provisioning;
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

import { mcp } from "./agentAccess/Mcp";
import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { components } from "./_generated/api";

const http = httpRouter();
auth.addHttpRoutes(http);
http.route({ path: "/mcp", method: "POST", handler: mcp });
http.route({ path: "/mcp", method: "GET", handler: mcp });
registerStaticRoutes(http, components.staticHosting);

export default http;

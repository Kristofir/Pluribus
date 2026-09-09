import { useConvexConnectionState, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export default function App() {
  const health = useQuery(api.Health.check);
  const connection = useConvexConnectionState();
  const connected = connection.isWebSocketConnected && health?.status === "ok";

  return (
    <main className="scaffold">
      <Card>
        <CardHeader>
          <h1>Project scaffold</h1>
          <p>React + Vite + TypeScript + Intent UI</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p role="status">
            <Badge intent={connected ? "success" : "secondary"}>
              Convex: {connected ? "connected" : "connecting…"}
            </Badge>
          </p>
          <p className="text-muted-fg">
            Framework only. No product features yet.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

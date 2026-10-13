import { createFileRoute } from "@tanstack/react-router";

async function handleAuthRequest(request: Request) {
  try {
    const { getAuth } = await import("@/lib/auth-server");
    return await getAuth().handler(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Never leak stack traces or internal URLs to the client.
    console.error(
      JSON.stringify({
        event: "auth.route_failed",
        message,
        url: request.url,
      }),
    );

    return Response.json({ message: "Authentication failed" }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => handleAuthRequest(request),
      POST: async ({ request }) => handleAuthRequest(request),
    },
  },
});

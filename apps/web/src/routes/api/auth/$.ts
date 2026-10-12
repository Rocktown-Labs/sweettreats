import { createFileRoute } from "@tanstack/react-router";

const DEBUG_HEADER = "x-sweettreats-auth-debug";

async function handleAuthRequest(request: Request) {
  try {
    const { getAuth } = await import("@/lib/auth-server");
    return await getAuth().handler(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error(
      JSON.stringify({
        event: "auth.route_failed",
        message,
        stack,
        url: request.url,
      }),
    );

    if (request.headers.get(DEBUG_HEADER) === "1") {
      return Response.json({ message, stack }, { status: 500 });
    }

    throw error;
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

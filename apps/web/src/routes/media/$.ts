import { env } from "@sweettreats/env/server";
import { createFileRoute } from "@tanstack/react-router";

type MediaObject = {
  body: BodyInit | null;
  httpEtag: string;
  writeHttpMetadata: (headers: Headers) => void;
};

type MediaBucket = {
  get: (key: string) => Promise<MediaObject | null>;
};

export async function handleMediaGet({
  media = env.MEDIA,
  request,
  splat,
}: {
  media?: MediaBucket | null;
  request: Request;
  splat: string;
}) {
  const redirectTo = (path: string) => {
    // Only ever redirect within this origin. A splat that starts with a
    // second slash (`/media//evil.example`) would otherwise become a
    // protocol-relative redirect when the media binding is absent.
    const target = new URL(path, request.url);
    const origin = new URL(request.url).origin;
    return Response.redirect(
      target.origin === origin ? target : new URL("/cookie-placeholder.svg", request.url),
      302,
    );
  };

  if (!media) {
    return redirectTo(`/${splat}`);
  }

  const object = await media.get(splat);
  if (!object) {
    return redirectTo(splat.startsWith("products/") ? `/${splat}` : "/cookie-placeholder.svg");
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  // Defense in depth for uploaded content: never let a stored object run
  // as a document or script, even if a hostile content type slipped through.
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", "default-src 'none'; sandbox");

  return new Response(object.body, { headers });
}

export const Route = createFileRoute("/media/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        return handleMediaGet({ request, splat: params._splat || "" });
      },
    },
  },
});

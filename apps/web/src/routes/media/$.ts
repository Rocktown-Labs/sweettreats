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
  const redirectTo = (path: string) => Response.redirect(new URL(path, request.url), 302);

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

  return new Response(object.body, { headers });
}

export const Route = createFileRoute("/media/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        return handleMediaGet({ request, splat: params._splat });
      },
    },
  },
});

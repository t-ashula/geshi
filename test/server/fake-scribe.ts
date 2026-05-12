import { serve } from "@hono/node-server";
import { Hono } from "hono";

const scribePort = Number(process.env.E2E_SCRIBE_PORT ?? "58001");
const app = new Hono();

type FakeScribeRequest = {
  pollCount: number;
  text: string;
};

const requests = new Map<string, FakeScribeRequest>();

app.get("/docs", () => {
  return new Response("fake scribe");
});

app.post("/transcribe", async (context) => {
  const formData = await context.req.formData();
  const file = formData.get("file");
  const language = formData.get("language");
  const model = formData.get("model");

  if (
    !(file instanceof File) ||
    typeof language !== "string" ||
    typeof model !== "string"
  ) {
    return context.json(
      {
        error: "invalid request",
      },
      400,
    );
  }

  const requestId = crypto.randomUUID();

  requests.set(requestId, {
    pollCount: 0,
    text: [
      "fake scribe transcript chunk",
      `language=${language}`,
      `model=${model}`,
      `file=${file.name}`,
    ].join(" "),
  });

  return context.json({
    request_id: requestId,
  });
});

app.get("/transcribe/:requestId", (context) => {
  const requestId = context.req.param("requestId");
  const request = requests.get(requestId);

  if (request === undefined) {
    return context.json(
      {
        error: "request not found",
        status: "error",
      },
      404,
    );
  }

  request.pollCount += 1;

  if (request.pollCount === 1) {
    return context.json({
      status: "pending",
    });
  }

  if (request.pollCount === 2) {
    return context.json({
      status: "working",
    });
  }

  return context.json({
    status: "done",
    text: request.text,
  });
});

serve({
  fetch: app.fetch,
  port: scribePort,
});

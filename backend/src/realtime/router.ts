import { Response, Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAdminAuth } from "../middleware/auth";
import { GroceryEventPayload, realtimeBus } from "./events";

const realtimeRouter = Router();

const parsePlanId = (rawValue: string | undefined) => {
  if (!rawValue) {
    return null;
  }

  const parsedValue = Number(rawValue);
  return Number.isNaN(parsedValue) ? null : parsedValue;
};


const resolvePlanDayIds = async (planOrPlanDayId: number) => {
  const plan = await prisma.plan.findUnique({
    where: { id: planOrPlanDayId },
    select: { days: { select: { id: true }, orderBy: { date: "asc" } } }
  });

  if (plan?.days.length) {
    return plan.days.map((day) => day.id);
  }

  const planDay = await prisma.planDay.findUnique({
    where: { id: planOrPlanDayId },
    select: { id: true }
  });

  return planDay ? [planDay.id] : null;
};

const parseShareToken = (rawValue: string | undefined) => {
  if (!rawValue) {
    return null;
  }

  const decodedValue = decodeURIComponent(rawValue).trim();
  const tokenMatch = decodedValue.match(/[a-f0-9]{64}/i);

  return tokenMatch?.[0]?.toLowerCase() ?? null;
};

const writeSseEvent = (response: Response, payload: GroceryEventPayload) => {
  response.write(`event: ${payload.eventType}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
};

// Server-sent events only work if nothing between here and the browser holds
// the response back. Reverse proxies in the nginx family buffer proxied
// responses by default, which stalls the stream until the buffer fills, so the
// browser never sees an open connection; `X-Accel-Buffering: no` opts out.
// Idle connections are the other way a proxy kills a stream, so the keepalive
// comment is sent well inside the usual 30-60 second idle timeouts.
const sseKeepAliveIntervalMs = 15000;

const startSseStream = (response: Response) => {
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");
  response.flushHeaders();

  response.write(": connected\n\n");

  return setInterval(() => {
    response.write(": ping\n\n");
  }, sseKeepAliveIntervalMs);
};

realtimeRouter.get("/api/realtime/grocery/admin", requireAdminAuth, async (request, response) => {
  const planId = parsePlanId(request.query.planId as string | undefined);

  if (!planId) {
    response.status(400).json({ message: "planId query parameter is required." });
    return;
  }

  const planDayIds = await resolvePlanDayIds(planId);

  if (!planDayIds) {
    response.status(404).json({ message: "Plan not found." });
    return;
  }

  const pingInterval = startSseStream(response);

  const unsubscribe = realtimeBus.subscribe((payload) => {
    if (!planDayIds.includes(payload.planId)) {
      return;
    }

    writeSseEvent(response, payload);
  });

  request.on("close", () => {
    clearInterval(pingInterval);
    unsubscribe();
    response.end();
  });
});

realtimeRouter.get("/api/realtime/grocery/shared/:token", async (request, response) => {
  const token = parseShareToken(request.params.token);

  if (!token) {
    response.status(404).json({ message: "Shared grocery list not found." });
    return;
  }

  const sharedPlan = await prisma.groceryShareToken.findUnique({
    where: { token },
    select: { token: true }
  });

  if (!sharedPlan) {
    response.status(404).json({ message: "Shared grocery list not found." });
    return;
  }

  const pingInterval = startSseStream(response);

  const unsubscribe = realtimeBus.subscribe((payload) => {
    if (payload.token !== token) {
      return;
    }

    writeSseEvent(response, payload);
  });

  request.on("close", () => {
    clearInterval(pingInterval);
    unsubscribe();
    response.end();
  });
});

export default realtimeRouter;

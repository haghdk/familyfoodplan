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


const resolvePlanDayId = async (planOrPlanDayId: number) => {
  const plan = await prisma.plan.findUnique({
    where: { id: planOrPlanDayId },
    select: { days: { select: { id: true }, orderBy: { date: "asc" }, take: 1 } }
  });

  if (plan?.days[0]) {
    return plan.days[0].id;
  }

  const planDay = await prisma.planDay.findUnique({
    where: { id: planOrPlanDayId },
    select: { id: true }
  });

  return planDay?.id ?? null;
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

realtimeRouter.get("/api/realtime/grocery/admin", requireAdminAuth, async (request, response) => {
  const planId = parsePlanId(request.query.planId as string | undefined);

  if (!planId) {
    response.status(400).json({ message: "planId query parameter is required." });
    return;
  }

  const planDayId = await resolvePlanDayId(planId);

  if (!planDayId) {
    response.status(404).json({ message: "Plan not found." });
    return;
  }

  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders();

  response.write(": connected\n\n");

  const unsubscribe = realtimeBus.subscribe((payload) => {
    if (payload.planId !== planDayId) {
      return;
    }

    writeSseEvent(response, payload);
  });

  const pingInterval = setInterval(() => {
    response.write(": ping\n\n");
  }, 30000);

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

  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders();

  response.write(": connected\n\n");

  const unsubscribe = realtimeBus.subscribe((payload) => {
    if (payload.token !== token) {
      return;
    }

    writeSseEvent(response, payload);
  });

  const pingInterval = setInterval(() => {
    response.write(": ping\n\n");
  }, 30000);

  request.on("close", () => {
    clearInterval(pingInterval);
    unsubscribe();
    response.end();
  });
});

export default realtimeRouter;

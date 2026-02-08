import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAdminAuth } from "../middleware/auth";
import { parseIsoDayKey } from "../services/plans";

const planDaysRouter = Router();

planDaysRouter.use(requireAdminAuth);

const DEFAULT_PLAN_NAME = "Legacy Plan";


const getDefaultPlan = async () =>
  prisma.plan.upsert({
    where: { name: DEFAULT_PLAN_NAME },
    update: {},
    create: { name: DEFAULT_PLAN_NAME }
  });

const findOrCreatePlanDay = async (dayDate: Date) => {
  const plan = await getDefaultPlan();

  return prisma.planDay.upsert({
    where: {
      planId_date: {
        planId: plan.id,
        date: dayDate
      }
    },
    update: {},
    create: {
      planId: plan.id,
      date: dayDate
    }
  });
};

planDaysRouter.put("/api/plan-days/:dayKey/dinner", async (request, response) => {
  const dayDate = parseIsoDayKey(request.params.dayKey);

  if (!dayDate) {
    response.status(400).json({ message: "Invalid day key. Expected YYYY-MM-DD." });
    return;
  }

  const { name, notes } = request.body as { name?: string; notes?: string };
  const normalizedName = name?.trim();

  if (!normalizedName) {
    response.status(400).json({ message: "Dinner name is required." });
    return;
  }

  const planDay = await findOrCreatePlanDay(dayDate);

  const dinnerDish = await prisma.dinnerDish.upsert({
    where: { planDayId: planDay.id },
    update: {
      name: normalizedName,
      notes: notes?.trim() || null
    },
    create: {
      name: normalizedName,
      notes: notes?.trim() || null,
      planDayId: planDay.id
    }
  });

  response.status(200).json({ dinnerDish });
});

planDaysRouter.post("/api/plan-days/:dayKey/lunches", async (request, response) => {
  const dayDate = parseIsoDayKey(request.params.dayKey);

  if (!dayDate) {
    response.status(400).json({ message: "Invalid day key. Expected YYYY-MM-DD." });
    return;
  }

  const { name, notes, familyMemberId } = request.body as {
    name?: string;
    notes?: string;
    familyMemberId?: number | null;
  };
  const normalizedName = name?.trim();

  if (!normalizedName) {
    response.status(400).json({ message: "Lunch name is required." });
    return;
  }

  if (typeof familyMemberId === "number") {
    const familyMember = await prisma.familyMember.findUnique({
      where: { id: familyMemberId },
      select: { id: true }
    });

    if (!familyMember) {
      response.status(400).json({ message: "Selected member does not exist." });
      return;
    }
  }

  const planDay = await findOrCreatePlanDay(dayDate);

  const lunchDish = await prisma.lunchDish.create({
    data: {
      name: normalizedName,
      notes: notes?.trim() || null,
      familyMemberId: typeof familyMemberId === "number" ? familyMemberId : null,
      planDayId: planDay.id
    }
  });

  response.status(201).json({ lunchDish });
});

planDaysRouter.put(
  "/api/plan-days/:dayKey/lunches/:lunchId",
  async (request, response) => {
    const dayDate = parseIsoDayKey(request.params.dayKey);
    const lunchId = Number(request.params.lunchId);

    if (!dayDate) {
      response.status(400).json({ message: "Invalid day key. Expected YYYY-MM-DD." });
      return;
    }

    if (Number.isNaN(lunchId)) {
      response.status(400).json({ message: "Invalid lunch id." });
      return;
    }

    const { name, notes, familyMemberId } = request.body as {
      name?: string;
      notes?: string;
      familyMemberId?: number | null;
    };
    const normalizedName = name?.trim();

    if (!normalizedName) {
      response.status(400).json({ message: "Lunch name is required." });
      return;
    }

    if (typeof familyMemberId === "number") {
      const familyMember = await prisma.familyMember.findUnique({
        where: { id: familyMemberId },
        select: { id: true }
      });

      if (!familyMember) {
        response.status(400).json({ message: "Selected member does not exist." });
        return;
      }
    }

    const existingLunch = await prisma.lunchDish.findUnique({
      where: { id: lunchId },
      include: {
        planDay: {
          select: { date: true }
        }
      }
    });

    if (!existingLunch || existingLunch.planDay.date.getTime() !== dayDate.getTime()) {
      response.status(404).json({ message: "Lunch dish not found for this day." });
      return;
    }

    const lunchDish = await prisma.lunchDish.update({
      where: { id: lunchId },
      data: {
        name: normalizedName,
        notes: notes?.trim() || null,
        familyMemberId: typeof familyMemberId === "number" ? familyMemberId : null
      }
    });

    response.status(200).json({ lunchDish });
  }
);

planDaysRouter.delete(
  "/api/plan-days/:dayKey/lunches/:lunchId",
  async (request, response) => {
    const dayDate = parseIsoDayKey(request.params.dayKey);
    const lunchId = Number(request.params.lunchId);

    if (!dayDate) {
      response.status(400).json({ message: "Invalid day key. Expected YYYY-MM-DD." });
      return;
    }

    if (Number.isNaN(lunchId)) {
      response.status(400).json({ message: "Invalid lunch id." });
      return;
    }

    const existingLunch = await prisma.lunchDish.findUnique({
      where: { id: lunchId },
      include: {
        planDay: {
          select: { date: true }
        }
      }
    });

    if (!existingLunch || existingLunch.planDay.date.getTime() !== dayDate.getTime()) {
      response.status(404).json({ message: "Lunch dish not found for this day." });
      return;
    }

    await prisma.lunchDish.delete({ where: { id: lunchId } });

    response.status(204).send();
  }
);

export default planDaysRouter;

import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAdminAuth } from "../middleware/auth";

const membersRouter = Router();

// The admin guard is attached per route rather than with a path-less
// `router.use(...)`. Every router here is mounted at the application root, so a
// path-less guard runs on *every* request that reaches this router — including
// requests meant for routers registered after it, which it then rejects before
// they are ever seen. That is what once made the whole API admin-only for
// viewers. Per-route guards cannot leak onto another router's paths.

membersRouter.get("/api/members", requireAdminAuth, async (_request, response) => {
  const members = await prisma.familyMember.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }]
  });

  response.status(200).json({ members });
});

membersRouter.post("/api/members", requireAdminAuth, async (request, response) => {
  const { name } = request.body as { name?: string };
  const normalizedName = name?.trim();

  if (!normalizedName) {
    response.status(400).json({ message: "Name is required" });
    return;
  }

  const member = await prisma.familyMember.create({
    data: {
      name: normalizedName,
      isActive: true
    }
  });

  response.status(201).json({ member });
});

membersRouter.put("/api/members/:id", requireAdminAuth, async (request, response) => {
  const memberId = Number(request.params.id);

  if (Number.isNaN(memberId)) {
    response.status(400).json({ message: "Invalid member id" });
    return;
  }

  const { name, isActive } = request.body as { name?: string; isActive?: boolean };
  const hasName = typeof name === "string";
  const normalizedName = hasName ? name.trim() : undefined;

  if (hasName && !normalizedName) {
    response.status(400).json({ message: "Name cannot be empty" });
    return;
  }

  const member = await prisma.familyMember.update({
    where: { id: memberId },
    data: {
      ...(normalizedName ? { name: normalizedName } : {}),
      ...(typeof isActive === "boolean" ? { isActive } : {})
    }
  }).catch(() => null);

  if (!member) {
    response.status(404).json({ message: "Member not found" });
    return;
  }

  response.status(200).json({ member });
});

membersRouter.patch("/api/members/:id/archive", requireAdminAuth, async (request, response) => {
  const memberId = Number(request.params.id);

  if (Number.isNaN(memberId)) {
    response.status(400).json({ message: "Invalid member id" });
    return;
  }

  const member = await prisma.familyMember.update({
    where: { id: memberId },
    data: { isActive: false }
  }).catch(() => null);

  if (!member) {
    response.status(404).json({ message: "Member not found" });
    return;
  }

  response.status(200).json({ member });
});

export default membersRouter;

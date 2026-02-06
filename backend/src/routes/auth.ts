import { Router } from "express";
import { createSessionToken, sessionMaxAgeSeconds } from "../auth/session";
import { validateAdminLogin } from "../auth/login";
import { requireAdminAuth } from "../middleware/auth";

const authRouter = Router();

authRouter.post("/api/auth/login", async (request, response) => {
  const { email, password } = request.body as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    response.status(400).json({ message: "Email and password are required" });
    return;
  }

  const adminUser = await validateAdminLogin({ email, password });

  if (!adminUser) {
    response.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const token = createSessionToken(adminUser);

  response.setHeader(
    "Set-Cookie",
    `admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds}`
  );

  response.status(200).json({
    token,
    user: {
      id: adminUser.id,
      email: adminUser.email
    }
  });
});

authRouter.post("/api/auth/logout", (_request, response) => {
  response.setHeader(
    "Set-Cookie",
    "admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
  );
  response.status(200).json({ success: true });
});

authRouter.get("/api/auth/me", requireAdminAuth, (_request, response) => {
  response.status(200).json({ user: response.locals.adminUser });
});

export default authRouter;

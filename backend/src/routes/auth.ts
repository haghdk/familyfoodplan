import { Router } from "express";
import { createSessionToken, sessionMaxAgeSeconds } from "../auth/session";
import { validateUserLogin } from "../auth/login";
import { requireAuth } from "../middleware/auth";

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

  const user = await validateUserLogin({ email, password });

  if (!user) {
    response.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const token = createSessionToken(user);

  response.setHeader(
    "Set-Cookie",
    `admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds}`
  );

  response.status(200).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role
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

authRouter.get("/api/auth/me", requireAuth, (_request, response) => {
  response.status(200).json({ user: response.locals.user });
});

export default authRouter;

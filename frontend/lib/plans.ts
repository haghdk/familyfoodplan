import { backendApiUrl } from "./auth";

export const setPlanAsCurrent = async (planId: number) => {
  const response = await fetch(`${backendApiUrl}/api/plans/${planId}/set-current`, {
    method: "POST",
    credentials: "include"
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message ?? "Could not set this as the current plan right now.");
  }

  return response.json() as Promise<{ message: string; planId: number }>;
};

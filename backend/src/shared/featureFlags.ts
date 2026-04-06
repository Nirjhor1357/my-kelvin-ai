import { prisma } from "../lib/prisma.js";
import { env } from "./env.js";

function parseEnvFlags(value: string): Set<string> {
  return new Set(
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

const envEnabledFlags = parseEnvFlags(env.FEATURE_FLAGS);

export async function isFeatureEnabled(key: string, userId?: string): Promise<boolean> {
  if (envEnabledFlags.has(key)) {
    return true;
  }

  const where = userId
    ? {
        OR: [
          { key, userId },
          { key, userId: null }
        ]
      }
    : {
        OR: [{ key, userId: null }]
      };

  const flags = await prisma.featureFlag.findMany({ where });
  if (!flags.length) {
    return false;
  }

  // User-specific flag takes precedence when available.
  const userScoped = userId ? flags.find((flag) => flag.userId === userId) : undefined;
  if (userScoped) {
    return userScoped.enabled;
  }

  return flags.some((flag) => flag.enabled);
}

export async function listFeatureFlags(userId?: string): Promise<Array<{ key: string; enabled: boolean; userId: string | null }>> {
  const dbFlags = await prisma.featureFlag.findMany({
    where: userId
      ? {
          OR: [{ userId }, { userId: null }]
        }
      : undefined,
    orderBy: [{ key: "asc" }]
  });

  const envFlags = [...envEnabledFlags].map((key) => ({ key, enabled: true, userId: null as string | null }));

  const merged = new Map<string, { key: string; enabled: boolean; userId: string | null }>();
  for (const item of dbFlags) {
    merged.set(`${item.key}:${item.userId ?? "global"}`, {
      key: item.key,
      enabled: item.enabled,
      userId: item.userId
    });
  }

  for (const item of envFlags) {
    merged.set(`${item.key}:global`, item);
  }

  return [...merged.values()];
}

export async function setFeatureFlag(input: { key: string; enabled: boolean; userId?: string }): Promise<void> {
  if (input.userId) {
    await prisma.featureFlag.upsert({
      where: {
        userId_key: {
          userId: input.userId,
          key: input.key
        }
      },
      create: {
        key: input.key,
        enabled: input.enabled,
        userId: input.userId
      },
      update: {
        enabled: input.enabled
      }
    });
    return;
  }

  const existingGlobal = await prisma.featureFlag.findFirst({ where: { key: input.key, userId: null } });
  if (existingGlobal) {
    await prisma.featureFlag.update({
      where: { id: existingGlobal.id },
      data: { enabled: input.enabled }
    });
    return;
  }

  await prisma.featureFlag.create({
    data: {
      key: input.key,
      enabled: input.enabled,
      userId: null
    }
  });
}

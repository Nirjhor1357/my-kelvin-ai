import { prisma } from "../../lib/prisma.js";
import { UserProfile } from "./user.model.js";

function mapUser(user: { id: string; email: string; name: string | null; role: string }): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserProfile["role"]
  };
}

export class UserService {
  async getById(userId: string): Promise<UserProfile | null> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return user ? mapUser(user) : null;
  }

  async list(): Promise<UserProfile[]> {
    const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
    return users.map(mapUser);
  }

  async updateProfile(userId: string, input: { name?: string; role?: "USER" | "ADMIN" }): Promise<UserProfile> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        role: input.role
      }
    });

    return mapUser(user);
  }
}

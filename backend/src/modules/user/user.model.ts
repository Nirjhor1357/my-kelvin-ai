export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
}

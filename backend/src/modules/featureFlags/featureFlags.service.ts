import { listFeatureFlags, setFeatureFlag } from "../../shared/featureFlags.js";

export class FeatureFlagsService {
  async list(userId?: string) {
    return listFeatureFlags(userId);
  }

  async set(input: { key: string; enabled: boolean; userId?: string }): Promise<void> {
    return setFeatureFlag(input);
  }
}

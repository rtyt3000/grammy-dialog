import type { AppServices } from "./app-types.js";

/** Minimal service implementation used by the showcase bot. */
export const services: AppServices = {
  profiles: {
    async displayName(userId) {
      return `user-${userId}`;
    },
  },
};

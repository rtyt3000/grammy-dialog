import type { AppServices } from "./app-types.js";

export const services: AppServices = {
  profiles: {
    async displayName(userId) {
      return `user-${userId}`;
    },
  },
};

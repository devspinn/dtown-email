import { createAuthClient } from "better-auth/react";

// Get API URL based on environment
const getApiUrl = () => {
  // In production, use the custom domain
  if (import.meta.env.PROD) {
    return "https://api.birthstori.com";
  }
  // In development, proxy through Vite
  return window.location.origin;
};

export const authClient = createAuthClient({
  baseURL: getApiUrl(),
  basePath: "/api/auth",
});

export const { signIn, signUp, signOut, useSession } = authClient;

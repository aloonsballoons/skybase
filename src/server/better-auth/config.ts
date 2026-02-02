import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { env } from "~/env";
import { db } from "~/server/db";

const githubClientId = env.BETTER_AUTH_GITHUB_CLIENT_ID;
const githubClientSecret = env.BETTER_AUTH_GITHUB_CLIENT_SECRET;

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg", // or "pg" or "mysql"
	}),
	emailAndPassword: {
		enabled: true,
	},
	socialProviders:
		githubClientId && githubClientSecret
			? {
					github: {
						clientId: githubClientId,
						clientSecret: githubClientSecret,
						redirectURI: "http://localhost:3000/api/auth/callback/github",
					},
				}
			: undefined,
});

export type Session = typeof auth.$Infer.Session;

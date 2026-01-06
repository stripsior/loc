import { betterAuth } from "better-auth";

export const auth = betterAuth({
    session: {
        cookieCache: {
            enabled: true,
            maxAge: 7 * 24 * 60 * 60,
            strategy: "jwe",
            refreshCache: true,
        },
    },
    account: {
        storeStateStrategy: "cookie",
        storeAccountCookie: true,
    },
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID || "",
            clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
            scope: ["user:email", "read:user", "repo", "read:org"],
        },
    },
});

import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import {
  verifyUserCredentials,
  findOrCreateOAuthUser,
  findUserByEmail,
} from "@/lib/server/user-store"

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const user = await verifyUserCredentials(
            String(credentials.email),
            String(credentials.password)
          );

          if (!user) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          };
        } catch (error) {
          console.error("Auth authorize error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        try {
          const dbUser = await findOrCreateOAuthUser({
            email: user.email,
            name: user.name || null,
            image: user.image || null,
            provider: "google",
          });
          user.id = dbUser.id;
        } catch (error) {
          console.error("Error creating/syncing OAuth user in PostgreSQL:", error);
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      } else if (token.email && !token.id) {
        const dbUser = await findUserByEmail(token.email);
        if (dbUser) {
          token.id = dbUser.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.id === 'string') {
        session.user.id = token.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
})

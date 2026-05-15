import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

// Edge-safe slice of the NextAuth config. Used by middleware.ts, which runs
// on the Edge runtime and cannot import `@vercel/postgres` or `bcryptjs`.
// The full config in lib/auth.ts adds the Credentials provider and the
// DB-touching signIn callback on top of this.

export default {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
    newUser: '/onboarding',
  },
  callbacks: {
    // Carry the user id through the JWT so server components / API routes can
    // read it without hitting the DB. The Credentials provider's `authorize`
    // and the Google signIn callback both set `user.id` to the DB row id.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

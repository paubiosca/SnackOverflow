import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { compare, hash } from 'bcryptjs';
import { sql } from '@vercel/postgres';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        try {
          const result = await sql`
            SELECT id, email, password_hash, name, image
            FROM users WHERE email = ${email}
          `;

          const user = result.rows[0];
          if (!user || !user.password_hash) {
            return null;
          }

          const isValid = await compare(password, user.password_hash);
          if (!isValid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        try {
          // Check if user exists
          const existingUser = await sql`
            SELECT id FROM users WHERE email = ${user.email}
          `;

          if (existingUser.rows.length === 0) {
            // Create new user for OAuth
            const newUser = await sql`
              INSERT INTO users (email, name, image)
              VALUES (${user.email}, ${user.name}, ${user.image})
              RETURNING id
            `;
            user.id = newUser.rows[0].id;
          } else {
            user.id = existingUser.rows[0].id;
          }

          // Link account if not exists
          const existingAccount = await sql`
            SELECT id FROM accounts
            WHERE provider = ${account.provider}
            AND provider_account_id = ${account.providerAccountId}
          `;

          if (existingAccount.rows.length === 0) {
            await sql`
              INSERT INTO accounts (
                user_id, type, provider, provider_account_id,
                access_token, refresh_token, expires_at, token_type, scope, id_token
              ) VALUES (
                ${user.id}, ${account.type}, ${account.provider}, ${account.providerAccountId},
                ${account.access_token}, ${account.refresh_token}, ${account.expires_at},
                ${account.token_type}, ${account.scope}, ${account.id_token}
              )
            `;
          }
        } catch (error) {
          console.error('Error in signIn callback:', error);
          return false;
        }
      }
      return true;
    },
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
  pages: {
    signIn: '/login',
    newUser: '/onboarding',
  },
  session: {
    strategy: 'jwt',
  },
});

// Helper function to register a new user
export async function registerUser(email: string, password: string, name?: string) {
  // Check if user exists
  const existingUser = await sql`
    SELECT id FROM users WHERE email = ${email}
  `;

  if (existingUser.rows.length > 0) {
    throw new Error('User already exists');
  }

  // Hash password and create user
  const passwordHash = await hash(password, 12);
  const result = await sql`
    INSERT INTO users (email, password_hash, name)
    VALUES (${email}, ${passwordHash}, ${name || null})
    RETURNING id, email, name
  `;

  return result.rows[0];
}

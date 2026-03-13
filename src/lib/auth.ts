import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import InstagramProvider from "next-auth/providers/instagram";
import { prisma } from "./db";

if (process.env.VERCEL) {
  process.env.AUTH_URL = "https://cmagic-posts.vercel.app";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  providers: [
    InstagramProvider({
      clientId: process.env.INSTAGRAM_CLIENT_ID as string,
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET as string,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});

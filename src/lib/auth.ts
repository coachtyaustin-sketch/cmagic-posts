import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import FacebookProvider from "next-auth/providers/facebook";
import { prisma } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  providers: [
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID as string,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET as string,
      authorization: {
        params: {
          scope: "email public_profile instagram_basic instagram_manage_insights pages_show_list",
        },
      },
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

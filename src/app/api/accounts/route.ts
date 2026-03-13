import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { InstagramGraphAPI } from "@/lib/instagram";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Retrieve the user's Facebook OAuth token from the database
    const facebookAccount = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "facebook",
      },
    });

    if (!facebookAccount || !facebookAccount.access_token) {
      return NextResponse.json({ error: "No Facebook Access Token found for this user. Please log in again." }, { status: 400 });
    }

    const igApi = new InstagramGraphAPI(facebookAccount.access_token);
    
    // Fetch linked accounts from Meta
    const linkedAccounts = await igApi.getLinkedInstagramAccounts();

    if (!linkedAccounts || linkedAccounts.length === 0) {
        return NextResponse.json({ error: "No linked Professional Instagram accounts found." }, { status: 404 });
    }
    
    // Upsert each returned account into our IgAccount table for persistence
    const upsertedAccounts = await Promise.all(
        linkedAccounts.map(async (account: any) => {
            return await prisma.igAccount.upsert({
                where: { igUserId: account.igAccountId },
                update: {
                    username: account.username,
                    profilePicUrl: account.profilePic,
                    followers: account.followers,
                    follows: account.follows,
                    mediaCount: account.mediaCount,
                    pageId: account.pageId,
                    accessToken: facebookAccount.access_token!, // Storing the token to allow background syncing
                    updatedAt: new Date(),
                },
                create: {
                    userId: session.user?.id as string,
                    igUserId: account.igAccountId,
                    username: account.username,
                    profilePicUrl: account.profilePic,
                    followers: account.followers,
                    follows: account.follows,
                    mediaCount: account.mediaCount,
                    pageId: account.pageId,
                    accessToken: facebookAccount.access_token!, 
                }
            });
        })
    );

    return NextResponse.json({ 
        success: true, 
        accounts: upsertedAccounts 
    });

  } catch (error: any) {
    console.error("Accounts API Error:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch linked Instagram accounts." },
      { status: 500 }
    );
  }
}

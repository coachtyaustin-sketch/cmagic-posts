import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { InstagramGraphAPI } from "@/lib/instagram";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Since Meta Login hasn't successfully stored the token in Prisma yet due to the DB issue,
    // we will inject the user's provided token directly from the ENV for this prototype sync API
    const userAccessToken = process.env.FACEBOOK_ACCESS_TOKEN;

    if (!userAccessToken) {
      return NextResponse.json({ error: "No Facebook Access Token available in environment." }, { status: 400 });
    }

    const igApi = new InstagramGraphAPI(userAccessToken);
    
    // 1. Fetch linked accounts
    const linkedAccounts = await igApi.getLinkedInstagramAccounts();

    if (!linkedAccounts || linkedAccounts.length === 0) {
        return NextResponse.json({ error: "No linked Professional Instagram accounts found." }, { status: 404 });
    }
    
    // We'll process the first linked account for demonstration
    const activeAccount = linkedAccounts[0];
    
    // 2. Fetch the 10 most recent media posts
    const recentMedia = await igApi.getRecentMedia(activeAccount.igAccountId, 10);
    
    // 3. For each media post, fetch deep insights
    const enrichedMedia = [];
    
    for (const post of recentMedia) {
        // Skip Stories or Albums if needed, but the Graph API supports Insights on IMAGE/VIDEO/CAROUSEL_ALBUM
        const insights = await igApi.getMediaInsights(post.id, post.media_type);
        
        enrichedMedia.push({
            id: post.id,
            type: post.media_type,
            caption: post.caption,
            url: post.permalink,
            timestamp: post.timestamp,
            metrics: insights
        });
        
        // Sleep briefly to respect Meta's BUC rate limits (200 calls/hr)
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    return NextResponse.json({ 
        success: true, 
        account: activeAccount,
        data: enrichedMedia 
    });

  } catch (error: any) {
    console.error("Sync API Error:", error.message);
    return NextResponse.json(
      { error: "Failed to sync data from Instagram." },
      { status: 500 }
    );
  }
}

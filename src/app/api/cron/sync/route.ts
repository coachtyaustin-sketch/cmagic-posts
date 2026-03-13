import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { InstagramGraphAPI } from "@/lib/instagram";

// Vercel Cron Jobs send a securely signed authorization header
const VERIFY_CRON = process.env.CRON_SECRET;

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    
    // In local development, we can bypass this by not sending a header, but in production Vercel enforces it.
    if (VERIFY_CRON && authHeader !== `Bearer ${VERIFY_CRON}` && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized cron execution" }, { status: 401 });
    }

    console.log("Starting Daily Cron Sync for all IG Accounts...");

    // Find all IG accounts we've seen before
    const accounts = await prisma.igAccount.findMany({
        where: {
            accessToken: { not: "" }
        }
    });

    let totalSynced = 0;
    const errors = [];

    // Process sequentially to be gentle on DB and Meta rate limits
    for (const account of accounts) {
        try {
            if (!account.accessToken) continue;

            const igApi = new InstagramGraphAPI(account.accessToken);
            
            // 2. Fetch the 10 most recent media posts for this specific account
            const recentMedia = await igApi.getRecentMedia(account.igUserId, 10);
            
            for (const post of recentMedia) {
                const insights: any = await igApi.getMediaInsights(post.id, post.media_type);
                
                let viralityQuotient = null;
                let discoverabilityIndex = null;
                
                if (insights.reach && insights.reach.total > 0) {
                    viralityQuotient = (insights.reach.nonFollower / insights.reach.total) * 100;
                    discoverabilityIndex = (insights.shares + insights.saved) / insights.reach.total;
                }

                const timestamp = new Date(post.timestamp);

                const savedPost = await prisma.mediaPost.upsert({
                    where: { mediaId: post.id },
                    update: {
                        mediaType: post.media_type,
                        mediaUrl: post.media_url,
                        permalink: post.permalink,
                        caption: post.caption,
                        timestamp: timestamp,
                        updatedAt: new Date()
                    },
                    create: {
                        igAccountId: account.id,
                        mediaId: post.id,
                        mediaType: post.media_type,
                        mediaUrl: post.media_url,
                        permalink: post.permalink,
                        caption: post.caption,
                        timestamp: timestamp,
                    }
                });

                if (!insights.error) {
                    await prisma.mediaInsights.upsert({
                        where: { mediaPostId: savedPost.id },
                        update: {
                            views: insights.views || 0,
                            shares: insights.shares || 0,
                            saved: insights.saved || 0,
                            totalReach: insights.reach?.total || 0,
                            followerReach: insights.reach?.follower || 0,
                            nonFollowerReach: insights.reach?.nonFollower || 0,
                            viralityQuotient: viralityQuotient,
                            discoverabilityIndex: discoverabilityIndex,
                            updatedAt: new Date()
                        },
                        create: {
                            mediaPostId: savedPost.id,
                            views: insights.views || 0,
                            shares: insights.shares || 0,
                            saved: insights.saved || 0,
                            totalReach: insights.reach?.total || 0,
                            followerReach: insights.reach?.follower || 0,
                            nonFollowerReach: insights.reach?.nonFollower || 0,
                            viralityQuotient: viralityQuotient,
                            discoverabilityIndex: discoverabilityIndex
                        }
                    });
                }
                
                // Sleep briefly to respect Meta's BUC rate limits (200 calls/hr per token)
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            totalSynced++;
        } catch (err: any) {
            console.error(`Error syncing account ${account.igUserId}:`, err.message);
            errors.push({ account: account.igUserId, error: err.message });
        }
    }

    return NextResponse.json({ 
        success: true, 
        message: `Cron sync completed. Synced ${totalSynced} accounts.`,
        errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error("Cron API Error:", error.message);
    return NextResponse.json(
      { error: "Cron job failed to execute completely." },
      { status: 500 }
    );
  }
}

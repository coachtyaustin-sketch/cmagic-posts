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

    const body = await req.json();
    const { igAccountId } = body;

    if (!igAccountId) {
        return NextResponse.json({ error: "Missing igAccountId parameter." }, { status: 400 });
    }

    // 1. Fetch the specific account to get its stored access token
    const igAccount = await prisma.igAccount.findUnique({
        where: { igUserId: igAccountId, userId: session.user.id }
    });

    if (!igAccount || !igAccount.accessToken) {
        return NextResponse.json({ error: "Linked account not found or token expired." }, { status: 404 });
    }

    const igApi = new InstagramGraphAPI(igAccount.accessToken);
    
    // 2. Fetch the 10 most recent media posts from Graph API
    const recentMedia = await igApi.getRecentMedia(igAccountId, 10);
    
    // 3. For each media post, fetch deep insights and Upsert into DB
    const enrichedMedia = [];
    
    for (const post of recentMedia) {
        // Skip Stories or Albums if needed, but the Graph API supports Insights on IMAGE/VIDEO/CAROUSEL_ALBUM
        const insights: any = await igApi.getMediaInsights(post.id, post.media_type);
        
        let viralityQuotient = null;
        let discoverabilityIndex = null;
        
        // Calculate basic derived metrics
        if (insights.reach && insights.reach.total > 0) {
            viralityQuotient = (insights.reach.nonFollower / insights.reach.total) * 100;
            // Simple discoverability heuristic 
            discoverabilityIndex = (insights.shares + insights.saved) / insights.reach.total;
        }

        const timestamp = new Date(post.timestamp);

        // Save Post Metadata
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
                igAccountId: igAccount.id, // Linking to our internal CUID, not the Graph ID
                mediaId: post.id,
                mediaType: post.media_type,
                mediaUrl: post.media_url,
                permalink: post.permalink,
                caption: post.caption,
                timestamp: timestamp,
            }
        });

        // Save Post Insights
        // If there was no error fetching insights
        if (!insights.error) {
            await prisma.mediaInsights.upsert({
                where: { mediaPostId: savedPost.id },
                update: {
                    views: insights.views || 0,
                    comments: 0, // Would need native webhooks or separate call to track comments, defaulting to 0 for MVP
                    likes: 0, 
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
                    comments: 0, 
                    likes: 0, 
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
        
        enrichedMedia.push({
            id: post.id,
            type: post.media_type,
            caption: post.caption,
            url: post.permalink,
            timestamp: post.timestamp,
            metrics: insights,
            dbId: savedPost.id
        });
        
        // Sleep briefly to respect Meta's BUC rate limits (200 calls/hr)
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    return NextResponse.json({ 
        success: true, 
        account: igAccount,
        syncedPosts: enrichedMedia.length
    });

  } catch (error: any) {
    console.error("Sync API Error:", error.message);
    return NextResponse.json(
      { error: "Failed to sync data from Instagram." },
      { status: 500 }
    );
  }
}

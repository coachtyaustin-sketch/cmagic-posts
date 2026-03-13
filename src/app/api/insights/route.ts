import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const igAccountId = searchParams.get("igAccountId");

    if (!igAccountId) {
      return NextResponse.json({ error: "Missing igAccountId parameter" }, { status: 400 });
    }

    // 1. Verify user has access to this DB Account
    const account = await prisma.igAccount.findUnique({
      where: { igUserId: igAccountId, userId: session.user.id }
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found or access denied" }, { status: 404 });
    }

    // 2. Fetch all media posts for this account, including their insights
    const posts = await prisma.mediaPost.findMany({
      where: { igAccountId: account.id },
      orderBy: { timestamp: 'desc' },
      take: 20, // Load up to 20 for the dashboard UI
      include: {
        insights: true,
        aiAnalysis: true 
      }
    });

    // Formatting it to match the existing UI expectations for now
    const formattedData = posts.map(post => ({
        id: post.mediaId, // Meta ID
        type: post.mediaType,
        caption: post.caption,
        url: post.permalink,
        timestamp: post.timestamp,
        metrics: {
             views: post.insights?.views || 0,
             saved: post.insights?.saved || 0,
             shares: post.insights?.shares || 0,
             reach: {
                 total: post.insights?.totalReach || 0,
                 follower: post.insights?.followerReach || 0,
                 nonFollower: post.insights?.nonFollowerReach || 0,
             }
        }
    }));

    return NextResponse.json({
        success: true,
        account: account,
        data: formattedData
    });

  } catch (error: any) {
    console.error("Insights API Error:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch cached insights." },
      { status: 500 }
    );
  }
}

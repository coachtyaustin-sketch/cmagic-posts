import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { orchestrateAnalysis } from "@/lib/agents/orchestrator";

// NOTE: This route can be time-consuming due to the LLM agent loops.
// In production, this should be offloaded to Inngest/BullMQ.
export const maxDuration = 60; // Extend Vercel timeout to 60s for the Agent pipeline

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { posts } = await req.json();

    if (!posts || !Array.isArray(posts)) {
        return NextResponse.json({ error: "Invalid payload. Provide an array of posts." }, { status: 400 });
    }

    console.log(`Starting AI Orchestration Pipeline for ${posts.length} posts...`);
    
    // We limit to analyzing 3 posts at a time to save tokens during prototype
    const topPosts = posts.slice(0, 3);
    
    const analysisResults = await orchestrateAnalysis(topPosts);

    return NextResponse.json({ 
        success: true, 
        data: analysisResults 
    });

  } catch (error: any) {
    console.error("AI Analysis API Error:", error.message);
    return NextResponse.json(
      { error: "Failed to run AI analysis loop." },
      { status: 500 }
    );
  }
}

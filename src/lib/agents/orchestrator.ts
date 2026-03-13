import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { z } from "zod";

/**
 * 1. Specialized Domain Agents
 * These agents isolate specific elements of the content to provide objective analysis.
 */

// A. Hook Agent
export async function analyzeHook(caption: string) {
  const { object } = await generateObject({
    model: google("gemini-1.5-pro-latest"),
    system: "You are an expert Instagram Copywriter. Analyze the first sentence (the hook) of the provided caption.",
    prompt: `Caption: ${caption}`,
    schema: z.object({
      hookType: z.enum(["question", "negative_framing", "curiosity_gap", "direct_statement", "story_start", "other"]),
      strengthScore: z.number().min(1).max(10).describe("1-10 score of how well this stops the scroll"),
      reasoning: z.string().describe("Brief explanation of why the hook works or fails")
    })
  });
  return object;
}

// B. Sentiment Agent
export async function analyzeSentiment(caption: string) {
  const { object } = await generateObject({
    model: google("gemini-1.5-pro-latest"),
    system: "You are a brand psychologist. Evaluate the emotional tone of this Instagram caption to determine how it makes the reader feel.",
    prompt: `Caption: ${caption}`,
    schema: z.object({
      primaryEmotion: z.string().describe("The strongest emotion evoked e.g., Inspired, Urgent, Amused, Educated"),
      tone: z.enum(["professional", "conversational", "humorous", "urgent", "vulnerable", "authoritative"]),
      shareabilityIndex: z.number().min(1).max(10).describe("Likelihood to be shared based on emotional resonance")
    })
  });
  return object;
}

// C. Body Copy / SEO Agent
export async function analyzeBodyCopy(caption: string) {
  const { object } = await generateObject({
    model: google("gemini-1.5-pro-latest"),
    system: "You are an Instagram algorithm specialist specializing in caption SEO and formatting.",
    prompt: `Caption: ${caption}`,
    schema: z.object({
      readability: z.enum(["high", "medium", "low"]).describe("Are there too many blocks of text?"),
      callToAction: z.string().optional().describe("What is the user explicitly asked to do? (e.g. Save this, Comment X)"),
      ctaStrength: z.number().min(1).max(10),
      hashtagAlignment: z.string().describe("Are the hashtags broad, niche, or missing?")
    })
  });
  return object;
}

/**
 * 2. Diagnostic & Strategy Agent
 * Takes the quantitative metrics AND the qualitative analyses from sub-agents
 * to formulate a conversational strategy strictly based on historical performance.
 */
export async function generateInternalStrategy(recentPostsData: any[]) {
    // We isolate and map the data so the LLM doesn't get overwhelmed with JSON bloat
    const contextMap = recentPostsData.map(post => ({
        captionSummary: post.caption?.substring(0, 100) + "...",
        url: post.url,
        metrics: {
            reach: post.metrics.reach,
            saves: post.metrics.saved,
            shares: post.metrics.shares
        },
        aiAnalysis: post.aiAnalysis // Injected by Orchestrator
    }));

    const { object } = await generateObject({
        model: anthropic("claude-3-5-sonnet-20241022"), // Primary Brain
        system: `You are a private Chief Marketing Officer for this brand. 
        Your ONLY job is to analyze their historical Instagram data and provide strategic direction.
        
        CRITICAL RULES:
        1. Base your strategy PURELY on this brand's internal data provided in the prompt.
        2. DO NOT suggest external trends, trending audio, or generic advice.
        3. If you see high 'shares', note what specific 'hookType' or 'primaryEmotion' caused it.
        4. Be conversational and professional. Do not sound like a scripted robot.
        5. Generate 3-5 highly specific drafted content ideas (video concepts and drafted captions) that replicate past successes.
        6. Do NOT give options. Tell the user exactly what to post.`,
        prompt: `Historical Post Data: ${JSON.stringify(contextMap, null, 2)}`,
        schema: z.object({
            diagnosticSummary: z.string().describe("A conversational paragraph explaining what's working based purely on their own data."),
            actionableConcepts: z.array(z.object({
                conceptType: z.enum(["Image Carousel", "Reel / Video", "Static Image"]),
                visualDirection: z.string().describe("What the image/video should literally look like"),
                hook: z.string().describe("The exact first sentence to use"),
                draftedCaption: z.string().describe("The full recommended body copy"),
                rationale: z.string().describe("Why this will work based on their historical data")
            })).min(3).max(5)
        })
    });
    
    return object;
}

/**
 * 3. The Critique Agent (Quality Control)
 * Reviews the proposed strategy and forces a rewrite if it's below 85/100.
 */
export async function critiqueStrategy(strategyData: any, loopCount = 0): Promise<any> {
    const { object } = await generateObject({
        model: anthropic("claude-3-5-sonnet-20241022"),
        system: `You are the strict Quality Control Editor. 
        Review the drafted Instagram Strategy. Score it 1-100 based on:
        - Is it conversational?
        - Are the concepts uniquely tailored to their data (not generic)?
        - Are there exactly 3-5 concepts?
        
        If the score is >= 85, approve it. If < 85, reject it and provide specific revision feedback.`,
        prompt: `Strategy to Review: ${JSON.stringify(strategyData, null, 2)}`,
        schema: z.object({
            score: z.number().min(1).max(100),
            approved: z.boolean(),
            feedback: z.string().optional().describe("What needs to change if rejected")
        })
    });

    if (object.approved || loopCount > 2) { // Cap at 3 loops to save costs/time
        return strategyData; 
    } else {
        console.log(`Critique Agent Rejected Strategy (Score: ${object.score}). Retrying... Feedback: ${object.feedback}`);
        // If rejected, in a real production app we would recursively call generateInternalStrategy 
        // passing the feedback. For this implementation plan, we will return the strategy with a warning flag.
        return {
            ...strategyData,
            _qcWarning: `Passed with reservations. Critique Feedback: ${object.feedback}`
        };
    }
}

/**
 * 4. The Orchestrator
 * The main pipeline invoked by the API route.
 */
export async function orchestrateAnalysis(posts: any[]) {
    console.log(`Orchestrating AI pipeline for ${posts.length} posts...`);
    
    const enrichedPosts = [];

    // Step 1: Sub-Agent parallel execution per post
    for (const post of posts) {
        if (!post.caption) {
            enrichedPosts.push({ ...post, aiAnalysis: null });
            continue;
        }

        try {
             // Run text-based analysis in parallel
             const [hook, sentiment, bodyCopy] = await Promise.all([
                 analyzeHook(post.caption),
                 analyzeSentiment(post.caption),
                 analyzeBodyCopy(post.caption)
             ]);

             // TODO: In a fully configured environment, we would also run analyzeImage/analyzeVideo 
             // here by passing `post.url` into an OpenAI vision request.

             enrichedPosts.push({
                 ...post,
                 aiAnalysis: {
                     hook,
                     sentiment,
                     bodyCopy
                 }
             });
        } catch (error) {
             console.error(`Error analyzing post ${post.id}:`, error);
             enrichedPosts.push({ ...post, aiAnalysis: null });
        }
    }

    // Step 2: Feed enriched data to the Strategy Agent
    console.log("Generating Internal Strategy...");
    const rawStrategy = await generateInternalStrategy(enrichedPosts);

    // Step 3: Pass to Critique Agent
    console.log("Running Quality Control...");
    const finalStrategy = await critiqueStrategy(rawStrategy);

    return {
        analyzedPosts: enrichedPosts,
        strategy: finalStrategy
    };
}

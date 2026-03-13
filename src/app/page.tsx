"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Facebook, Instagram, BarChart3, BrainCircuit, Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";

export default function Dashboard({ session }: { session: any }) {
  const [syncing, setSyncing] = useState(false);
  const [insightsData, setInsightsData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [strategyData, setStrategyData] = useState<any>(null);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sync");
      setInsightsData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleAnalyze = async () => {
      if (!insightsData?.data) return;
      
      setAnalyzing(true);
      setError(null);
      setStrategyData(null);
      try {
          const res = await fetch("/api/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ posts: insightsData.data })
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || "Failed AI analysis");
          setStrategyData(result.data.strategy);
      } catch (err: any) {
          setError(err.message);
      } finally {
          setAnalyzing(false);
      }
  };

  // ... (way down in the AI Diagnostic Agent Card)
                            {strategyData ? (
                                <div className="space-y-4">
                                  <h4 className="font-bold text-lg text-white">Your AI Content Strategy</h4>
                                  {strategyData._qcWarning && (
                                     <div className="p-2 bg-yellow-500/10 text-yellow-500 text-xs rounded border border-yellow-500/20">
                                         ⚠️ {strategyData._qcWarning}
                                     </div>
                                  )}
                                  <p className="text-sm text-neutral-300 italic">
                                     "{strategyData.diagnosticSummary}"
                                  </p>
                                  
                                  <div className="space-y-3 mt-4">
                                      {strategyData.actionableConcepts?.map((concept: any, i: number) => (
                                          <div key={i} className="p-3 bg-black/40 rounded-lg border border-neutral-800">
                                              <div className="flex justify-between items-center mb-2">
                                                  <span className="text-xs font-bold uppercase text-indigo-400">{concept.conceptType} Concept</span>
                                              </div>
                                              <p className="text-xs text-neutral-400 mb-2"><strong>Why it works:</strong> {concept.rationale}</p>
                                              <p className="text-xs text-neutral-300 mb-2"><strong>Visual:</strong> {concept.visualDirection}</p>
                                              <div className="p-2 bg-neutral-900 rounded inline-block text-xs font-mono text-neutral-200 w-full mb-1">
                                                  <strong>Hook:</strong> {concept.hook}
                                              </div>
                                              <p className="text-xs text-neutral-500 mt-2">{concept.draftedCaption}</p>
                                          </div>
                                      ))}
                                  </div>
                                </div>
                            ) : insightsData ? (
                                <>
                                  <h4 className="font-semibold text-sm mb-2 text-indigo-300">Agent Status: Ready</h4>
                                  <p className="text-sm text-neutral-400 mb-4">Orchestrator has received {insightsData.data.length} media payloads. Ready to deploy Vision and NLP Agents to analyze visual hooks and cross-reference with high share velocity.</p>
                                  <Button 
                                    onClick={handleAnalyze} 
                                    disabled={analyzing}
                                    size="sm" 
                                    className="w-full bg-indigo-500 hover:bg-indigo-600 text-white"
                                  >
                                      {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4"/>}
                                      {analyzing ? "Orchestrator is Processing..." : "Initialize Analysis"}
                                  </Button>
                                </>
                            ) : (
                                <>
                                  <h4 className="font-semibold text-sm mb-2 text-indigo-300">Awaiting API Payload</h4>
                                  <p className="text-sm text-neutral-400">Sync your account to activate the Orchestrator, Hook, Sentiment, and Critique Agents.</p>
                                </>
                            )}

  if (!session?.user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <BrainCircuit className="w-16 h-16 mx-auto text-indigo-500 mb-6" />
          <h1 className="text-4xl font-bold tracking-tight">CMagic Analytics</h1>
          <p className="text-neutral-400">
            Professional Instagram insights powered by deep Multi-Agent AI reasoning. Connect your professional account to analyze your reach, shares, and true virality quotient.
          </p>
          <Button 
            onClick={() => signIn("facebook")}
            size="lg" 
            className="w-full bg-[#1877F2] hover:bg-[#1877F2]/90 text-white font-medium text-lg mt-8"
          >
            <Facebook className="mr-2 h-5 w-5" />
            Connect with Facebook
          </Button>
        </div>
      </div>
    );
  }

  // Calculate aggregates if data exists
  const totalReach = insightsData?.data?.reduce((acc: number, post: any) => acc + (post.metrics.reach.total || 0), 0) || 0;
  const nonFollowerReach = insightsData?.data?.reduce((acc: number, post: any) => acc + (post.metrics.reach.nonFollower || 0), 0) || 0;
  const totalSavesShares = insightsData?.data?.reduce((acc: number, post: any) => acc + (post.metrics.saved || 0) + (post.metrics.shares || 0), 0) || 0;
  
  // Example simplistic virality quotient based on recent posts
  const viralityQuotient = totalReach > 0 ? ((nonFollowerReach / totalReach) * 100).toFixed(1) + "%" : "--";

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      <header className="border-b border-neutral-800 bg-neutral-950/50 backdrop-blur-xl sticky top-0 z-50">
         <div className="container mx-auto px-4 h-16 flex items-center justify-between">
           <div className="flex items-center space-x-2">
             <BrainCircuit className="w-6 h-6 text-indigo-500" />
             <span className="font-bold text-xl tracking-tight">CMagic Insights</span>
           </div>
           
           <div className="flex items-center space-x-4">
             <div className="text-sm font-medium text-neutral-300">
                {session.user.name}
             </div>
           </div>
         </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex justify-between items-end mb-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
                {insightsData?.account ? (
                    <p className="text-emerald-400 flex items-center gap-2">
                        <Instagram className="w-4 h-4"/> 
                        Connected: @{insightsData.account.username} ({insightsData.account.followers.toLocaleString()} followers)
                    </p>
                ) : (
                    <p className="text-neutral-400">Welcome back. Sync your account to view AI-driven performance.</p>
                )}
            </div>
            <Button 
                onClick={handleSync}
                disabled={syncing}
                className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white border-0 shadow-lg shadow-indigo-500/20"
            >
                {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-2 h-4 w-4" />}
                {syncing ? "Pulling Graph API Data..." : "Generate New Report"}
            </Button>
        </div>

        {error && (
            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/50 text-red-500 rounded-lg">
                <strong>Error Syncing Data:</strong> {error}
            </div>
        )}

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-neutral-900 border border-neutral-800">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Deep Analytics</TabsTrigger>
            <TabsTrigger value="ai-strategy">AI Strategy</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-neutral-900 border-neutral-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-neutral-400">Total Reach</CardTitle>
                    <Instagram className="h-4 w-4 text-neutral-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{insightsData ? totalReach.toLocaleString() : "--"}</div>
                    <p className="text-xs text-neutral-500">Last 10 Posts</p>
                  </CardContent>
                </Card>
                <Card className="bg-neutral-900 border-neutral-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-neutral-400">Non-Follower Reach</CardTitle>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4 text-neutral-500">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{insightsData ? nonFollowerReach.toLocaleString() : "--"}</div>
                    <p className="text-xs text-neutral-500">Discoverability Indicator</p>
                  </CardContent>
                </Card>
                <Card className="bg-neutral-900 border-neutral-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-neutral-400">Total Saves & Shares</CardTitle>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4 text-neutral-500">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{insightsData ? totalSavesShares.toLocaleString() : "--"}</div>
                    <p className="text-xs text-neutral-500">High-Intent Actions</p>
                  </CardContent>
                </Card>
                <Card className="bg-neutral-900 border-neutral-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-neutral-400">Virality Quotient</CardTitle>
                    <BrainCircuit className="h-4 w-4 text-indigo-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-indigo-400">{insightsData ? viralityQuotient : "--"}</div>
                    <p className="text-xs text-neutral-500">% Reach from Non-Followers</p>
                  </CardContent>
                </Card>
             </div>
             
             <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 bg-neutral-900 border-neutral-800">
                  <CardHeader>
                    <CardTitle>Recent Media Performance (Raw Data)</CardTitle>
                    <CardDescription className="text-neutral-400">
                      Deep-funnel Graph API metrics mapped from your 10 most recent posts.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="border-t border-neutral-800/50 p-0">
                    {insightsData ? (
                        <div className="h-[400px] overflow-auto p-4 bg-black/40 text-xs font-mono text-indigo-300">
                             <pre>{JSON.stringify(insightsData.data.map((d: any) => ({
                                id: d.id, type: d.type, 
                                views: d.metrics.views, 
                                saves: d.metrics.saved, 
                                shares: d.metrics.shares, 
                                reach_follower_split: `${d.metrics.reach.follower} / ${d.metrics.reach.nonFollower}`
                             })), null, 2)}</pre>
                        </div>
                    ) : (
                        <div className="h-[300px] flex items-center justify-center text-neutral-500 flex-col">
                            <BarChart3 className="w-10 h-10 mb-4 opacity-50" />
                            <p>No data selected</p>
                        </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card className="col-span-3 bg-neutral-900 border-neutral-800 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-50 pointer-events-none" />
                  <CardHeader>
                    <div className="flex items-center space-x-2 mb-1">
                        <BrainCircuit className="w-5 h-5 text-indigo-400" />
                        <CardTitle>AI Diagnostic Agent</CardTitle>
                    </div>
                    <CardDescription className="text-neutral-400">
                      Real-time qualitative reasoning based on your historical data.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-neutral-950/50 border border-neutral-800">
                            {insightsData ? (
                                <>
                                  <h4 className="font-semibold text-sm mb-2 text-indigo-300">Agent Status: Ready</h4>
                                  <p className="text-sm text-neutral-400 mb-4">Orchestrator has received {insightsData.data.length} media payloads. Ready to deploy Vision and NLP Agents to analyze visual hooks and cross-reference with high share velocity.</p>
                                  <Button size="sm" className="w-full bg-indigo-500 hover:bg-indigo-600 text-white">Initialize Analysis</Button>
                                </>
                            ) : (
                                <>
                                  <h4 className="font-semibold text-sm mb-2 text-indigo-300">Awaiting API Payload</h4>
                                  <p className="text-sm text-neutral-400">Sync your account to activate the Orchestrator, Hook, Sentiment, and Critique Agents.</p>
                                </>
                            )}
                        </div>
                    </div>
                  </CardContent>
                </Card>
             </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

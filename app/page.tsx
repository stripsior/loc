"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, AlertCircle, Github, RotateCcw, Star, GitFork, Eye, ExternalLink, TableIcon, PieChart, X, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { motion, AnimatePresence } from "motion/react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Pie, PieChart as RechartsPieChart, Cell, ResponsiveContainer } from "recharts";

interface LocData {
  language: string;
  files: number;
  lines: number;
  blanks: number;
  comments: number;
  linesOfCode: number;
}

interface RepoMetadata {
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  language: string | null;
  license: { name: string } | null;
  homepage: string | null;
  html_url: string;
  topics: string[];
  default_branch: string;
}

interface Branch {
  name: string;
}

// Fetch functions
async function fetchLocData(source: string, repoUrl: string, branch: string, ignored: string): Promise<LocData[]> {
  let url = `https://api.codetabs.com/v1/loc?${source}=${repoUrl}`;
  if (branch) url += `&branch=${branch}`;
  if (ignored) url += `&ignored=${ignored}`;

  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again in a few minutes.");
    }
    try {
      const errorData = await response.json();
      const errorMessage = errorData.Error || errorData.error;
      if (errorMessage) throw new Error(errorMessage);
    } catch (e) {
      if (e instanceof Error && e.message !== "Unexpected end of JSON input" && !e.message.includes("JSON")) {
        throw e;
      }
      throw new Error("Failed to fetch data. Please check the repository URL and try again.");
    }
  }

  let result;
  try {
    result = await response.json();
  } catch (e) {
    if (e instanceof Error) {
      throw new Error(`Invalid response from API: ${e.message}`);
    }
    throw new Error("Invalid response from API. The data could not be parsed.");
  }

  const errorMessage = result.Error || result.error;
  if (errorMessage) throw new Error(errorMessage);

  return result;
}

async function fetchGitHubMetadata(repoUrl: string): Promise<RepoMetadata> {
  const response = await fetch(`https://api.github.com/repos/${repoUrl}`);
  if (!response.ok) throw new Error("Failed to fetch GitHub metadata");
  return response.json();
}

async function fetchGitHubBranches(repoUrl: string): Promise<Branch[]> {
  const response = await fetch(`https://api.github.com/repos/${repoUrl}/branches`);
  if (!response.ok) throw new Error("Failed to fetch branches");
  return response.json();
}

export default function Home() {
  const [source, setSource] = useState<"github" | "gitlab">("github");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [ignored, setIgnored] = useState("");
  const [submittedParams, setSubmittedParams] = useState<{
    source: string;
    repoUrl: string;
    branch: string;
    ignored: string;
  } | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const bannerDismissed = localStorage.getItem("loc_banner_dismissed");
    if (!bannerDismissed) {
      setShowBanner(true);
    }
  }, []);

  const dismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem("loc_banner_dismissed", "true");
  };

  // Fetch LOC data
  const { data: locData, isLoading: isLoadingLoc, error: locError } = useQuery({
    queryKey: ['loc', submittedParams?.source, submittedParams?.repoUrl, submittedParams?.branch, submittedParams?.ignored],
    queryFn: () => fetchLocData(
      submittedParams!.source,
      submittedParams!.repoUrl,
      submittedParams!.branch,
      submittedParams!.ignored
    ),
    enabled: !!submittedParams,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Fetch GitHub metadata
  const { data: repoMetadata } = useQuery({
    queryKey: ['github-metadata', submittedParams?.repoUrl],
    queryFn: () => fetchGitHubMetadata(submittedParams!.repoUrl),
    enabled: !!submittedParams && submittedParams.source === "github",
    staleTime: 1000 * 60 * 60,
  });

  // Fetch GitHub branches
  const { data: branches } = useQuery({
    queryKey: ['github-branches', submittedParams?.repoUrl],
    queryFn: () => fetchGitHubBranches(submittedParams!.repoUrl),
    enabled: !!submittedParams && submittedParams.source === "github",
    staleTime: 1000 * 60 * 60,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (repoUrl.trim()) {
      setSubmittedParams({ source, repoUrl, branch, ignored });
      posthog.capture("loc_request_submitted", {
        source,
        repo_url: repoUrl,
        branch: branch || "default",
        ignored: ignored || "none",
      });
    }
  };

  const handleReset = () => {
    setSubmittedParams(null);
    setRepoUrl("");
    setBranch("");
    setIgnored("");
  };

  const handleBranchSwitch = (newBranch: string) => {
    if (submittedParams) {
      setBranch(newBranch);
      setSubmittedParams({ ...submittedParams, branch: newBranch });
      posthog.capture("loc_branch_switched", {
        repo_url: submittedParams.repoUrl,
        branch: newBranch,
      });
    }
  };

  // Track success
  useEffect(() => {
    if (locData && submittedParams) {
      const total = locData.find(d => d.language === "Total");
      posthog.capture("loc_request_success", {
        repo_url: submittedParams.repoUrl,
        branch: submittedParams.branch || "default",
        total_lines: total?.lines || 0,
        total_code: total?.linesOfCode || 0,
        languages_count: locData.length - 1,
      });
    }
  }, [locData, submittedParams]);

  // Track error
  useEffect(() => {
    if (locError && submittedParams) {
      posthog.capture("loc_request_error", {
        repo_url: submittedParams.repoUrl,
        branch: submittedParams.branch || "default",
        error: (locError as Error).message,
      });
    }
  }, [locError, submittedParams]);

  const totalData = locData?.find((item) => item.language === "Total");
  const languageData = locData?.filter((item) => item.language !== "Total");

  // Process language data for chart: show top 5 and group rest as "Other"
  const chartData = languageData ? (() => {
    const sorted = [...languageData].sort((a, b) => b.linesOfCode - a.linesOfCode);
    const top5 = sorted.slice(0, 5);
    const rest = sorted.slice(5);

    if (rest.length > 0) {
      const otherTotal = rest.reduce((sum, item) => ({
        language: "Other",
        files: sum.files + item.files,
        lines: sum.lines + item.lines,
        blanks: sum.blanks + item.blanks,
        comments: sum.comments + item.comments,
        linesOfCode: sum.linesOfCode + item.linesOfCode,
      }), {
        language: "Other",
        files: 0,
        lines: 0,
        blanks: 0,
        comments: 0,
        linesOfCode: 0,
      });
      return [...top5, otherTotal];
    }
    return top5;
  })() : null;

  const availableBranches = branches?.map(b => b.name) || [];
  const currentBranch = branch || repoMetadata?.default_branch || "";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-8">
      <div className={`mx-auto w-full max-w-5xl ${locData ? 'space-y-8' : ''}`}>
        <AnimatePresence mode="wait">
          {/* Loading Spinner */}
          {isLoadingLoc && (
            <motion.div
              key="spinner"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-center"
            >
              <div className="flex flex-col items-center gap-4">
                <Spinner className="h-12 w-12" />
                <p className="text-muted-foreground">Analyzing repository...</p>
              </div>
            </motion.div>
          )}

          {/* Input Form */}
          {!isLoadingLoc && !locData && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="flex items-center justify-center"
            >
              <Card className="w-full max-w-lg">
                <CardHeader>
                  <CardTitle>Lines of Code</CardTitle>
                  <CardDescription>
                    Analyze any GitHub repository
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <ToggleGroup type="single" value={source} onValueChange={(value) => value && setSource(value as "github" | "gitlab")} className="justify-start">
                        <ToggleGroupItem value="github" aria-label="GitHub">
                          <Github className="mr-2 h-4 w-4" />
                          GitHub
                        </ToggleGroupItem>
                        <ToggleGroupItem value="gitlab" aria-label="GitLab" disabled>
                          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23.6004 9.5927l-.0337-.0862L20.3.9814a.851.851 0 00-.3362-.405.8748.8748 0 00-.9997.0539.8748.8748 0 00-.29.4399l-2.2055 6.748H7.5375l-2.2057-6.748a.8573.8573 0 00-.29-.4412.8748.8748 0 00-.9997-.0537.8585.8585 0 00-.3362.4049L.5923 9.5015l-.0313.0825a6.1287 6.1287 0 002.0365 7.0594l.0037.0027.0113.0087 3.6288 2.7176 1.7928 1.3577 1.0918.8223a1.0085 1.0085 0 001.2164 0l1.0918-.8223 1.7928-1.3577 3.6401-2.7263.0037-.0027a6.1256 6.1256 0 002.0365-7.0594z" />
                          </svg>
                          GitLab
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>

                    <div className="space-y-2">
                      <Input
                        placeholder="username/repo"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Input
                          placeholder="Branch (optional)"
                          value={branch}
                          onChange={(e) => setBranch(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Input
                          placeholder="Ignored (optional)"
                          value={ignored}
                          onChange={(e) => setIgnored(e.target.value)}
                        />
                      </div>
                    </div>

                    <Button type="submit" disabled={!repoUrl.trim()} className="w-full">
                      <Search className="mr-2 h-4 w-4" />
                      Analyze
                    </Button>
                  </form>

                  {/* Error Alert */}
                  {locError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mt-4"
                    >
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{(locError as Error).message}</AlertDescription>
                      </Alert>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Results */}
          {!isLoadingLoc && totalData && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {/* Reset Button and Branch Switcher */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex justify-center"
              >
                <Button onClick={handleReset} variant="outline" size="sm">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Check another repository
                </Button>

              </motion.div>

              {/* Repository Metadata */}
              {repoMetadata && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2">
                            <Github className="h-5 w-5" />
                            {repoMetadata.full_name}
                          </CardTitle>
                          {repoMetadata.description && (
                            <CardDescription className="text-base">
                              {repoMetadata.description}
                            </CardDescription>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={repoMetadata.html_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex items-center gap-1.5 text-sm">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span className="font-medium">{repoMetadata.stargazers_count.toLocaleString()}</span>
                            <span className="text-muted-foreground">stars</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm">
                            <GitFork className="h-4 w-4" />
                            <span className="font-medium">{repoMetadata.forks_count.toLocaleString()}</span>
                            <span className="text-muted-foreground">forks</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Eye className="h-4 w-4" />
                            <span className="font-medium">{repoMetadata.watchers_count.toLocaleString()}</span>
                            <span className="text-muted-foreground">watchers</span>
                          </div>
                          {repoMetadata.language && (
                            <Badge variant="secondary">{repoMetadata.language}</Badge>
                          )}
                          {repoMetadata.license && (
                            <Badge variant="outline">{repoMetadata.license.name}</Badge>
                          )}
                        </div>

                        {availableBranches.length > 0 && (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm text-muted-foreground">Branch:</span>
                            <select
                              value={currentBranch}
                              onChange={(e) => handleBranchSwitch(e.target.value)}
                              className="h-8 rounded-md border border-input bg-background px-2 py-0.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {availableBranches.map((b) => (
                                <option key={b} value={b}>
                                  {b}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {(repoMetadata.topics && repoMetadata.topics.length > 0) && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {repoMetadata.topics.map((topic) => (
                            <Badge key={topic} variant="secondary" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {repoMetadata.homepage && (
                        <div className="mt-4">
                          <a
                            href={repoMetadata.homepage}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {repoMetadata.homepage}
                          </a>
                        </div>
                      )}


                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Summary Cards */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                {[
                  { label: "Total Lines", value: totalData.lines },
                  { label: "Lines of Code", value: totalData.linesOfCode },
                  { label: "Files", value: totalData.files },
                  { label: "Comments", value: totalData.comments },
                ].map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                  >
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>{stat.label}</CardDescription>
                        {isLoadingLoc ? (
                          <Skeleton className="h-9 w-24" />
                        ) : (
                          <CardTitle className="text-3xl">{stat.value.toLocaleString()}</CardTitle>
                        )}
                      </CardHeader>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>

              {/* Language Breakdown */}
              {languageData && languageData.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Language Breakdown</CardTitle>
                          <CardDescription>
                            Detailed statistics by programming language
                          </CardDescription>
                        </div>
                        <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as "table" | "chart")}>
                          <ToggleGroupItem value="table" aria-label="Table view">
                            <TableIcon className="h-4 w-4" />
                          </ToggleGroupItem>
                          <ToggleGroupItem value="chart" aria-label="Chart view">
                            <PieChart className="h-4 w-4" />
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <AnimatePresence mode="wait">
                        {viewMode === "table" ? (
                          <motion.div
                            key="table"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Language</TableHead>
                                  <TableHead className="text-right">Files</TableHead>
                                  <TableHead className="text-right">Lines</TableHead>
                                  <TableHead className="text-right">Code</TableHead>
                                  <TableHead className="text-right">Comments</TableHead>
                                  <TableHead className="text-right">Blanks</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {isLoadingLoc ? (
                                  // Skeleton rows
                                  Array.from({ length: 5 }).map((_, index) => (
                                    <TableRow key={`skeleton-${index}`}>
                                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                      <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                                      <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                                      <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                                      <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                                      <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                                    </TableRow>
                                  ))
                                ) : (
                                  languageData.map((item, index) => (
                                    <TableRow key={index}>
                                      <TableCell className="font-medium">
                                        <Badge variant="secondary">{item.language}</Badge>
                                      </TableCell>
                                      <TableCell className="text-right">{item.files.toLocaleString()}</TableCell>
                                      <TableCell className="text-right">{item.lines.toLocaleString()}</TableCell>
                                      <TableCell className="text-right font-medium">{item.linesOfCode.toLocaleString()}</TableCell>
                                      <TableCell className="text-right">{item.comments.toLocaleString()}</TableCell>
                                      <TableCell className="text-right">{item.blanks.toLocaleString()}</TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="chart"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center justify-center py-4"
                          >
                            {isLoadingLoc ? (
                              <div className="flex items-center justify-center h-[400px] w-full">
                                <Skeleton className="h-[300px] w-[300px] rounded-full" />
                              </div>
                            ) : (
                              <div className="h-[400px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <RechartsPieChart>
                                    <Pie
                                      data={chartData?.map((item) => ({
                                        name: item.language,
                                        value: item.linesOfCode,
                                      }))}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={80}
                                      outerRadius={140}
                                      paddingAngle={2}
                                      cornerRadius={8}
                                      stroke="none"
                                      dataKey="value"
                                    >
                                      {chartData?.map((entry, index) => {
                                        const colors = [
                                          "#e95268", "#e95298", "#c952e9",
                                          "#7352e9", "#5268e9", "#52c9e9",
                                        ];
                                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                      })}
                                    </Pie>
                                    <ChartTooltip
                                      content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                          const total = chartData?.reduce((sum, item) => sum + item.linesOfCode, 0) || 0;
                                          const percentage = ((payload[0].value as number / total) * 100).toFixed(1);
                                          return (
                                            <div className="rounded-lg border bg-background p-3 shadow-lg">
                                              <div className="flex flex-col gap-1">
                                                <span className="text-sm font-medium">{payload[0].name}</span>
                                                <span className="text-xs text-muted-foreground">
                                                  {payload[0].value?.toLocaleString()} lines ({percentage}%)
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        }
                                        return null;
                                      }}
                                    />
                                  </RechartsPieChart>
                                </ResponsiveContainer>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Privacy & Credits Banner */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, scale: 0.95, x: "-50%" }}
            className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[550px]"
          >
            <div className="flex items-center gap-4 rounded-xl border bg-card p-4 font-mono shadow-2xl backdrop-blur-xl">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Info className="h-5 w-5" />
              </div>

              <div className="flex-1 text-sm leading-snug">
                <span className="font-bold text-foreground">Privacy & Data:</span>{" "}
                <span className="text-muted-foreground">
                  Anonymous usage data via PostHog. API by{" "}
                  <a
                    href="https://codetabs.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#e95268] hover:underline"
                  >
                    codetabs.com
                  </a>.
                </span>
              </div>

              <button
                onClick={dismissBanner}
                className="rounded-md bg-[#e95268]/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#e95268] transition-colors hover:bg-[#e95268]/30"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

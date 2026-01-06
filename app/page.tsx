"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, AlertCircle, Github, RotateCcw, Star, GitFork, ExternalLink, TableIcon, PieChart, Info, Key, ChevronDown, User, FileText, LogOut, LogIn, FileX, GitBranch } from "lucide-react";
import { useSession, signIn, signOut, getAccessToken } from "@/lib/auth-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "motion/react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Pie, PieChart as RechartsPieChart, Cell, ResponsiveContainer } from "recharts";

interface LanguageStats {
  language: string;
  fileCount: number;
  totalLines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  bytes: number;
  percentage: number;
}

interface AuthorStats {
  name: string;
  email: string;
  avatarUrl: string;
  totalLines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  fileCount: number;
  percentage: number;
}

interface FileInfo {
  path: string;
  language: string;
  totalLines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  size: number;
}

interface RepositoryInfo {
  owner: string;
  name: string;
  fullName: string;
  description: string;
  stars: number;
  forks: number;
  size: number;
  defaultBranch: string;
  analyzedBranch: string;
  branches: string[];
  private: boolean;
}

interface AnalyzeResponse {
  repository: RepositoryInfo;
  summary: {
    totalFiles: number;
    totalLines: number;
    totalCodeLines: number;
    totalCommentLines: number;
    totalBlankLines: number;
    totalBytes: number;
  };
  languages: Record<string, LanguageStats>;
  authors?: Record<string, AuthorStats>;
  files: FileInfo[];
  processingTime: string;
}


function parseGitHubUrl(input: string): string {
  const trimmed = input.trim();

  if (/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);

    if (url.hostname === 'github.com' || url.hostname === 'www.github.com') {
      const pathname = url.pathname.replace(/^\/|\/$/g, '');

      const parts = pathname.split('/');
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
      }
    }
  } catch (e) { }


  return trimmed;
}

// Fetch functions
async function analyzeRepository(
  repoUrl: string,
  branch?: string,
  token?: string,
  includeAuthors?: boolean,
  filters?: {
    excludeExtensions?: string[];
    excludeDirectories?: string[];
    minFileSize?: number;
    maxFileSize?: number;
    excludeGenerated?: boolean;
    excludeVendored?: boolean;
  }
): Promise<AnalyzeResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  const requestBody: any = {
    repository: repoUrl,
  };

  if (token) requestBody.token = token;
  if (branch) requestBody.branch = branch;
  if (includeAuthors) requestBody.includeAuthors = includeAuthors;
  if (filters) requestBody.filters = filters;

  const response = await fetch(`${apiUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again in a few minutes.");
    }

    let errorMessage = "Failed to analyze repository. Please check the repository URL and try again.";

    try {
      const errorData = await response.json();

      // Try to extract a meaningful error message
      if (errorData.error && typeof errorData.error === 'string') {
        errorMessage = errorData.error;
      } else if (errorData.message && typeof errorData.message === 'string') {
        errorMessage = errorData.message;
      } else if (errorData.error && typeof errorData.error === 'object') {
        // Handle case where error is an object with a message
        errorMessage = errorData.error.message || errorMessage;
      }
    } catch (e) {
      // If JSON parsing fails, use the default error message
      console.error("Failed to parse error response:", e);
    }

    throw new Error(errorMessage);
  }

  return response.json();
}


export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [excludeExtensions, setExcludeExtensions] = useState("");
  const queryClient = useQueryClient();
  const [submittedParams, setSubmittedParams] = useState<{
    repoUrl: string;
    branch: string;
    excludeExtensions: string;
  } | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");
  const [breakdownType, setBreakdownType] = useState<"languages" | "files" | "authors">("languages");
  const [showBreakdownDropdown, setShowBreakdownDropdown] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get session for authentication
  const { data: session, isPending: isSessionLoading } = useSession();

  useEffect(() => {
    const bannerDismissed = localStorage.getItem("loc_banner_dismissed");
    if (!bannerDismissed) {
      setShowBanner(true);
    }
  }, []);

  // Click outside handler for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowBreakdownDropdown(false);
      }
    };

    if (showBreakdownDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showBreakdownDropdown]);

  const dismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem("loc_banner_dismissed", "true");
  };

  const { data: analysisData, isLoading: isLoadingAnalysis, error: analysisError } = useQuery({
    queryKey: ['analyze', submittedParams?.repoUrl, submittedParams?.branch, submittedParams?.excludeExtensions, session?.user?.id],
    queryFn: async () => {
      let authToken = undefined;

      // If user is authenticated, get their GitHub access token
      if (session?.user) {
        try {
          const tokenData = await getAccessToken({ providerId: "github" });
          if (tokenData && 'data' in tokenData && tokenData.data?.accessToken) {
            authToken = tokenData.data.accessToken;
          }
        } catch (error) {
          console.error("Failed to get access token:", error);
        }
      }

      const extensions = submittedParams?.excludeExtensions
        ? submittedParams.excludeExtensions.split(',').map(s => s.trim().startsWith('.') ? s.trim() : `.${s.trim()}`)
        : undefined;

      return analyzeRepository(
        submittedParams!.repoUrl,
        submittedParams!.branch || undefined,
        authToken,
        false,
        {
          excludeGenerated: true,
          excludeVendored: true,
          excludeExtensions: extensions
        }
      );
    },
    enabled: !!submittedParams,
    staleTime: 1000 * 60, // 1 minute
  });

  // Separate query for authors data
  const { data: authorsData, isLoading: isLoadingAuthors, refetch: refetchAuthors } = useQuery({
    queryKey: ['analyze-authors', submittedParams?.repoUrl, submittedParams?.branch, submittedParams?.excludeExtensions, session?.user?.id],
    queryFn: async () => {
      let authToken = undefined;

      // If user is authenticated, get their GitHub access token
      if (session?.user) {
        try {
          const tokenData = await getAccessToken({ providerId: "github" });
          if (tokenData && 'data' in tokenData && tokenData.data?.accessToken) {
            authToken = tokenData.data.accessToken;
          }
        } catch (error) {
          console.error("Failed to get access token:", error);
        }
      }

      const extensions = submittedParams?.excludeExtensions
        ? submittedParams.excludeExtensions.split(',').map(s => s.trim().startsWith('.') ? s.trim() : `.${s.trim()}`)
        : undefined;

      return analyzeRepository(
        submittedParams!.repoUrl,
        submittedParams!.branch || undefined,
        authToken,
        true,
        {
          excludeGenerated: true,
          excludeVendored: true,
          excludeExtensions: extensions
        }
      );
    },
    enabled: false, // Don't fetch automatically
    staleTime: 1000 * 60,
  });



  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (repoUrl.trim()) {
      // Invalidate queries to allow resubmission with same values (e.g., after error)
      queryClient.invalidateQueries({ queryKey: ['analyze'] });
      queryClient.invalidateQueries({ queryKey: ['analyze-authors'] });

      setSubmittedParams({ repoUrl, branch, excludeExtensions });
      posthog.capture("loc_request_submitted", {
        repo_url: repoUrl,
        branch: branch || "default",
        exclude_extensions: excludeExtensions,
      });
    }
  };

  const handleReset = () => {
    setSubmittedParams(null);
    setRepoUrl("");
    setBranch("");
    setExcludeExtensions("");
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

  const handleBreakdownTypeChange = (type: "languages" | "files" | "authors") => {
    setBreakdownType(type);
    setShowBreakdownDropdown(false);

    // If switching to authors and we don't have authors data yet, fetch it
    if (type === "authors" && (!authorsData?.authors || Object.keys(authorsData.authors).length === 0)) {
      refetchAuthors();
    }

    posthog.capture("breakdown_type_changed", {
      breakdown_type: type,
    });
  };

  // Track success
  useEffect(() => {
    if (analysisData && submittedParams) {
      posthog.capture("loc_request_success", {
        repo_url: submittedParams.repoUrl,
        branch: submittedParams.branch || "default",
        total_lines: analysisData.summary.totalLines,
        total_code: analysisData.summary.totalCodeLines,
        languages_count: Object.keys(analysisData.languages).length,
      });
    }
  }, [analysisData, submittedParams]);

  // Track error
  useEffect(() => {
    if (analysisError && submittedParams) {
      posthog.capture("loc_request_error", {
        repo_url: submittedParams.repoUrl,
        branch: submittedParams.branch || "default",
        error: (analysisError as Error).message,
      });
    }
  }, [analysisError, submittedParams]);

  // Process language data for display
  const languageData = analysisData ? Object.values(analysisData.languages) : null;

  // Process chart data based on breakdown type: show top 5 and group rest as "Other"
  const chartData = (() => {
    if (breakdownType === "languages" && languageData) {
      const sorted = [...languageData].sort((a, b) => b.codeLines - a.codeLines);
      const top5 = sorted.slice(0, 5);
      const rest = sorted.slice(5);

      if (rest.length > 0) {
        const otherTotal = rest.reduce((sum, item) => ({
          language: "Other",
          fileCount: sum.fileCount + item.fileCount,
          totalLines: sum.totalLines + item.totalLines,
          blankLines: sum.blankLines + item.blankLines,
          commentLines: sum.commentLines + item.commentLines,
          codeLines: sum.codeLines + item.codeLines,
          bytes: sum.bytes + item.bytes,
          percentage: sum.percentage + item.percentage,
        }), {
          language: "Other",
          fileCount: 0,
          totalLines: 0,
          blankLines: 0,
          commentLines: 0,
          codeLines: 0,
          bytes: 0,
          percentage: 0,
        });
        return top5.map(item => ({ name: item.language, value: item.codeLines })).concat([{ name: "Other", value: otherTotal.codeLines }]);
      }
      return top5.map(item => ({ name: item.language, value: item.codeLines }));
    }

    if (breakdownType === "files" && analysisData?.files) {
      const sorted = [...analysisData.files].sort((a, b) => b.codeLines - a.codeLines);
      const top10 = sorted.slice(0, 10);
      const rest = sorted.slice(10);

      const chartItems = top10.map(file => ({
        name: file.path.split('/').pop() || file.path,
        value: file.codeLines,
        fullPath: file.path
      }));

      if (rest.length > 0) {
        const otherTotal = rest.reduce((sum, file) => sum + file.codeLines, 0);
        chartItems.push({ name: `Other (${rest.length} files)`, value: otherTotal, fullPath: "" });
      }

      return chartItems;
    }

    if (breakdownType === "authors" && authorsData?.authors && Object.keys(authorsData.authors).length > 0) {
      const authors = Object.values(authorsData.authors);
      const sorted = [...authors].sort((a, b) => b.codeLines - a.codeLines);
      const top5 = sorted.slice(0, 5);
      const rest = sorted.slice(5);

      const chartItems = top5.map(author => ({
        name: author.name,
        value: author.codeLines,
        email: author.email
      }));

      if (rest.length > 0) {
        const otherTotal = rest.reduce((sum, author) => sum + author.codeLines, 0);
        chartItems.push({ name: `Other (${rest.length} authors)`, value: otherTotal, email: "" });
      }

      return chartItems;
    }

    return null;
  })();

  const availableBranches = analysisData?.repository.branches || [];
  const currentBranch = branch || analysisData?.repository.defaultBranch || "";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-8">
      <div className={`mx-auto w-full max-w-5xl ${analysisData ? 'space-y-8' : ''}`}>
        <AnimatePresence mode="wait">
          {/* Loading Spinner */}
          {isLoadingAnalysis && (
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
          {!isLoadingAnalysis && !analysisData && (
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
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle>Lines of Code</CardTitle>
                      <CardDescription>
                        Analyze any GitHub repository
                      </CardDescription>
                    </div>

                    {/* Authentication UI */}
                    <div className="flex items-center gap-2">
                      {session?.user ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted">
                            {session.user.image && (
                              <img
                                src={session.user.image}
                                alt={session.user.name || "User"}
                                className="h-6 w-6 rounded-full"
                              />
                            )}
                            <span className="text-sm font-medium">{session.user.name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              await signOut();
                              setShowRevokeModal(true);
                            }}
                            title="Sign out"
                          >
                            <LogOut className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => signIn.social({ provider: "github", callbackURL: "/" })}
                          disabled={isSessionLoading}
                        >
                          <Github className="mr-2 h-4 w-4" />
                          Sign in with GitHub
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <div className="relative">
                        <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="username/repo or https://github.com/username/repo"
                          value={repoUrl}
                          onChange={(e) => setRepoUrl(parseGitHubUrl(e.target.value))}
                          className="pl-9"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <div className="relative">
                          <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Branch (optional)"
                            value={branch}
                            onChange={(e) => setBranch(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="relative">
                          <FileX className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Exclude extensions (e.g. .md, .txt)"
                            value={excludeExtensions}
                            onChange={(e) => setExcludeExtensions(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                      </div>
                    </div>

                    <Button type="submit" disabled={!repoUrl.trim()} className="w-full">
                      <Search className="mr-2 h-4 w-4" />
                      Analyze
                    </Button>
                  </form>

                  {/* Error Alert */}
                  {analysisError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mt-4"
                    >
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{(analysisError as Error).message}</AlertDescription>
                      </Alert>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Results */}
          {!isLoadingAnalysis && analysisData && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {/* Reset Button */}
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
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <CardTitle className="flex items-center gap-2 truncate">
                          <Github className="h-5 w-5 shrink-0" />
                          <span className="truncate">{analysisData.repository.fullName}</span>
                        </CardTitle>
                        {analysisData.repository.description && (
                          <CardDescription className="text-base line-clamp-2">
                            {analysisData.repository.description}
                          </CardDescription>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={`https://github.com/${analysisData.repository.fullName}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-[1fr_auto] items-end">
                    <div className="space-y-4 min-w-0">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <span className="font-medium">{analysisData.repository.stars.toLocaleString()}</span>
                          <span className="text-muted-foreground">stars</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm">
                          <GitFork className="h-4 w-4" />
                          <span className="font-medium">{analysisData.repository.forks.toLocaleString()}</span>
                          <span className="text-muted-foreground">forks</span>
                        </div>
                        {analysisData.repository.private && (
                          <Badge variant="secondary">Private</Badge>
                        )}
                      </div>
                    </div>

                    {availableBranches.length > 0 && (
                      <div className="flex items-center gap-2 shrink-0 min-w-0">
                        <span className="text-sm text-muted-foreground shrink-0">Branch:</span>
                        <select
                          value={currentBranch}
                          onChange={(e) => handleBranchSwitch(e.target.value)}
                          className="h-8 max-w-[160px] rounded-md border border-input bg-background px-2 py-0.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {availableBranches.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Summary Cards */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                {[
                  { label: "Total Lines", value: analysisData.summary.totalLines },
                  { label: "Lines of Code", value: analysisData.summary.totalCodeLines },
                  { label: "Files", value: analysisData.summary.totalFiles },
                  { label: "Comments", value: analysisData.summary.totalCommentLines },
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
                        <CardTitle className="text-3xl">{stat.value.toLocaleString()}</CardTitle>
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
                        <div className="relative" ref={dropdownRef}>
                          <button
                            onClick={() => setShowBreakdownDropdown(!showBreakdownDropdown)}
                            className="flex items-center gap-2 group cursor-pointer"
                          >
                            <CardTitle className="flex items-center gap-2">
                              {breakdownType === "languages" && "Language Breakdown"}
                              {breakdownType === "files" && "File Breakdown"}
                              {breakdownType === "authors" && "Authors Breakdown"}
                              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-hover:text-foreground" />
                            </CardTitle>
                          </button>

                          <AnimatePresence>
                            {showBreakdownDropdown && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.15 }}
                                className="absolute top-full left-0 mt-2 w-56 rounded-md border bg-popover shadow-lg z-50"
                              >
                                <div className="p-1">
                                  <button
                                    onClick={() => handleBreakdownTypeChange("languages")}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm transition-colors ${breakdownType === "languages"
                                      ? "bg-accent text-accent-foreground"
                                      : "hover:bg-accent/50"
                                      }`}
                                  >
                                    <FileText className="h-4 w-4" />
                                    Language Breakdown
                                  </button>
                                  <button
                                    onClick={() => handleBreakdownTypeChange("files")}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm transition-colors ${breakdownType === "files"
                                      ? "bg-accent text-accent-foreground"
                                      : "hover:bg-accent/50"
                                      }`}
                                  >
                                    <FileText className="h-4 w-4" />
                                    File Breakdown
                                  </button>
                                  <button
                                    onClick={() => handleBreakdownTypeChange("authors")}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm transition-colors ${breakdownType === "authors"
                                      ? "bg-accent text-accent-foreground"
                                      : "hover:bg-accent/50"
                                      }`}
                                  >
                                    <User className="h-4 w-4" />
                                    Authors Breakdown
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <CardDescription className="mt-1">
                            {breakdownType === "languages" && "Detailed statistics by programming language"}
                            {breakdownType === "files" && "Breakdown by individual files"}
                            {breakdownType === "authors" && "Contribution statistics by author"}
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
                                  {breakdownType === "languages" && (
                                    <>
                                      <TableHead>Language</TableHead>
                                      <TableHead className="text-right">Files</TableHead>
                                      <TableHead className="text-right">Lines</TableHead>
                                      <TableHead className="text-right">Code</TableHead>
                                      <TableHead className="text-right">Comments</TableHead>
                                      <TableHead className="text-right">Blanks</TableHead>
                                    </>
                                  )}
                                  {breakdownType === "files" && (
                                    <>
                                      <TableHead>File Path</TableHead>
                                      <TableHead>Language</TableHead>
                                      <TableHead className="text-right">Lines</TableHead>
                                      <TableHead className="text-right">Code</TableHead>
                                      <TableHead className="text-right">Comments</TableHead>
                                      <TableHead className="text-right">Blanks</TableHead>
                                    </>
                                  )}
                                  {breakdownType === "authors" && (
                                    <>
                                      <TableHead>Author</TableHead>
                                      <TableHead className="text-right">Files</TableHead>
                                      <TableHead className="text-right">Lines</TableHead>
                                      <TableHead className="text-right">Code</TableHead>
                                      <TableHead className="text-right">%</TableHead>
                                    </>
                                  )}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {breakdownType === "languages" && languageData?.map((item, index) => (
                                  <TableRow key={index}>
                                    <TableCell className="font-medium">
                                      <Badge variant="secondary">{item.language}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">{item.fileCount.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{item.totalLines.toLocaleString()}</TableCell>
                                    <TableCell className="text-right font-medium">{item.codeLines.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{item.commentLines.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{item.blankLines.toLocaleString()}</TableCell>
                                  </TableRow>
                                ))}

                                {breakdownType === "files" && analysisData?.files.map((file, index) => (
                                  <TableRow key={index}>
                                    <TableCell className="font-medium font-mono text-xs max-w-md truncate" title={file.path}>
                                      {file.path}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="secondary" className="text-xs">{file.language}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">{file.totalLines.toLocaleString()}</TableCell>
                                    <TableCell className="text-right font-medium">{file.codeLines.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{file.commentLines.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{file.blankLines.toLocaleString()}</TableCell>
                                  </TableRow>
                                ))}

                                {breakdownType === "authors" && (
                                  <>
                                    {isLoadingAuthors ? (
                                      // Skeleton rows while loading
                                      Array.from({ length: 5 }).map((_, index) => (
                                        <TableRow key={`skeleton-${index}`}>
                                          <TableCell>
                                            <div className="flex items-center gap-2">
                                              <Skeleton className="h-6 w-6 rounded-full" />
                                              <div className="space-y-1">
                                                <Skeleton className="h-4 w-32" />
                                                <Skeleton className="h-3 w-40" />
                                              </div>
                                            </div>
                                          </TableCell>
                                          <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                                          <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                                          <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                                          <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                                        </TableRow>
                                      ))
                                    ) : authorsData?.authors && Object.keys(authorsData.authors).length > 0 ? (
                                      Object.values(authorsData.authors).map((author, index) => (
                                        <TableRow key={index}>
                                          <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                              {author.avatarUrl && (
                                                <img src={author.avatarUrl} alt={author.name} className="h-6 w-6 rounded-full" />
                                              )}
                                              <div>
                                                <div className="font-medium">{author.name}</div>
                                                <div className="text-xs text-muted-foreground">{author.email}</div>
                                              </div>
                                            </div>
                                          </TableCell>
                                          <TableCell className="text-right">{author.fileCount.toLocaleString()}</TableCell>
                                          <TableCell className="text-right">{author.totalLines.toLocaleString()}</TableCell>
                                          <TableCell className="text-right font-medium">{author.codeLines.toLocaleString()}</TableCell>
                                          <TableCell className="text-right">{author.percentage.toFixed(1)}%</TableCell>
                                        </TableRow>
                                      ))
                                    ) : (
                                      <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                          No author data available
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </>
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
                            {chartData && chartData.length > 0 ? (
                              <div className="h-[400px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <RechartsPieChart>
                                    <Pie
                                      data={chartData}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={80}
                                      outerRadius={140}
                                      paddingAngle={2}
                                      cornerRadius={8}
                                      stroke="none"
                                      dataKey="value"
                                    >
                                      {chartData.map((entry, index) => {
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
                                          const total = chartData.reduce((sum, item) => sum + item.value, 0);
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
                            ) : (
                              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                                {breakdownType === "authors" && isLoadingAuthors ? (
                                  <div className="flex flex-col items-center gap-2">
                                    <Spinner className="h-8 w-8" />
                                    <p className="text-sm">Loading author data...</p>
                                  </div>
                                ) : (
                                  <p>No data available for chart</p>
                                )}
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
                  Anonymous usage data via PostHog. Repository files are not saved permanently, they exist only during analysis.
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

      {/* Source Badge */}
      <motion.a
        href="https://github.com/stripsior/loc"
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
        className="fixed bottom-6 right-6 z-40 group"
      >
        <div className="flex items-center gap-2 rounded-full border bg-card/80 px-4 py-2 font-mono text-sm shadow-lg backdrop-blur-xl transition-all hover:bg-card hover:shadow-xl hover:scale-105">
          <Github className="h-4 w-4 text-muted-foreground group-hover:text-[#e95268] transition-colors" />
          <span className="text-muted-foreground">
            Source available at{" "}
            <span className="text-[#e95268] font-semibold group-hover:underline">
              GitHub
            </span>
          </span>
        </div>
      </motion.a>

      {/* Revoke Access Modal */}
      <Dialog open={showRevokeModal} onOpenChange={setShowRevokeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke GitHub Access?</DialogTitle>
            <DialogDescription>
              You've successfully signed out. Would you like to revoke this app's access to your GitHub account?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRevokeModal(false)}
            >
              No, Keep Access
            </Button>
            <Button
              variant="default"
              asChild
            >
              <a
                href="https://github.com/settings/connections/applications/Ov23liZSXPujYVQXCsfW"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowRevokeModal(false)}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Revoke Access
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

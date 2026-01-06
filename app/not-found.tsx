"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Home, Github, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-lg"
            >
                <Card>
                    <CardHeader className="text-center space-y-4">
                        <div className="text-8xl font-bold text-[#e95268]">
                            404
                        </div>
                        <CardTitle className="text-2xl">Page Not Found</CardTitle>
                        <CardDescription className="text-base">
                            Looks like this page doesn't exist in our repository
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-3">
                            <Button asChild className="w-full">
                                <Link href="/">
                                    <Home className="mr-2 h-4 w-4" />
                                    Back to Home
                                </Link>
                            </Button>
                            <Button asChild variant="outline" className="w-full">
                                <a
                                    href="https://github.com/stripsior/loc"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Github className="mr-2 h-4 w-4" />
                                    View Source
                                </a>
                            </Button>
                        </div>

                        <div className="pt-4 border-t text-center">
                            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                                <Search className="h-4 w-4" />
                                Try analyzing a repository instead?
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}

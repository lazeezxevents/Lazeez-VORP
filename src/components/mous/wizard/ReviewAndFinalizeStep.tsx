
import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, FileText, Calendar, IndianRupee, Store, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ReviewAndFinalizeStepProps {
    onFinish: (data: any) => void;
    data: any;
}

export const ReviewAndFinalizeStep: React.FC<ReviewAndFinalizeStepProps> = ({ onFinish, data }) => {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-white">Review Agreement</h2>
                <p className="text-zinc-400">Please verify the details before generating the legal document.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
                {/* Vendor Card */}
                <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-white">
                            <Store className="w-5 h-5 text-indigo-400" />
                            Vendor Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                            <span className="text-zinc-400">Business Name</span>
                            <span className="text-white font-medium">{data?.vendor?.name || "N/A"}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                            <span className="text-zinc-400">Category</span>
                            <Badge variant="outline" className="text-indigo-300 border-indigo-500/30 capitalize">
                                {data?.category?.replace('_', ' ') || "N/A"}
                            </Badge>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                            <span className="text-zinc-400">Owner</span>
                            <span className="text-white">{data?.vendor?.owner_name || "N/A"}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-zinc-400">Contact</span>
                            <span className="text-white">{data?.vendor?.phone || "N/A"}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Terms Card */}
                <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-white">
                            <FileText className="w-5 h-5 text-emerald-400" />
                            Contract Terms
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                            <span className="text-zinc-400">Commission</span>
                            <span className="text-emerald-400 font-bold text-lg">{data?.terms?.commission || "0"}%</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                            <span className="text-zinc-400">Duration</span>
                            <div className="flex items-center gap-2 text-white">
                                <Calendar className="w-4 h-4 text-zinc-500" />
                                {data?.terms?.duration || "0"} Months
                            </div>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                            <span className="text-zinc-400">Subscription</span>
                            <div className="flex items-center gap-1 text-white">
                                {data?.terms?.subscription ? (
                                    <>
                                        <span className="text-xs text-zinc-500 font-mono">PKR</span>
                                        <span>{data.terms.subscription}</span>
                                    </>
                                ) : (
                                    <span className="text-zinc-500">None</span>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col items-center gap-4 pt-8">
                <Button
                    onClick={() => onFinish({ status: 'finalized' })}
                    size="lg"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-full px-12 py-6 text-lg shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all hover:scale-105 hover:shadow-[0_0_50px_rgba(16,185,129,0.5)]"
                >
                    <Check className="w-6 h-6 mr-2" />
                    Generate & Sign MOU
                </Button>
                <p className="text-xs text-zinc-500">
                    By clicking above, you agree that all details are verified.
                </p>
            </div>
        </div>
    );
};

import { useState, useMemo } from "react";
import { ClipboardCheck, Star, ShieldCheck, BarChart3 } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AppraisalReview } from "@/hooks/useAppraisals";
import { EmployeeKPI } from "@/hooks/useEmployeePerformance";

interface AppraisalsTabProps {
    appraisalData: AppraisalReview[];
    employees: EmployeeKPI[];
    submitReviewMutation: {
        mutate: (data: {
            employee_id: string;
            review_type: "peer" | "manager" | "self" | "subordinate";
            period_start: string;
            period_end: string;
            collaboration_score: number;
            reliability_score: number;
            quality_score: number;
            innovation_score: number;
            comments?: string;
        }) => void;
        isPending: boolean
    };
}

export function AppraisalsTab({
    appraisalData,
    employees,
    submitReviewMutation
}: AppraisalsTabProps) {
    const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
    const [selectedEmpIdForViz, setSelectedEmpIdForViz] = useState<string | null>(null);
    const [reviewForm, setReviewForm] = useState({
        employee_id: "",
        review_type: "peer" as "peer" | "manager" | "self" | "subordinate",
        period_start: "",
        period_end: "",
        collaboration_score: 3,
        reliability_score: 3,
        quality_score: 3,
        innovation_score: 3,
        comments: ""
    });

    const visualizationData = useMemo(() => {
        if (!selectedEmpIdForViz) return null;
        const empReviews = appraisalData.filter(r => r.employee_id === selectedEmpIdForViz);
        if (empReviews.length === 0) return null;

        const avg = (field: keyof AppraisalReview) => {
            const validReviews = empReviews.filter(r => typeof r[field] === 'number');
            if (validReviews.length === 0) return 0;
            return Math.round((validReviews.reduce((sum, r) => sum + (Number(r[field]) || 0), 0) / validReviews.length) * 10) / 10;
        };

        return [
            { subject: 'Collaboration', A: avg('collaboration_score'), fullMark: 5 },
            { subject: 'Reliability', A: avg('reliability_score'), fullMark: 5 },
            { subject: 'Quality', A: avg('quality_score'), fullMark: 5 },
            { subject: 'Innovation', A: avg('innovation_score'), fullMark: 5 },
        ];
    }, [appraisalData, selectedEmpIdForViz]);

    const handleSubmitReview = () => {
        submitReviewMutation.mutate(reviewForm);
        setReviewDialogOpen(false);
        setReviewForm({
            employee_id: "",
            review_type: "peer",
            period_start: "",
            period_end: "",
            collaboration_score: 3,
            reliability_score: 3,
            quality_score: 3,
            innovation_score: 3,
            comments: ""
        });
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <h3 className="text-lg font-bold text-foreground">Performance reviews</h3>
                    <Select value={selectedEmpIdForViz || "none"} onValueChange={v => setSelectedEmpIdForViz(v === "none" ? null : v)}>
                        <SelectTrigger className="w-56 rounded-xl border-primary/20 bg-primary/5 font-medium h-9 text-xs text-foreground">
                            <SelectValue placeholder="Analyze feedback" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="none">Select employee</SelectItem>
                            {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <Button size="sm" onClick={() => setReviewDialogOpen(true)} className="gap-2 bg-primary hover:bg-primary/95 text-xs font-bold rounded-xl shadow-lg shadow-primary/20">
                    <ClipboardCheck className="w-4 h-4" />
                    Submit review
                </Button>
            </div>

            {visualizationData && (
                <Card className="border-none shadow-xl bg-gradient-to-br from-primary/5 via-card to-card overflow-hidden animate-slide-up border border-border/20">
                    <CardHeader className="pb-0">
                        <CardTitle className="text-sm font-bold text-primary/60">Performance attribute analysis</CardTitle>
                        <CardDescription className="text-sm font-semibold text-foreground">
                            {employees.find(e => e.id === selectedEmpIdForViz)?.fullName}'s performance rating
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col md:flex-row items-center gap-8 py-8">
                        <div className="w-full md:w-1/2 h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={visualizationData}>
                                    <PolarGrid strokeOpacity={0.1} />
                                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 800 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                                    <Radar
                                        name="Score"
                                        dataKey="A"
                                        stroke="#ED004F"
                                        fill="#ED004F"
                                        fillOpacity={0.6}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-2 gap-4 flex-1 w-full">
                            {visualizationData.map((d, i) => (
                                <div key={i} className="p-4 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/40 shadow-sm">
                                    <p className="text-[10px] font-bold text-muted-foreground mb-1">{d.subject}</p>
                                    <div className="flex items-end gap-2">
                                        <p className="text-2xl font-bold text-foreground">{d.A}</p>
                                        <p className="text-[10px] font-medium text-muted-foreground mb-1">/ 5</p>
                                    </div>
                                    <div className="w-full bg-muted/40 h-1.5 rounded-full mt-2 overflow-hidden">
                                        <div className="bg-primary h-full rounded-full" style={{ width: `${(d.A / 5) * 100}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="border-none shadow-sm overflow-hidden animate-slide-up">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-muted/30 text-[10px] font-bold text-muted-foreground">
                                    <th className="px-6 py-4">Employee</th>
                                    <th className="px-6 py-4">Reviewer</th>
                                    <th className="px-6 py-4">Type</th>
                                    <th className="px-6 py-4 text-center">Collaboration</th>
                                    <th className="px-6 py-4 text-center">Reliability</th>
                                    <th className="px-6 py-4 text-center">Quality</th>
                                    <th className="px-6 py-4 text-center">Innovation</th>
                                    <th className="px-6 py-4">Avg score</th>
                                    <th className="px-6 py-4">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {appraisalData.map((r) => (
                                    <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-sm text-foreground">{r.employee_name}</div>
                                            <div className="text-[10px] text-muted-foreground font-medium truncate max-w-[150px] italic">"{r.comments?.substring(0, 30)}..."</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-semibold text-muted-foreground">{r.reviewer_name}</td>
                                        <td className="px-6 py-4">
                                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-muted-foreground/20">
                                                {r.review_type}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-black text-center text-slate-600">{r.collaboration_score}</td>
                                        <td className="px-6 py-4 text-sm font-black text-center text-slate-600">{r.reliability_score}</td>
                                        <td className="px-6 py-4 text-sm font-black text-center text-slate-600">{r.quality_score}</td>
                                        <td className="px-6 py-4 text-sm font-black text-center text-slate-600">{r.innovation_score}</td>
                                        <td className="px-6 py-4">
                                            <Badge className={cn("text-[10px] font-bold px-2.5",
                                                r.avg_score >= 4 ? 'bg-emerald-500' :
                                                    r.avg_score >= 3 ? 'bg-blue-500' : 'bg-amber-500'
                                            )}>
                                                {r.avg_score}/5
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-medium text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                                {appraisalData.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground text-sm italic font-light">
                                            No performance reviews recorded yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
                <DialogContent className="max-w-xl bg-background/95 backdrop-blur-xl border-border/20">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Submit performance review</DialogTitle>
                        <DialogDescription className="text-muted-foreground font-medium">Submit a 360-degree performance review for an employee.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Select Employee</Label>
                                <Select value={reviewForm.employee_id} onValueChange={v => setReviewForm(f => ({ ...f, employee_id: v }))}>
                                    <SelectTrigger className="rounded-xl border-muted-foreground/20 h-11"><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.fullName || e.email}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Review Type</Label>
                                <Select value={reviewForm.review_type} onValueChange={(v: "peer" | "manager" | "self" | "subordinate") => setReviewForm(f => ({ ...f, review_type: v }))}>
                                    <SelectTrigger className="rounded-xl border-muted-foreground/20 h-11"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="peer">Peer-to-Peer</SelectItem>
                                        <SelectItem value="manager">Managerial</SelectItem>
                                        <SelectItem value="self">Self-Evaluation</SelectItem>
                                        <SelectItem value="subordinate">Subordinate Review</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Period Start</Label>
                                <Input type="date" value={reviewForm.period_start} onChange={e => setReviewForm(f => ({ ...f, period_start: e.target.value }))} className="rounded-xl h-11" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Period End</Label>
                                <Input type="date" value={reviewForm.period_end} onChange={e => setReviewForm(f => ({ ...f, period_end: e.target.value }))} className="rounded-xl h-11" />
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-muted/30 border border-muted-foreground/10">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-primary mb-4 block">Performance Ratings (1-5)</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {(["collaboration_score", "reliability_score", "quality_score", "innovation_score"] as const).map(field => (
                                    <div key={field} className="space-y-2">
                                        <Label className="capitalize text-[9px] font-bold text-muted-foreground">{field.replace('_score', '')}</Label>
                                        <Select value={String(reviewForm[field])} onValueChange={v => setReviewForm(f => ({ ...f, [field]: Number(v) }))}>
                                            <SelectTrigger className="rounded-lg h-9 border-muted-foreground/20"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-lg">
                                                {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Review Comments</Label>
                            <Textarea
                                value={reviewForm.comments}
                                onChange={e => setReviewForm(f => ({ ...f, comments: e.target.value }))}
                                placeholder="Provide detailed feedback and areas for improvement..."
                                rows={3}
                                className="rounded-xl min-h-[100px] border-muted-foreground/20"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setReviewDialogOpen(false)} className="rounded-xl">Cancel</Button>
                        <Button
                            disabled={!reviewForm.employee_id || !reviewForm.period_start || submitReviewMutation.isPending}
                            onClick={handleSubmitReview}
                            className="rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground font-black px-8 shadow-lg shadow-primary/20"
                        >
                            {submitReviewMutation.isPending ? "Submitting Review..." : "Submit Review"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

import React, { useState } from 'react';
import { Upload, CheckCircle2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { callGroq, isGroqConfigured } from "@/lib/groqClient";
import { supabase } from "@/integrations/supabase/client";

interface TemplateLearningStepProps {
    onComplete: (templateInfo: any) => void;
    onSkip: () => void;
}

const TEMPLATE_ANALYSIS_PROMPT = `You are an Expert Legal Document Architect. 
Analyze the following raw text from a document (which could be an MOU, Menu, or generic file) and map it to a structured format.

TASKS:
1. Identify all dynamic placeholders that need to be filled (e.g., Party Names, Prices, Items).
2. Extract the static "Language" around these placeholders for context.
3. Identify where a "Logo" or "Signature" would likely belong.
4. Categorize the document type (e.g., Caterer, Restaurant, Food Menu, Venue).

YOU MUST RESPOND EXCLUSIVELY IN VALID JSON FORMAT. NO ADDITIONAL TEXT OR MARKDOWN.
JSON STRUCTURE:
{
  "mou_type": "The detected document type",
  "placeholders": [
    { "id": "placeholder_name", "type": "text", "context": "surrounding text snippet" }
  ],
  "branding": {
    "logo_suggested_y": "top",
    "has_tables": true
  },
  "summary": "Short description of what you learned from this document."
}`;

export const TemplateLearningStep: React.FC<TemplateLearningStepProps> = ({ onComplete, onSkip }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [learnedInfo, setLearnedInfo] = useState<any>(null);
    const [extractedText, setExtractedText] = useState<string>("");
    const [showPreview, setShowPreview] = useState<boolean>(false);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || isUploading || isAnalyzing) return;

        if (!isGroqConfigured()) {
            toast.error("Groq API key not configured. Skipping template analysis.");
            onSkip();
            return;
        }

        setIsUploading(true);
        let text = "";
        try {
            if (file.type === "application/pdf") {
                try {
                    const pdfjs = await import("pdfjs-dist");
                    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
                    const arrayBuffer = await file.arrayBuffer();
                    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
                    let fullText = "";
                    for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
                        const page = await pdf.getPage(i);
                        const content = await page.getTextContent();
                        fullText += content.items.map((item: any) => item.str).join(" ") + "\n";
                    }
                    text = fullText;
                } catch (pdfError) {
                    text = await file.text();
                }
            } else {
                text = await file.text();
            }

            if (!text.trim() || text.length < 10) {
                text = `File: ${file.name}\nSize: ${file.size} bytes\n(Manual extraction needed)`;
            }

            // If PDF extraction produced very little text, attempt OCR on first pages
            try {
                if (file.type === 'application/pdf' && text.trim().length < 200) {
                    try {
                        const tesseract = await import('tesseract.js');
                        const pdfjs = await import('pdfjs-dist');
                        const arrayBuffer = await file.arrayBuffer();
                        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
                        let ocrText = '';
                        const pagesToTry = Math.min(pdf.numPages, 3);
                        for (let p = 1; p <= pagesToTry; p++) {
                            const page = await pdf.getPage(p);
                            const viewport = page.getViewport({ scale: 2.0 });
                            const canvas = document.createElement('canvas');
                            canvas.width = Math.floor(viewport.width);
                            canvas.height = Math.floor(viewport.height);
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                                await page.render({ canvasContext: ctx, viewport }).promise;
                                const dataUrl = canvas.toDataURL('image/png');
                                const res = await tesseract.recognize(dataUrl, 'eng');
                                ocrText += res.data.text + '\n';
                            }
                        }
                        if (ocrText.trim().length > text.trim().length) {
                            text = ocrText;
                        }
                    } catch (ocrErr) {
                        console.warn('OCR fallback failed:', ocrErr);
                    }
                }
            } catch (e) {
                console.warn('OCR attempt skipped:', e);
            }

            // Save extracted text and show preview so user can confirm/edit before analysis
            setIsUploading(false);
            setExtractedText(text);
            setShowPreview(true);
            // Do NOT auto-call the AI here — wait for user confirmation

        } catch (error: any) {
            console.error("Analysis failed:", error);
            toast.error("Deep analysis failed: " + (error.message || "Unknown error"));
            setLearnedInfo(null); // Allow re-upload after error
        } finally {
            setIsUploading(false);
            setIsAnalyzing(false);
        }
    };

    // Analyze the extracted text after user confirmation (with retries and fallback)
    const handleAnalyze = async () => {
        const text = extractedText || "";
        if (!text.trim() || text.length < 10) {
            toast.error("Extracted text is too short or empty. Please try a different file.");
            return;
        }
        if (/^[^a-zA-Z0-9]+$/.test(text)) {
            toast.error("Extracted text appears to be unreadable. Please try a different file.");
            return;
        }

        setIsAnalyzing(true);
        let analysisResult: any = null;

        // If text is very long, chunk and extract placeholders per chunk then merge
        const CHUNK_SIZE = 40000;
        if (text.length > 50000) {
            const chunks: string[] = [];
            for (let i = 0; i < text.length; i += CHUNK_SIZE) chunks.push(text.substring(i, i + CHUNK_SIZE));
            const merged: any = { mou_type: null, placeholders: [], branding: { has_tables: false, logo_suggested_y: null }, summary: '' };
            const chunkPrompt = `Extract placeholders, mou_type, branding (has_tables, logo_suggested_y) and a short summary for the given text chunk. Respond with valid JSON.`;
            for (const c of chunks) {
                try {
                    const res = await callGroq(chunkPrompt, `TEXT:\n\n${c.substring(0, 50000)}`, true);
                    if (res) {
                        if (!merged.mou_type && res.mou_type) merged.mou_type = res.mou_type;
                        if (Array.isArray(res.placeholders)) merged.placeholders.push(...res.placeholders);
                        if (res.branding?.has_tables) merged.branding.has_tables = true;
                        if (!merged.branding.logo_suggested_y && res.branding?.logo_suggested_y) merged.branding.logo_suggested_y = res.branding.logo_suggested_y;
                        if (res.summary) merged.summary += (merged.summary ? ' ' : '') + res.summary;
                    }
                } catch (chunkErr) {
                    console.warn('Chunk analysis failed, trying loose mode for chunk:', chunkErr);
                    try {
                        const loose = await callGroq(chunkPrompt, `TEXT:\n\n${c.substring(0, 50000)}`, false);
                        const parsed = JSON.parse(loose);
                        if (!merged.mou_type && parsed.mou_type) merged.mou_type = parsed.mou_type;
                        if (Array.isArray(parsed.placeholders)) merged.placeholders.push(...parsed.placeholders);
                        if (parsed.branding?.has_tables) merged.branding.has_tables = true;
                        if (!merged.branding.logo_suggested_y && parsed.branding?.logo_suggested_y) merged.branding.logo_suggested_y = parsed.branding.logo_suggested_y;
                        if (parsed.summary) merged.summary += (merged.summary ? ' ' : '') + parsed.summary;
                    } catch (finalChunkErr) {
                        console.error('Chunk loose parse failed:', finalChunkErr);
                    }
                }
            }
            // Deduplicate placeholders by id
            const seen = new Set();
            merged.placeholders = merged.placeholders.filter((p: any) => {
                const id = p?.id || JSON.stringify(p);
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
            });
            analysisResult = merged;
        } else {
            // Short/normal flow with retries
            const maxAttempts = 2;
            let attempt = 0;
            while (attempt < maxAttempts) {
                attempt++;
                try {
                    analysisResult = await callGroq(
                        TEMPLATE_ANALYSIS_PROMPT,
                        `Please analyze this document text:\n\n${text.substring(0, 50000)}`,
                        true
                    );
                    break;
                } catch (err) {
                    console.warn(`Analysis attempt ${attempt} failed:`, err);
                    if (attempt >= maxAttempts) {
                        try {
                            const loose = await callGroq(
                                TEMPLATE_ANALYSIS_PROMPT,
                                `Please analyze this document text:\n\n${text.substring(0, 50000)}`,
                                false
                            );
                            analysisResult = JSON.parse(loose);
                            break;
                        } catch (finalErr) {
                            console.error("Final analysis fallback failed:", finalErr);
                            setIsAnalyzing(false);
                            toast.error("AI failed to analyze the document. Try a simpler file or edit the extracted text and retry.");
                            return;
                        }
                    }
                    await new Promise(r => setTimeout(r, 800));
                }
            }
        }

        // Save result to DB (best-effort)
        let templateRecord = { id: 'local-' + Date.now(), ...analysisResult, raw_text: text };
        try {
            const { data: template, error: dbError } = await supabase
                .from('mou_templates' as any)
                .insert({
                    name: 'Uploaded File',
                    raw_text: text,
                    category: analysisResult.mou_type as any,
                    structure_json: analysisResult.placeholders,
                    branding_info: analysisResult.branding
                })
                .select()
                .single();
            if (!dbError && template) templateRecord = template;
        } catch (dbErr) {
            console.warn("Template DB save skipped:", dbErr);
        }

        setLearnedInfo(analysisResult);
        toast.success("Access Protocols Synced");
        setShowPreview(false);
        setTimeout(() => onComplete(templateRecord), 1500);
        setIsAnalyzing(false);
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-1 bg-gradient-to-br from-zinc-100 via-white to-zinc-50 rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-700">
            <div className="bg-white rounded-[2.9rem] p-12 border border-zinc-100 relative overflow-hidden">
                <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
                    {/* Left: Content */}
                    <div className="flex-1 text-left space-y-6">
                        <div className="relative inline-flex">
                            <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full scale-150 animate-pulse" />
                            <div className="relative p-6 rounded-[2rem] bg-gradient-to-br from-primary to-secondary text-white shadow-xl shadow-primary/20">
                                <Bot className="w-10 h-10" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h2 className="text-4xl font-bold text-zinc-900 tracking-tight font-montserrat leading-tight">
                                MOU Structure Analysis
                            </h2>
                            <p className="text-zinc-500 text-lg font-poppins leading-relaxed">
                                Upload your sample MOU. Our AI will analyze the structure to ensure compliance with your unique business standards.
                            </p>
                        </div>

                        <Button
                            variant="ghost"
                            onClick={onSkip}
                            className="text-zinc-400 hover:text-zinc-600 font-poppins"
                        >
                            Skip → Use Standard Template
                        </Button>
                    </div>

                    {/* Right: Upload Zone */}
                    <div className="flex-1 w-full">
                        {!learnedInfo ? (
                            <>
                                <div className="relative group overflow-hidden rounded-[2.5rem]">
                                    <input
                                        type="file"
                                        onChange={handleFileUpload}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                        disabled={isUploading || isAnalyzing}
                                        accept=".pdf,.docx,.txt"
                                    />

                                    <div className={`relative p-12 border-2 border-dashed rounded-[2.5rem] transition-all duration-700 flex flex-col items-center justify-center gap-6 ${isUploading || isAnalyzing
                                        ? 'border-primary bg-primary/5'
                                        : 'border-zinc-200 bg-zinc-50/50 group-hover:border-primary/40 group-hover:bg-white group-hover:shadow-[0_0_50px_rgba(var(--primary-rgb),0.05)]'
                                        }`}>
                                        {isUploading || isAnalyzing ? (
                                            <div className="flex flex-col items-center gap-5 text-primary">
                                                <div className="relative">
                                                    <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                                                    <Bot className="absolute inset-0 m-auto w-7 h-7 text-primary" />
                                                </div>
                                                <div className="text-center">
                                                    <span className="block text-xl font-bold tracking-tight">
                                                        {isAnalyzing ? "Groq Analyzing Structure..." : "Uploading..."}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="p-4 rounded-xl bg-white shadow-lg border border-zinc-100 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500">
                                                    <Upload className="w-8 h-8 text-primary" />
                                                </div>
                                                <div className="text-center space-y-2">
                                                    <span className="block text-xl font-bold text-zinc-900 font-montserrat tracking-tight underline decoration-primary/30 underline-offset-8">
                                                        Start Analysis
                                                    </span>
                                                    <span className="block text-zinc-400 text-sm font-poppins">
                                                        PDF or DOCX documents supported
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {/* Preview panel shown after extraction */}
                                {showPreview && (
                                    <div className="mt-6 p-6 bg-zinc-50 border border-zinc-200 rounded-2xl">
                                        <h3 className="font-bold mb-2 text-zinc-900">Preview Extracted Text</h3>
                                        <textarea
                                            className="w-full h-48 p-2 border border-zinc-300 rounded-lg font-mono text-xs bg-white"
                                            value={extractedText}
                                            onChange={e => setExtractedText(e.target.value)}
                                        />
                                        <div className="flex gap-3 mt-3">
                                            <Button onClick={handleAnalyze} disabled={isAnalyzing} className="bg-primary text-white">Analyze with Lazeez AI Agent</Button>
                                            <Button onClick={() => { setShowPreview(false); setExtractedText(""); }} variant="outline">Cancel</Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="animate-in fade-in zoom-in-95 duration-700">
                                <div className="relative p-8 bg-zinc-50 border-2 border-emerald-100 rounded-[3rem] flex flex-col items-center gap-6 text-emerald-600">
                                    <div className="w-20 h-20 rounded-[1.5rem] bg-white flex items-center justify-center border-4 border-emerald-50 shadow-inner">
                                        <CheckCircle2 className="w-10 h-10" />
                                    </div>
                                    <div className="text-center">
                                        <h4 className="font-bold text-2xl font-montserrat tracking-tight">Sync Complete</h4>
                                        <p className="text-sm font-poppins opacity-70">
                                            {learnedInfo.summary || "Document structure mapped successfully"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-12 pt-6 border-t border-zinc-50 flex items-center justify-center gap-3">
                    <div className="relative flex h-2 w-2">
                        <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></div>
                        <div className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-400 font-mono tracking-[0.3em] uppercase">
                        Lazeez AI Agent Analysis Engine Active
                    </span>
                </div>
            </div>
        </div>
    );
};

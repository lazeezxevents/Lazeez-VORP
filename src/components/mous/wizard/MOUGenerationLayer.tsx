
import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, FileText, Database, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateEliteMOU } from "@/utils/mouPdfGenerator";
import { generateEliteDOCX } from "@/utils/mouDocxGenerator";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Download, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chatWithGroq } from "@/lib/groqClient";

interface MOUGenerationLayerProps {
    category: string;
    conversation: any[];
    template?: any;
    extractedData?: any;
    onComplete: (data: any) => void;
}

const FINAL_ANALYSIS_PROMPT = `You are a Senior Legal Data Analyst for Lazeez Events.
Your task is to analyze the complete conversation history and extract ALL collected vendor data.
    
EXTRACT THESE FIELDS (fill in null for anything not found):
{
  "owner_name": "string",
  "cnic": "string",
  "business_name": "string",
  "phone": "string",
  "bank_details": {"title": "string", "iban": "string", "bank_name": "string"},
  "menu": [{"name": "string", "quantity": "string", "price": "string"}],
  "address": "string",
  "city": "string (extract from address - look for city names like Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta, Sialkot, Gujranwala, etc.)",
  "commission": number,
  "subscription": {"cost": number, "threshold_orders": number},
  "term_months": number
}
    
CRITICAL RULES FOR "menu" ARRAY:
1. Extract EVERY SINGLE ITEM mentioned. Do not limit to 14 items. If there are 50 items, extract all 50.
2. Keep only the final agreed price for each item. Do not include discounted prices or discount calculations.

CRITICAL RULES FOR "city":
1. Extract city name from the address field
2. Common Pakistani cities: Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta, Sialkot, Gujranwala, Hyderabad, Abbottabad, Sargodha, Bahawalpur, Sukkur, Larkana, Sheikhupura, Jhang, Rahim Yar Khan, Gujrat, Kasur, Mardan, Mingora, Dera Ghazi Khan, Sahiwal, Nawabshah, Okara, Gilgit, Mirpur Khas, Chiniot, Sadiqabad, Burewala, Jacobabad, Shikarpur, Khanewal, Hafizabad, Kohat, Muzaffargarh, Khanpur, Gojra, Mandi Bahauddin, Jhelum, Attock

IMPORTANT: Extract ALL data points mentioned across the ENTIRE conversation. Be thorough.
Return ONLY the strictly formatted JSON object above. No extra text or markdown block fences.`;

export const MOUGenerationLayer: React.FC<MOUGenerationLayerProps> = ({ category, conversation, template, extractedData, onComplete }) => {
    const [status, setStatus] = useState<'analyzing' | 'creating_vendor' | 'generating_docs' | 'saving' | 'done'>('analyzing');
    const [localExtractedData, setLocalExtractedData] = useState<any>(null);
    const [resultUrls, setResultUrls] = useState<{ pdf: string; docx: string } | null>(null);
    const { user } = useAuth();

    useEffect(() => {
        const processFlow = async () => {
            try {
                // 1. Initial Check - if extractedData prop is passed, use it directly to skip redundant analysis
                setStatus('analyzing');
                let aiData: any = extractedData;

                if (!aiData && conversation.length > 0) {
                    try {
                        const groqMessages = conversation.map(m => ({
                            role: m.sender === 'user' ? 'user' as const : 'assistant' as const,
                            content: m.text
                        }));
                        aiData = await chatWithGroq(FINAL_ANALYSIS_PROMPT, groqMessages, true);
                    } catch (aiErr) {
                        console.error("AI Final Analysis failed:", aiErr);
                    }
                }

                if (!aiData || !aiData.business_name) {
                    toast.error("Could not extract sufficient data. Please go back and provide more details.");
                    return;
                }

                setLocalExtractedData(aiData);

                // 2. Create Vendor
                setStatus('creating_vendor');

                const validCategories = ['home_chef', 'home_baker', 'bakery', 'catering', 'restaurant'];
                const safeCategory = validCategories.includes(category) ? category : 'home_chef';

                // Smart bank detection
                let bankName = aiData.bank_details?.bank_name || "";
                const ibanOrAccount = aiData.bank_details?.iban || "";

                if (!bankName && ibanOrAccount) {
                    // Auto-detect from IBAN/account number
                    if (ibanOrAccount.toLowerCase().includes('easypaisa') || ibanOrAccount.length === 11) {
                        bankName = "Easypaisa";
                    } else if (ibanOrAccount.toLowerCase().includes('jazz') || ibanOrAccount.toLowerCase().includes('mobilink')) {
                        bankName = "JazzCash";
                    } else if (ibanOrAccount.startsWith('PK')) {
                        bankName = "Bank Account (IBAN)";
                    } else {
                        bankName = "Other";
                    }
                }

                // Extract city from address if not provided
                let city = aiData.city || "";
                if (!city && aiData.address) {
                    const pakistaniCities = [
                        'Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan',
                        'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala', 'Hyderabad', 'Abbottabad',
                        'Sargodha', 'Bahawalpur', 'Sukkur', 'Larkana', 'Sheikhupura', 'Jhang'
                    ];
                    const addressLower = aiData.address.toLowerCase();
                    for (const cityName of pakistaniCities) {
                        if (addressLower.includes(cityName.toLowerCase())) {
                            city = cityName;
                            break;
                        }
                    }
                }

                let vendorData: any;
                try {
                    const { data: vendor, error: vendorError } = await supabase
                        .from("vendors")
                        .insert({
                            name: aiData.business_name,
                            owner_name: aiData.owner_name || "Unknown",
                            owner_cnic: aiData.cnic || "",
                            contact_person: aiData.owner_name || "Owner",
                            phone: aiData.phone || "",
                            email: "",
                            address: aiData.address || "Address not provided",
                            city: city || "",
                            category: safeCategory as any,
                            status: 'pending',
                            commission_percentage: aiData.commission || 14,
                            subscription_amount: aiData.subscription?.cost || 5000,
                            subscription_after_orders: aiData.subscription?.threshold_orders || 5,
                            bank_title: aiData.bank_details?.title || "",
                            bank_account_number: ibanOrAccount,
                            bank_name: bankName,
                            created_by: user?.id
                        })
                        .select()
                        .single();

                    if (vendorError) throw vendorError;
                    vendorData = vendor;
                    toast.success(`Vendor "${vendor.name}" created successfully!`);
                } catch (dbErr) {
                    console.error("Vendor Creation Error:", dbErr);
                    vendorData = { id: 'temp-' + Date.now(), name: aiData.business_name };
                    toast.warning("Vendor creation skipped (offline mode)");
                }

                // 3. Generate PDF and DOCX
                setStatus('generating_docs');
                const pdfRes = generateEliteMOU({ ...aiData, category, templateText: template?.raw_text });
                const docxRes = await generateEliteDOCX({ ...aiData, category, templateText: template?.raw_text });

                // 4. Upload to Storage & Save to MOU Vault
                setStatus('saving');
                try {
                    const pdfPath = `mous/${vendorData.id || 'temp'}/${pdfRes.filename}`;
                    const docxPath = `mous/${vendorData.id || 'temp'}/${docxRes.filename}`;

                    await Promise.all([
                        supabase.storage.from("mou-vault").upload(pdfPath, pdfRes.blob),
                        supabase.storage.from("mou-vault").upload(docxPath, docxRes.blob)
                    ]);

                    // 5. Create MOU Records
                    const { data: mou } = await supabase
                        .from("mous")
                        .insert({
                            vendor_id: vendorData.id,
                            title: `MOU - ${vendorData.name}`,
                            status: 'draft',
                            terms: JSON.stringify(aiData.menu || {}),
                            start_date: new Date().toISOString(),
                            document_url: pdfPath,
                            created_by: user?.id
                        })
                        .select()
                        .single();

                    if (mou) {
                        await supabase.from("mou_vault").insert({
                            vendor_id: vendorData.id,
                            mou_id: mou.id,
                            document_name: pdfRes.filename,
                            document_url: pdfPath,
                            document_type: 'new',
                            extraction_status: 'completed',
                            extraction_confidence: 100,
                            uploaded_by: user?.id
                        });
                    }
                } catch (saveErr) {
                    console.error("Vault saving skipped due to connection issue");
                }

                setResultUrls({
                    pdf: URL.createObjectURL(pdfRes.blob),
                    docx: URL.createObjectURL(docxRes.blob)
                });
                setStatus('done');
                toast.success("MOU Created, Archived & Ready for Download!");

            } catch (error: any) {
                console.error("Workflow Error:", error);
                toast.error("Process Failed: " + error.message);
            }
        };

        processFlow();
    }, []);

    const steps: { key: string; label: string; description: string; icon: any }[] = [
        { key: 'analyzing', label: 'Data Extraction Layer', description: 'Extracting data and mapping to template...', icon: Sparkles },
        { key: 'creating_vendor', label: 'Auto Vendor Creation', description: 'Registering profile automatically...', icon: Database },
        { key: 'generating_docs', label: 'Multi-Format Architect', description: 'Creating PDF and DOCX versions...', icon: FileText },
        { key: 'saving', label: 'MOU Vault Archival', description: 'Uploading and indexing in vault...', icon: ShieldCheck },
    ];

    const currentStepIndex = steps.findIndex(s => s.key === status);

    if (status === 'done') {
        return (
            <div className="w-full max-w-2xl mx-auto space-y-8 py-12 text-center animate-in zoom-in-95 duration-500">
                <div className="inline-flex p-6 rounded-full bg-emerald-50 text-emerald-500 mb-4 border border-emerald-100 shadow-sm">
                    <CheckCircle2 className="w-16 h-16" />
                </div>
                <h2 className="text-4xl font-bold text-zinc-900 tracking-tight font-montserrat">MOU Workflow Complete</h2>
                <p className="text-zinc-500 text-lg font-poppins">Vendor created and MOU archived silently in the vault.</p>

                <div className="grid grid-cols-2 gap-4 mt-8">
                    <Button
                        onClick={() => {
                            const link = document.createElement('a');
                            link.href = resultUrls!.pdf;
                            link.download = `MOU_${localExtractedData?.business_name || 'Vendor'}.pdf`;
                            link.click();
                        }}
                        className="bg-primary hover:bg-primary/90 h-24 rounded-2xl flex flex-col gap-2 shadow-lg shadow-primary/20 font-montserrat"
                    >
                        <Download className="w-6 h-6" />
                        <span>Download PDF</span>
                    </Button>
                    <Button
                        onClick={() => {
                            const link = document.createElement('a');
                            link.href = resultUrls!.docx;
                            link.download = `MOU_${localExtractedData?.business_name || 'Vendor'}.docx`;
                            link.click();
                        }}
                        className="bg-white border-2 border-zinc-200 text-zinc-900 hover:bg-zinc-50 h-24 rounded-2xl flex flex-col gap-2 font-montserrat"
                    >
                        <FileDown className="w-6 h-6" />
                        <span>Download DOCX</span>
                    </Button>
                </div>

                <Button
                    variant="link"
                    onClick={() => onComplete({ vendorId: 'any' })}
                    className="mt-8 text-zinc-400 hover:text-zinc-600 font-poppins"
                >
                    Return to Dashboard
                </Button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto space-y-12 py-12">
            <div className="text-center space-y-4">
                <div className="inline-flex p-4 rounded-2xl bg-primary/5 border border-primary/10 text-primary animate-pulse">
                    <Loader2 className="w-8 h-8 animate-spin" />
                </div>
                <h2 className="text-4xl font-bold text-zinc-900 tracking-tight font-montserrat">Assistant Executing...</h2>
                <p className="text-zinc-500 text-lg font-poppins">Lazeez Assistant is processing your data and generating the MOU.</p>
            </div>

            <div className="space-y-6">
                {steps.map((step, i) => {
                    const isActive = status === step.key;
                    const isDone = currentStepIndex > i || (status as string) === 'done';

                    return (
                        <div key={step.key} className={`relative flex items-center gap-6 p-6 rounded-2xl border transition-all duration-500 ${isActive ? 'bg-white border-primary/30 scale-105 shadow-2xl shadow-primary/10' :
                            isDone ? 'bg-zinc-50 border-emerald-500/10' : 'bg-white border-zinc-100 opacity-50'
                            }`}>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-500 ${isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-zinc-100 text-zinc-400'
                                }`}>
                                {isDone ? <CheckCircle2 className="w-6 h-6" /> : <step.icon className="w-6 h-6" />}
                            </div>
                            <div className="flex-1">
                                <h3 className={`font-bold text-lg font-montserrat ${isDone ? 'text-emerald-600' : isActive ? 'text-zinc-900' : 'text-zinc-400'}`}>
                                    {step.label}
                                </h3>
                                <p className="text-zinc-500 text-sm font-poppins">{step.description}</p>
                            </div>
                            {isActive && (
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0s' }} />
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }} />
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.4s' }} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

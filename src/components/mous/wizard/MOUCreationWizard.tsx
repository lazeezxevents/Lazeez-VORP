
import React, { useState } from 'react';
import { WizardSplashScreen } from './WizardSplashScreen';
import { AIPopupMessage } from './AIPopupMessage';
import { CategorySelectionStep } from './CategorySelectionStep';
import { TemplateLearningStep } from './TemplateLearningStep';
import { AICollectionLayer, Message } from './AICollectionLayer';
import { MOUGenerationLayer } from './MOUGenerationLayer';
// using CSS animations
import { Button } from "@/components/ui/button";
import { X, Loader2, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface MOUCreationWizardProps {
    onClose: () => void;
}

export const MOUCreationWizard: React.FC<MOUCreationWizardProps> = ({ onClose }) => {
    const [step, setStep] = useState<'category' | 'learning' | 'collection' | 'generation'>('category');
    const [category, setCategory] = useState<string>("");
    const [conversation, setConversation] = useState<Message[]>([]);
    const [extractedData, setExtractedData] = useState<any>(null);
    const [learnedTemplate, setLearnedTemplate] = useState<any>(null);
    const [systemMessage, setSystemMessage] = useState<string>("Welcome! Let's start by selecting the business category for this MOU.");

    const navigate = useNavigate();

    const handleCategorySelected = (data: { category: string }) => {
        setCategory(data.category);
        setStep('learning');
        setSystemMessage("Upload a sample MOU so I can analyze your requirements.");
    };

    const handleTemplateLearned = (template: any) => {
        setLearnedTemplate(template);
        setStep('collection');
        setSystemMessage("Please provide the business details. I'll automatically detect them as you speak.");
    };

    const handleSkipLearning = () => {
        setStep('collection');
        setSystemMessage("Using standard structure. Please provide the business details.");
    };

    const handleCollectionComplete = (data: { conversation: Message[], rawData: any }) => {
        setConversation(data.conversation);
        setExtractedData(data.rawData);
        setStep('generation');
        setSystemMessage("Finalizing your professional MOU documents. Almost there!");
    };

    const handleWorkflowComplete = (data: { vendorId: string }) => {
        onClose();
        navigate(`/vendors/${data.vendorId}`);
    };

    const handleBack = () => {
        if (step === 'learning') {
            setStep('category');
            setSystemMessage("Welcome! Let's start by selecting the business category for this MOU.");
        }
        else if (step === 'collection') {
            setStep('learning');
            setSystemMessage("Upload a sample MOU so I can analyze your requirements.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-white text-zinc-900 flex flex-col overflow-hidden animate-in fade-in duration-300 font-poppins">
            <AIPopupMessage message={systemMessage} />
            <div className="flex flex-1 h-full">
                {/* Main Content Area */}
                <div className="flex-1 flex flex-col relative overflow-y-auto">
                    {/* Header / Navigation Buttons */}
                    <div className="absolute top-6 left-6 z-20">
                        {(step === 'learning' || step === 'collection') && (
                            <Button
                                variant="ghost"
                                onClick={handleBack}
                                className="group flex items-center gap-2 text-zinc-500 hover:text-zinc-900 font-bold transition-all hover:-translate-x-1 animate-in slide-in-from-right-4 duration-500"
                            >
                                <ChevronLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                                Back
                            </Button>
                        )}
                    </div>

                    <div className="absolute top-6 right-6 z-20">
                        <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-all hover:rotate-90">
                            <X className="w-6 h-6" />
                        </Button>
                    </div>

                    {/* Steps Content */}
                    <div className="flex-1 flex items-center justify-center p-8 bg-zinc-50/50">
                        <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {step === 'category' && <CategorySelectionStep onNext={handleCategorySelected} />}
                            {step === 'learning' && <TemplateLearningStep onComplete={handleTemplateLearned} onSkip={handleSkipLearning} />}
                            {step === 'collection' && <AICollectionLayer category={category} template={learnedTemplate} onNext={handleCollectionComplete} />}
                            {step === 'generation' && (
                                <MOUGenerationLayer
                                    category={category}
                                    conversation={conversation}
                                    template={learnedTemplate}
                                    extractedData={extractedData}
                                    onComplete={handleWorkflowComplete}
                                />
                            )}
                        </div>
                    </div>

                    {/* Progress / Footer */}
                    <div className="h-20 border-t border-zinc-100 flex items-center px-10 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.03)] shrink-0">
                        <div className="flex gap-3">
                            {['category', 'learning', 'collection', 'generation'].map((s, i) => (
                                <div
                                    key={s}
                                    className={`h-2 w-20 rounded-full transition-all duration-300 ${['category', 'learning', 'collection', 'generation'].indexOf(step) >= i
                                        ? 'bg-primary'
                                        : 'bg-zinc-200'
                                        }`}
                                />
                            ))}
                        </div>
                        <div className="ml-auto text-sm font-medium text-zinc-400 font-mono uppercase tracking-widest">
                            Step {['category', 'learning', 'collection', 'generation'].indexOf(step) + 1} of 4
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

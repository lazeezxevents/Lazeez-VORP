
import React from 'react';
import { ChefHat, Cake, UtensilsCrossed, Store, ArrowRight } from "lucide-react";

interface CategorySelectionStepProps {
    onNext: (data: { category: string }) => void;
}

const categories = [
    {
        id: "home_chef",
        title: "Home Chef",
        icon: ChefHat,
        description: "Individual chefs preparing meals from home.",
        color: "from-orange-500 to-red-500",
        bg: "bg-orange-500/10",
        border: "border-orange-500/20"
    },
    {
        id: "home_baker",
        title: "Home Baker",
        icon: Cake,
        description: "Artisanal baking and desserts from home kitchens.",
        color: "from-pink-500 to-rose-500",
        bg: "bg-pink-500/10",
        border: "border-pink-500/20"
    },
    {
        id: "catering",
        title: "Catering",
        icon: UtensilsCrossed,
        description: "Large scale food service for events and parties.",
        color: "from-blue-500 to-indigo-500",
        bg: "bg-blue-500/10",
        border: "border-blue-500/20"
    },
    {
        id: "restaurant",
        title: "Restaurant",
        icon: Store,
        description: "Commercial establishments with dine-in or takeaway.",
        color: "from-emerald-500 to-teal-500",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20"
    }
];

export const CategorySelectionStep: React.FC<CategorySelectionStepProps> = ({ onNext }) => {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center space-y-4">
                <h2 className="text-3xl md:text-5xl font-bold text-zinc-900 tracking-tight font-montserrat">
                    Who is this MOU for?
                </h2>
                <p className="text-zinc-500 text-lg max-w-2xl mx-auto font-poppins">
                    Select the business category to tailor the agreement terms and structure specifically for their needs.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-12 max-w-5xl mx-auto">
                {categories.map((category) => (
                    <button
                        key={category.id}
                        onClick={() => onNext({ category: category.id })}
                        className="group flex items-center p-8 bg-white rounded-[2rem] border border-zinc-100 shadow-sm transition-all duration-300 hover:shadow-xl hover:border-primary/20 hover:-translate-y-1 text-left"
                    >
                        <div className={`p-5 rounded-2xl ${category.bg} border ${category.border} transition-all duration-300 group-hover:bg-primary group-hover:text-white`}>
                            <category.icon className="w-8 h-8 transition-colors" />
                        </div>
                        <div className="ml-6 space-y-1 flex-1">
                            <h4 className="font-bold text-xl text-zinc-900 font-montserrat group-hover:text-primary transition-colors">
                                {category.title}
                            </h4>
                            <p className="text-zinc-500 text-sm font-poppins leading-relaxed">
                                {category.description}
                            </p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-zinc-300 group-hover:text-primary transition-all group-hover:translate-x-1" />
                    </button>
                ))}
            </div>
        </div>
    );
};


import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { User, Building, MapPin, Phone, ArrowRight, Check } from "lucide-react";

interface VendorDetailsStepProps {
    onNext: (data: any) => void;
}

export const VendorDetailsStep: React.FC<VendorDetailsStepProps> = ({ onNext }) => {
    const [formData, setFormData] = useState({
        name: "",
        owner_name: "",
        phone: "",
        address: ""
    });

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const isValid = formData.name && formData.owner_name && formData.phone;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-white">Vendor Profile</h2>
                <p className="text-zinc-400">Let's get the official details for the agreement.</p>
            </div>

            <div className="grid gap-6 max-w-2xl mx-auto bg-zinc-900/50 p-8 rounded-2xl border border-white/5 backdrop-blur-sm">

                <div className="grid gap-2 group">
                    <Label className="text-zinc-300 group-focus-within:text-indigo-400 transition-colors">Business Name</Label>
                    <div className="relative">
                        <Building className="absolute left-3 top-3 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-500 transition-colors" />
                        <Input
                            value={formData.name}
                            onChange={(e) => handleChange("name", e.target.value)}
                            className="pl-10 bg-zinc-800/50 border-white/10 focus:border-indigo-500/50 focus:ring-indigo-500/20 text-white h-12 text-lg"
                            placeholder="e.g. Spice Route Kitchen"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="grid gap-2 group">
                        <Label className="text-zinc-300 group-focus-within:text-indigo-400 transition-colors">Owner Name</Label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-500 transition-colors" />
                            <Input
                                value={formData.owner_name}
                                onChange={(e) => handleChange("owner_name", e.target.value)}
                                className="pl-10 bg-zinc-800/50 border-white/10 focus:border-indigo-500/50 focus:ring-indigo-500/20 text-white h-12"
                                placeholder="Full Legal Name"
                            />
                        </div>
                    </div>

                    <div className="grid gap-2 group">
                        <Label className="text-zinc-300 group-focus-within:text-indigo-400 transition-colors">Contact Phone</Label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-3 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-500 transition-colors" />
                            <Input
                                value={formData.phone}
                                onChange={(e) => handleChange("phone", e.target.value)}
                                className="pl-10 bg-zinc-800/50 border-white/10 focus:border-indigo-500/50 focus:ring-indigo-500/20 text-white h-12"
                                placeholder="+92 300 1234567"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid gap-2 group">
                    <Label className="text-zinc-300 group-focus-within:text-indigo-400 transition-colors">Official Address</Label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-3 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-500 transition-colors" />
                        <Input
                            value={formData.address}
                            onChange={(e) => handleChange("address", e.target.value)}
                            className="pl-10 bg-zinc-800/50 border-white/10 focus:border-indigo-500/50 focus:ring-indigo-500/20 text-white h-12"
                            placeholder="Street, Area, City"
                        />
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <Button
                        onClick={() => onNext({ vendor: formData })}
                        disabled={!isValid}
                        size="lg"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full px-8 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
                    >
                        Continue to Terms
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </div>

            </div>
        </div>
    );
};

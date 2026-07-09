import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Building2 } from 'lucide-react';
import { VendorFinancialProfile } from './VendorFinancialProfile';

export const VendorFinancialProfileList = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

  const { data: vendors, isLoading } = useQuery({
    queryKey: ['vendors-with-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select(`
          id,
          name,
          email,
          phone,
          finance_vendor_profiles (
            id,
            commission_model,
            commission_rate,
            total_revenue,
            outstanding_balance
          )
        `)
        .order('name');

      if (error) throw error;
      return data;
    }
  });

  const filteredVendors = vendors?.filter(vendor =>
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vendor.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedVendorId) {
    return (
      <div>
        <button
          onClick={() => setSelectedVendorId(null)}
          className="text-sm text-primary hover:underline mb-4"
        >
          ← Back to vendor list
        </button>
        <VendorFinancialProfile vendorId={selectedVendorId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search vendors..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Vendor List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filteredVendors && filteredVendors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVendors.map((vendor) => (
            <Card
              key={vendor.id}
              className="hover-lift cursor-pointer transition-all duration-300"
              onClick={() => setSelectedVendorId(vendor.id)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{vendor.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{vendor.email}</p>
                    
                    {vendor.finance_vendor_profiles && vendor.finance_vendor_profiles.length > 0 ? (
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Revenue</span>
                          <span className="font-medium">
                            PKR {Number(vendor.finance_vendor_profiles[0].total_revenue || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Outstanding</span>
                          <span className="font-medium text-warning">
                            PKR {Number(vendor.finance_vendor_profiles[0].outstanding_balance || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2">No financial profile</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No vendors found</p>
          <p className="text-sm">Try adjusting your search</p>
        </div>
      )}
    </div>
  );
};

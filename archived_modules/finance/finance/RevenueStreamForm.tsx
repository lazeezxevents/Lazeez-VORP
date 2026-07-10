import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type StreamType = 'commission' | 'subscription';

interface Props {
  onSaved?: () => void;
}

export const RevenueStreamForm: React.FC<Props> = ({ onSaved }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<StreamType>('commission');
  const [percent, setPercent] = useState<number | ''>('' as any);
  const [monthlyAmount, setMonthlyAmount] = useState<number | ''>('' as any);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName('');
    setType('commission');
    setPercent('' as any);
    setMonthlyAmount('' as any);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    if (type === 'commission' && (percent === '' || percent < 0 || percent > 100)) {
      toast.error('Enter a valid commission percent (0-100)');
      return;
    }

    if (type === 'subscription' && (monthlyAmount === '' || monthlyAmount < 0)) {
      toast.error('Enter a valid monthly amount');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        stream_type: type,
        is_active: true,
        created_at: new Date().toISOString()
      };
      if (type === 'commission') payload.commission_percent = percent || 0;
      if (type === 'subscription') payload.monthly_amount = monthlyAmount || 0;

      const { data, error } = await supabase
        .from('finance_revenue_streams')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      toast.success('Revenue stream created');
      reset();
      onSaved?.();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to create revenue stream');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 p-3 border rounded-md">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="E.g., Platform commissions" />
        </div>
        <div>
          <Label>Type</Label>
          <Select onValueChange={(v) => setType(v as StreamType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="commission">Commission (percentage)</SelectItem>
              <SelectItem value="subscription">Subscription (monthly)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Value</Label>
          {type === 'commission' ? (
            <Input type="number" value={percent as any} onChange={(e) => setPercent(Number(e.target.value))} placeholder="%" />
          ) : (
            <Input type="number" value={monthlyAmount as any} onChange={(e) => setMonthlyAmount(Number(e.target.value))} placeholder="Monthly amount" />
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={reset}>Reset</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      </div>
    </div>
  );
};

export default RevenueStreamForm;

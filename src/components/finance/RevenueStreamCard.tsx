import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  stream: any;
  onSaved?: () => void;
}

export const RevenueStreamCard: React.FC<Props> = ({ stream, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(stream.name || '');
  const [commissionPercent, setCommissionPercent] = useState(stream.commission_percent ?? 0);
  const [monthlyAmount, setMonthlyAmount] = useState(stream.monthly_amount ?? 0);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = { name, updated_at: new Date().toISOString() };
      if (stream.stream_type === 'commission') payload.commission_percent = commissionPercent;
      if (stream.stream_type === 'subscription') payload.monthly_amount = monthlyAmount;

      const { error } = await supabase.from('finance_revenue_streams').update(payload).eq('id', stream.id);
      if (error) throw error;
      toast.success('Saved');
      setEditing(false);
      onSaved?.();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{stream.name}</CardTitle>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            {stream.stream_type === 'commission' ? (
              <Input type="number" value={commissionPercent as any} onChange={(e) => setCommissionPercent(Number(e.target.value))} />
            ) : (
              <Input type="number" value={monthlyAmount as any} onChange={(e) => setMonthlyAmount(Number(e.target.value))} />
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">{stream.stream_type}</div>
              <div className="font-medium">
                {stream.stream_type === 'commission' ? `${stream.commission_percent}%` : `₨${Number(stream.monthly_amount || 0).toLocaleString('en-PK')}/mo`}
              </div>
            </div>
            <div>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RevenueStreamCard;

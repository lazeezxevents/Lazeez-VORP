import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/components/lib/utils";
import { extractPrimaryUrlForPreview } from "@/lib/communication/linkPreview";

export type LinkPreviewPayload = {
  ok?: boolean;
  url: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  site_name?: string | null;
  provider?: string;
  error?: string;
};

function useLinkPreview(url: string | null) {
  return useQuery({
    queryKey: ["link-preview", url],
    queryFn: async (): Promise<LinkPreviewPayload> => {
      if (!url) throw new Error("no url");
      const { data, error } = await supabase.functions.invoke<LinkPreviewPayload>("link-preview", {
        body: { url },
      });
      if (error) throw error;
      if (!data || (data as LinkPreviewPayload).error) {
        throw new Error((data as LinkPreviewPayload | null)?.error || "preview failed");
      }
      return data as LinkPreviewPayload;
    },
    enabled: !!url,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}

export function LinkPreviewCard({ rawContent, className }: { rawContent: string; className?: string }) {
  const url = extractPrimaryUrlForPreview(rawContent);
  const { data, isLoading, isError } = useLinkPreview(url);

  if (!url) return null;

  if (isLoading) {
    return (
      <div
        className={cn(
          "mt-2 flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground",
          className
        )}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />
        Loading link preview…
      </div>
    );
  }

  if (isError || !data?.ok) return null;

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "mt-2 flex max-w-lg overflow-hidden rounded-lg border bg-card text-left shadow-sm transition-colors hover:bg-accent/40",
        className
      )}
    >
      {data.image ? (
        <div className="w-28 shrink-0 bg-muted">
          <img src={data.image} alt="" className="h-full w-full object-cover max-h-24" loading="lazy" />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-3">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground truncate">
          {data.site_name || "Link"}
        </span>
        <span className="text-sm font-semibold text-foreground line-clamp-2">{data.title}</span>
        {data.description ? (
          <span className="text-xs text-muted-foreground line-clamp-2">{data.description}</span>
        ) : null}
      </div>
    </a>
  );
}

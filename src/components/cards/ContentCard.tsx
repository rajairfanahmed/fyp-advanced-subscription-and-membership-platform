import React from "react";
import { Button } from "@/components/ui/Button";

interface ContentCardProps {
  title: string;
  description: string;
  type: "Video" | "Article" | "Download";
  accessLevel: "Free" | "Basic" | "Premium";
  imageUrl?: string;
}

export function ContentCard({
  title,
  description,
  type,
  accessLevel,
  imageUrl,
}: ContentCardProps) {
  const isLocked = accessLevel !== "Free";

  return (
    <div className="flex flex-col rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
      {/* Thumbnail Placeholder */}
      <div className="relative h-48 bg-slate-100 w-full overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- thumbnails come from creator-uploaded R2 URLs that bypass Next image-loader configuration.
          <img src={imageUrl} alt={title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
             <svg className="w-12 h-12 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
             </svg>
          </div>
        )}
        
        {/* Type Badge */}
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-md text-xs font-semibold text-slate-700 shadow-sm">
          {type}
        </div>

        {/* Lock Overlay if locked */}
        {isLocked && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center">
            <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
              <svg className="w-4 h-4 text-slate-700" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-bold text-slate-800">{accessLevel} Only</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 flex flex-col flex-1">
        <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-2">{title}</h3>
        <p className="text-slate-600 text-sm mb-6 line-clamp-3 flex-1">{description}</p>
        
        {isLocked ? (
           <Button variant="outline" className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50" href="/pricing">
             Unlock Access
           </Button>
        ) : (
           <Button variant="secondary" className="w-full" href="/auth/register">
             View Content
           </Button>
        )}
      </div>
    </div>
  );
}

import React from 'react';

const ConceptCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-lg border border-white/20 overflow-hidden animate-pulse">
      <div className="w-full h-48 bg-slate-300/30"></div>
      <div className="p-6">
        <div className="h-6 w-3/4 bg-slate-300/30 rounded-md mb-4"></div>
        <div className="h-4 w-full bg-slate-300/30 rounded-md mb-2"></div>
        <div className="h-4 w-5/6 bg-slate-300/30 rounded-md mb-6"></div>
        <div className="flex flex-wrap gap-2 mb-6">
          <div className="h-6 w-20 bg-slate-300/30 rounded-full"></div>
          <div className="h-6 w-24 bg-slate-300/30 rounded-full"></div>
        </div>
        <div className="h-10 w-full bg-slate-300/30 rounded-md mb-3"></div>
        <div className="h-10 w-full bg-slate-300/30 rounded-md"></div>
      </div>
    </div>
  );
};

export default ConceptCardSkeleton;

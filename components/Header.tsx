import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="flex flex-col items-center space-y-4">
      <div className="w-12 h-12 bg-acid-lime rounded-full flex items-center justify-center shadow-lg shadow-[#ccff0033]">
        <div className="w-4 h-4 bg-white rounded-sm rotate-45"></div>
      </div>
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-light tracking-tight italic">
          info<span className="font-semibold not-italic">nugget</span>
        </h1>
        <p className="text-zinc-600 text-sm font-light max-w-xs">
          Condense knowledge into digestible insights.
        </p>
      </div>
    </header>
  );
};

export default Header;
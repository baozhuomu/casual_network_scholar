import React from 'react';

interface ProgressBarProps {
  progress: number; // 0 to 100
  className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, className = "" }) => {
  return (
    <div className={`w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-600 ${className}`}>
      <div
        className="bg-purple-500 h-1.5 rounded-full transition-width duration-300 ease-linear"
        style={{ width: `${progress}%` }}
      ></div>
    </div>
  );
};

export default ProgressBar;

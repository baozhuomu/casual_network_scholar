
import React from 'react';
import { AppStep } from '../types';
import { UploadIcon } from './icons/UploadIcon';
import { GraphIcon } from './icons/GraphIcon';
import { IdeaIcon } from './icons/IdeaIcon';
import { SunIcon } from './icons/SunIcon';
import { MoonIcon } from './icons/MoonIcon';

interface HeaderProps {
  appStep: AppStep;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  resetApp: () => void;
}

const steps = [
  { id: AppStep.Upload, name: '上传与解析', icon: <UploadIcon /> },
  { id: AppStep.Extract, name: '提取变量', icon: <UploadIcon /> },
  { id: AppStep.Visualize, name: '可视化网络', icon: <GraphIcon /> },
  { id: AppStep.Generate, name: '生成主题', icon: <IdeaIcon /> },
];

const Header: React.FC<HeaderProps> = ({ appStep, theme, toggleTheme, resetApp }) => {
  const currentStepIndex = steps.findIndex(s => s.id === appStep || (appStep === AppStep.Extract && s.id === AppStep.Upload));
  
  return (
    <header className="p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="max-w-screen-2xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-3 cursor-pointer" onClick={resetApp}>
           <GraphIcon className="w-8 h-8 text-primary-500" />
           <h1 className="text-xl font-bold text-gray-800 dark:text-white">因果图谱学者</h1>
        </div>
        
        <div className="flex-1 flex justify-center items-center px-8">
            <div className="w-full max-w-lg">
                <ol className="flex items-center w-full">
                    {steps.map((step, index) => {
                        const isCompleted = index < currentStepIndex;
                        const isCurrent = index === currentStepIndex || (appStep === AppStep.Generate && step.id === AppStep.Generate);
                        const effectiveStepName = appStep === AppStep.Extract && step.id === AppStep.Upload ? AppStep.Extract : step.name;

                        return (
                            <li key={step.id} className={`flex w-full items-center ${index < steps.length - 1 ? "after:content-[''] after:w-full after:h-1 after:border-b after:border-gray-200 dark:after:border-gray-700 after:inline-block" : ""}`}>
                                <span className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0
                                    ${isCompleted ? 'bg-primary-600 text-white' : ''}
                                    ${isCurrent ? 'bg-primary-500 text-white animate-pulse' : ''}
                                    ${!isCompleted && !isCurrent ? 'bg-gray-100 dark:bg-gray-700' : ''}
                                `}>
                                    {step.icon}
                                </span>
                                <span className={`absolute mt-16 text-xs font-medium ${isCurrent ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'}`}>{effectiveStepName}</span>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </div>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
};

export default Header;
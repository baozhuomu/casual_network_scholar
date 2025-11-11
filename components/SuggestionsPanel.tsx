
import React from 'react';
import { TopicSuggestion } from '../types';
import { IdeaIcon } from './icons/IdeaIcon';
import { RefreshIcon } from './icons/RefreshIcon';

interface SuggestionsPanelProps {
  topics: TopicSuggestion[];
  onRefresh: () => void;
  isRefreshing: boolean;
}

const SuggestionCard: React.FC<{ topic: TopicSuggestion, index: number }> = ({ topic, index }) => {
  const copyToClipboard = () => {
    const textToCopy = `
研究主题 ${index + 1}: ${topic.topic}
研究假设: ${topic.hypothesis}
创新性: ${topic.innovation}
可行性: ${topic.feasibility}
    `;
    navigator.clipboard.writeText(textToCopy.trim());
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600 space-y-3">
      <div className="flex justify-between items-start">
        <h3 className="font-semibold text-base text-primary-700 dark:text-primary-400">
          {index + 1}. {topic.topic}
        </h3>
        <button onClick={copyToClipboard} className="text-gray-400 hover:text-primary-500 transition-colors p-1" title="复制到剪贴板">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        </button>
      </div>
      <p className="text-sm"><strong className="font-medium text-gray-600 dark:text-gray-300">研究假设:</strong> {topic.hypothesis}</p>
      <p className="text-sm"><strong className="font-medium text-gray-600 dark:text-gray-300">创新性:</strong> {topic.innovation}</p>
      <p className="text-sm"><strong className="font-medium text-gray-600 dark:text-gray-300">可行性:</strong> {topic.feasibility}</p>
    </div>
  );
};


const SuggestionsPanel: React.FC<SuggestionsPanelProps> = ({ topics, onRefresh, isRefreshing }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
            <IdeaIcon className="w-5 h-5"/>
            研究主题建议
        </div>
        {topics.length > 0 && (
            <button 
                onClick={onRefresh} 
                disabled={isRefreshing}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="生成新建议"
            >
                <RefreshIcon className={`w-4 h-4 text-gray-500 dark:text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
        )}
      </h2>
      {topics.length > 0 ? (
        <div className="space-y-4 overflow-y-auto flex-grow pr-2">
          {topics.map((topic, index) => (
            <SuggestionCard key={index} topic={topic} index={index} />
          ))}
        </div>
      ) : (
        <div className="flex-grow flex items-center justify-center">
            <div className="text-center text-gray-400 dark:text-gray-500">
                <IdeaIcon className="w-12 h-12 mx-auto mb-2"/>
                <p>新的研究主题将在此处生成。</p>
            </div>
        </div>
      )}
    </div>
  );
};

export default SuggestionsPanel;
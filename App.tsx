import React, { useState, useEffect, useCallback } from 'react';
import { AppStep, Paper, GraphData, TopicSuggestion, Concept } from './types';
import Header from './components/Header';
import FileUploadPanel from './components/FileUploadPanel';
import GraphPanel from './components/GraphPanel';
import SuggestionsPanel from './components/SuggestionsPanel';
import ClusterPanel from './components/ClusterPanel';
import { extractCausalGraph, generateTopicSuggestions, detectDominantLanguage } from './services/geminiService';

// Add mammoth and Tesseract to the window interface for TypeScript
declare global {
  interface Window {
    mammoth: any;
    Tesseract: any;
  }
}

// Import pdf.js via the import map
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

const PARSING_TIMEOUT = 30000; // 30 seconds
const OCR_TIMEOUT = 60000; // 1 minute

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [appStep, setAppStep] = useState<AppStep>(AppStep.Upload);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [topics, setTopics] = useState<TopicSuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const parsePdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map((item: any) => item.str).join(' ');
      fullText += '\n';
    }
    return fullText;
  };

  const parseDocx = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  const ocrPdf = async (file: File, paperId: string): Promise<string> => {
    const worker = await window.Tesseract.createWorker({
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          const progress = Math.round(m.progress * 100);
          setPapers(prev => prev.map(p =>
            p.id === paperId ? { ...p, message: `文本识别中... ${progress}%`, progress: progress } : p
          ));
        } else {
           setPapers(prev => prev.map(p =>
            p.id === paperId ? { ...p, message: `OCR: ${m.status}...` } : p
          ));
        }
      },
    });
    // Load English and Simplified Chinese languages
    await worker.loadLanguage('eng+chi_sim');
    await worker.initialize('eng+chi_sim');
    const { data: { text } } = await worker.recognize(file);
    await worker.terminate();
    return text;
  };
  
  const withTimeout = <T,>(promise: Promise<T>, ms: number, errorMessage = '操作超时'): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(errorMessage));
      }, ms);

      promise.then(
        (res) => {
          clearTimeout(timeoutId);
          resolve(res);
        },
        (err) => {
          clearTimeout(timeoutId);
          reject(err);
        }
      );
    });
  };


  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Correctly limit the number of files to respect the 100-file maximum.
    const filesToAdd = Array.from(files).slice(0, 100 - papers.length);

    if (filesToAdd.length === 0) {
      // Optionally, you could set an error message here to inform the user.
      return;
    }
    
    const newPapers: Paper[] = filesToAdd.map(file => ({
        id: `${file.name}-${Date.now()}`,
        name: file.name,
        status: 'parsing',
      }));

    setPapers(prev => [...prev, ...newPapers]);

    for (const paper of newPapers) {
      // Find the corresponding File object from the list of files being added.
      const file = filesToAdd.find(f => paper.id.startsWith(f.name));
      if (!file) continue;

      try {
        let content: string;
        if (file.type === 'text/plain') {
          content = await withTimeout(file.text(), PARSING_TIMEOUT);
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
          content = await withTimeout(parseDocx(file), PARSING_TIMEOUT);
        } else if (file.type === 'application/pdf') {
          // Attempt 1: Fast text extraction
          const textContent = await withTimeout(parsePdf(file), PARSING_TIMEOUT, '初步文本提取超时。');
          
          // Attempt 2: If not enough text, fallback to OCR
          if (textContent.trim().length < 100) {
              setPapers(prev => prev.map(p => p.id === paper.id ? { ...p, status: 'ocr', message: '未找到文本，尝试OCR识别...', progress: 0 } : p));
              content = await withTimeout(
                  ocrPdf(file, paper.id),
                  OCR_TIMEOUT,
                  'OCR处理超时。文件可能过于复杂。'
              );
          } else {
              content = textContent;
          }
        } else {
          throw new Error(`不支持的文件类型: ${file.type || '未知'}`);
        }
        
        if (!content || content.trim().length < 100) { // Check for minimal content after all attempts
            throw new Error('未能提取有效文本。文件可能是扫描图像、空文件或已损坏。');
        }

        setPapers(prev => prev.map(p => p.id === paper.id ? { ...p, status: 'ready', content, message: '准备就绪', progress: undefined } : p));
      } catch (e: any) {
        console.error("Failed to parse file:", paper.name, e);
        setPapers(prev => prev.map(p => p.id === paper.id ? { ...p, status: 'error', message: e.message || '解析失败', progress: undefined } : p));
      }

      // Mitigate memory pressure: Add a small delay between processing each file.
      // This gives the browser's garbage collector a chance to run, which is crucial
      // when processing multiple large files that may require memory-intensive OCR.
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  };
  
  const removePaper = (id: string) => {
    setPapers(papers.filter(p => p.id !== id));
  };

  const handleAnalysis = useCallback(async () => {
    const validPapers = papers.filter(p => p.status === 'ready' && p.content);
    if (validPapers.length === 0) {
      setError("没有准备好可供分析的文献。");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setGraphData({ nodes: [], links: [] });
    setTopics([]);
    setConcepts([]);
    setAppStep(AppStep.Extract);

    try {
      const contents = validPapers.map(p => p.content!);
      const { graphData: newGraphData, concepts: newConcepts } = await extractCausalGraph(contents);
      
      setGraphData(newGraphData);
      setConcepts(newConcepts);
      setAppStep(AppStep.Visualize);

      // After visualizing the graph, automatically generate the first set of topics
      setIsGeneratingSuggestions(true);
      setAppStep(AppStep.Generate);
      const dominantLanguage = detectDominantLanguage(contents);
      const newTopics = await generateTopicSuggestions(newGraphData, newConcepts, dominantLanguage);
      setTopics(newTopics);

    } catch (e: any) {
      console.error("Analysis failed:", e);
      setError(e.message || "分析文献时发生未知错误。");
      setAppStep(AppStep.Upload); // Revert to upload step on failure
    } finally {
      setIsAnalyzing(false);
      setIsGeneratingSuggestions(false);
    }
  }, [papers]);
  
  const handleGenerateNewTopics = useCallback(async () => {
    if (!graphData.nodes.length) {
      setError("无法生成建议，因为没有可用的因果图谱。");
      return;
    }
    setIsGeneratingSuggestions(true);
    setError(null);
    try {
      const contents = papers.filter(p => p.status === 'ready' && p.content).map(p => p.content!);
      const dominantLanguage = detectDominantLanguage(contents);
      const newTopics = await generateTopicSuggestions(graphData, concepts, dominantLanguage);
      setTopics(newTopics);
    } catch (e: any)      {
      console.error("Failed to generate new topics:", e);
      setError(e.message || "生成新主题时发生错误。");
    } finally {
      setIsGeneratingSuggestions(false);
    }
  }, [graphData, concepts, papers]);

  const resetApp = () => {
    setAppStep(AppStep.Upload);
    setPapers([]);
    setGraphData({ nodes: [], links: [] });
    setConcepts([]);
    setTopics([]);
    setIsAnalyzing(false);
    setIsGeneratingSuggestions(false);
    setError(null);
  };

  return (
    <div className={`min-h-screen font-sans text-gray-900 dark:text-gray-100 ${theme}`}>
      <Header appStep={appStep} theme={theme} toggleTheme={toggleTheme} resetApp={resetApp} />
      <main className="p-4 sm:p-6 lg:p-8 max-w-screen-2xl mx-auto">
        {appStep === AppStep.Upload || appStep === AppStep.Extract ? (
          <div className="max-w-2xl mx-auto">
            <FileUploadPanel
              papers={papers}
              onFileChange={handleFileChange}
              onRemovePaper={removePaper}
              onAnalyze={handleAnalysis}
              isLoading={isAnalyzing}
              error={error}
              isCollapsed={false}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-120px)]">
            <div className="lg:col-span-3 h-full">
                <FileUploadPanel
                    papers={papers}
                    onFileChange={handleFileChange}
                    onRemovePaper={removePaper}
                    onAnalyze={handleAnalysis}
                    isLoading={isAnalyzing}
                    error={error}
                    isCollapsed={true}
                />
            </div>
            <div className="lg:col-span-6 h-full">
              <GraphPanel graphData={graphData} />
            </div>
            <div className="lg:col-span-3 h-full flex flex-col gap-6">
              <div className="flex-1 min-h-0">
                  <ClusterPanel concepts={concepts} onConceptsChange={setConcepts} />
              </div>
              <div className="flex-1 min-h-0">
                  <SuggestionsPanel 
                    topics={topics} 
                    onRefresh={handleGenerateNewTopics}
                    isRefreshing={isGeneratingSuggestions}
                  />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { AppStep, Paper, GraphData, TopicSuggestion, Concept } from './types';
import Header from './components/Header';
import FileUploadPanel from './components/FileUploadPanel';
import GraphPanel from './components/GraphPanel';
import SuggestionsPanel from './components/SuggestionsPanel';
import ClusterPanel from './components/ClusterPanel';
import { extractAndSuggest } from './services/geminiService';

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
  const [isLoading, setIsLoading] = useState<boolean>(false);
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
    const validPapers = papers.filter(p => p.status === 'ready' && p.content && p.content.trim().length > 10);
    if (validPapers.length === 0) {
      setError("请上传并处理至少一篇有效的文献。");
      return;
    }

    setIsLoading(true);
    setError(null);
    setAppStep(AppStep.Extract);

    try {
      const paperContents = validPapers.map(p => p.content!);
      const result = await extractAndSuggest(paperContents);
      
      setAppStep(AppStep.Visualize);
      setGraphData(result.graphData);
      setConcepts(result.concepts);
      
      setAppStep(AppStep.Generate);
      setTopics(result.topics);
      
    } catch (e) {
      console.error(e);
      setError("分析文献失败。AI模型可能不可用或内容无效，请重试。");
      setAppStep(AppStep.Upload);
    } finally {
      setIsLoading(false);
    }
  }, [papers]);

  const handleConceptsChange = (newConcepts: Concept[]) => {
      setConcepts(newConcepts);

      // Create a map for quick lookup of a variable's new concept group.
      const variableToConceptMap = new Map<string, string>();
      newConcepts.forEach(concept => {
          concept.children.forEach(node => {
              variableToConceptMap.set(node.id, concept.name);
          });
      });

      // Update the 'group' property of each node in the graphData state.
      // This ensures that node colors in the D3 graph update to reflect the new cluster.
      setGraphData(prevData => ({
          ...prevData,
          nodes: prevData.nodes.map(node => ({
              ...node,
              group: variableToConceptMap.get(node.id) || node.group, // Fallback to old group if not found
          })),
      }));
  };

  const resetApp = () => {
    setAppStep(AppStep.Upload);
    setPapers([]);
    setGraphData({ nodes: [], links: [] });
    setConcepts([]);
    setTopics([]);
    setError(null);
    setIsLoading(false);
  }

  return (
    <div className="min-h-screen font-sans text-gray-800 bg-gray-50 dark:bg-gray-900 dark:text-gray-200 transition-colors duration-300">
      <Header appStep={appStep} theme={theme} toggleTheme={toggleTheme} resetApp={resetApp} />
      <main className="p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-100px)]">
          
          <div className={`transition-all duration-500 ${appStep === AppStep.Upload ? 'lg:col-span-12' : 'lg:col-span-2'}`}>
            <FileUploadPanel 
              papers={papers}
              onFileChange={handleFileChange}
              onRemovePaper={removePaper}
              onAnalyze={handleAnalysis}
              isLoading={isLoading}
              error={error}
              isCollapsed={appStep !== AppStep.Upload}
            />
          </div>

          {appStep !== AppStep.Upload && (
            <>
              <div className="lg:col-span-3 h-full">
                <ClusterPanel concepts={concepts} onConceptsChange={handleConceptsChange} />
              </div>
              <div className="lg:col-span-4 h-full">
                <GraphPanel graphData={graphData} />
              </div>
              <div className="lg:col-span-3 h-full">
                <SuggestionsPanel topics={topics} />
              </div>
            </>
          )}

        </div>
      </main>
    </div>
  );
}

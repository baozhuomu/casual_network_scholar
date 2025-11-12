import React, { useState, useRef, useMemo } from 'react';
import { Concept, GraphNode } from '../types';
import { HierarchyIcon } from './icons/HierarchyIcon';
import { CloseIcon } from './icons/CloseIcon';
import { PlusIcon } from './icons/PlusIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { SearchIcon } from './icons/SearchIcon';


interface ClusterPanelProps {
  concepts: Concept[];
  onConceptsChange: (concepts: Concept[]) => void;
}

interface DraggedNode {
    node: GraphNode;
    sourceConceptId: string;
}

interface DraggedConcept {
    conceptId: string;
    index: number;
}

const ClusterPanel: React.FC<ClusterPanelProps> = ({ concepts, onConceptsChange }) => {
    const [draggedNode, setDraggedNode] = useState<DraggedNode | null>(null);
    const [draggedConcept, setDraggedConcept] = useState<DraggedConcept | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [collapsedConcepts, setCollapsedConcepts] = useState<Set<string>>(new Set());
    const [isAddingConcept, setIsAddingConcept] = useState(false);
    const newConceptInputRef = useRef<HTMLInputElement>(null);

    const filteredConcepts = useMemo(() => {
        if (!searchTerm) return concepts;
        const lowercasedFilter = searchTerm.toLowerCase();
        return concepts.filter(concept =>
            concept.name.toLowerCase().includes(lowercasedFilter) ||
            concept.children.some(node => node.id.toLowerCase().includes(lowercasedFilter))
        );
    }, [concepts, searchTerm]);

    const handleNodeDragStart = (node: GraphNode, sourceConceptId: string) => {
        setDraggedNode({ node, sourceConceptId });
    };

    const handleConceptDragStart = (conceptId: string, index: number) => {
        setDraggedConcept({ conceptId, index });
    };

    const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
        e.preventDefault();
        e.currentTarget.classList.add('bg-primary-100', 'dark:bg-primary-900/50');
    };
    
    const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
        e.currentTarget.classList.remove('bg-primary-100', 'dark:bg-primary-900/50');
    };

    const handleNodeDrop = (targetConceptId: string) => {
        if (!draggedNode || draggedNode.sourceConceptId === targetConceptId) return;
        
        const { node, sourceConceptId } = draggedNode;
        const newConcepts = concepts.map(c => ({ ...c, children: [...c.children] }));

        const sourceConcept = newConcepts.find(c => c.id === sourceConceptId);
        if(sourceConcept) sourceConcept.children = sourceConcept.children.filter(child => child.id !== node.id);

        const targetConcept = newConcepts.find(c => c.id === targetConceptId);
        if(targetConcept) targetConcept.children.push(node);

        onConceptsChange(newConcepts);
        setDraggedNode(null);
    };

    const handleConceptDrop = (targetIndex: number) => {
        if (!draggedConcept || draggedConcept.index === targetIndex) return;
        const newConcepts = [...concepts];
        const [removed] = newConcepts.splice(draggedConcept.index, 1);
        newConcepts.splice(targetIndex, 0, removed);
        onConceptsChange(newConcepts);
        setDraggedConcept(null);
    }
    
    const removeNodeFromConcept = (nodeId: string, conceptId: string) => {
        const newConcepts = concepts.map(c => {
            if (c.id === conceptId) {
                return { ...c, children: c.children.filter(child => child.id !== nodeId) };
            }
            return c;
        });
        onConceptsChange(newConcepts);
    };

    const deleteConcept = (conceptId: string) => {
        onConceptsChange(concepts.filter(c => c.id !== conceptId));
    };

    const handleAddConcept = () => {
        const name = newConceptInputRef.current?.value.trim();
        if (name) {
            const newConcept: Concept = {
                id: `${name}-${Date.now()}`,
                name: name,
                children: [],
            };
            onConceptsChange([...concepts, newConcept]);
            setIsAddingConcept(false);
        }
    };
    
    const toggleCollapse = (conceptId: string) => {
        setCollapsedConcepts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(conceptId)) {
                newSet.delete(conceptId);
            } else {
                newSet.add(conceptId);
            }
            return newSet;
        });
    };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 h-full flex flex-col">
      <div className="flex-shrink-0">
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <HierarchyIcon className="w-5 h-5" />
            概念聚类
        </h2>
        <div className="relative mb-4">
            <input 
                type="text"
                placeholder="搜索概念..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700"
            />
            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                <SearchIcon className="w-4 h-4 text-gray-400" />
            </div>
        </div>
      </div>
      <div className="space-y-2 overflow-y-auto flex-grow pr-2">
        {filteredConcepts.map((concept, index) => {
            const isCollapsed = collapsedConcepts.has(concept.id);
            const isHighlighted = searchTerm && concept.name.toLowerCase().includes(searchTerm.toLowerCase());
            return (
              <div 
                key={concept.id} 
                draggable
                onDragStart={() => handleConceptDragStart(concept.id, index)}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleConceptDrop(index); handleDragLeave(e); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-grab active:cursor-grabbing"
              >
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2 flex-grow cursor-pointer" onClick={() => toggleCollapse(concept.id)}>
                        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                        <h3 className={`font-semibold text-primary-700 dark:text-primary-400 text-sm truncate ${isHighlighted ? 'bg-yellow-200 dark:bg-yellow-700 rounded px-1' : ''}`} title={concept.name}>
                            {concept.name}
                        </h3>
                    </div>
                    <button onClick={() => deleteConcept(concept.id)} className="p-1 text-gray-400 hover:text-red-500 rounded-full" title="删除母概念">
                        <CloseIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
                {!isCollapsed && (
                    <div 
                      className="space-y-1 pl-4 border-l-2 border-gray-200 dark:border-gray-600 ml-2"
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleNodeDrop(concept.id); handleDragLeave(e); }}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                    >
                      {concept.children.map((node) => {
                         const isChildHighlighted = searchTerm && node.id.toLowerCase().includes(searchTerm.toLowerCase());
                         return (
                            <div
                              key={node.id}
                              draggable
                              onDragStart={(e) => { e.stopPropagation(); handleNodeDragStart(node, concept.id); }}
                              onDragEnd={() => setDraggedNode(null)}
                              className="group flex items-center justify-between text-xs p-2 bg-white dark:bg-gray-700 rounded shadow-sm cursor-grab active:cursor-grabbing"
                            >
                              <span className={`truncate ${isChildHighlighted ? 'bg-yellow-200 dark:bg-yellow-700 rounded px-1' : ''}`} title={node.id}>
                                <span className={`mr-2 font-bold ${node.isCore ? 'text-amber-500' : 'text-gray-400'}`} title={node.isCore ? '核心变量' : '次要变量'}>
                                  {node.isCore ? '★' : '•'}
                                </span>
                                {node.id}
                              </span>
                              <button onClick={() => removeNodeFromConcept(node.id, concept.id)} className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 rounded-full" title="删除子概念">
                                <CloseIcon className="w-3 h-3" />
                              </button>
                            </div>
                        )
                      })}
                       {concept.children.length === 0 && <p className="text-xs text-gray-400 p-2">拖拽变量至此</p>}
                    </div>
                )}
              </div>
            )
        })}
      </div>
      <div className="flex-shrink-0 mt-4">
        {isAddingConcept ? (
            <div className="flex gap-2">
                <input
                    ref={newConceptInputRef}
                    type="text"
                    placeholder="新母概念名称..."
                    className="w-full text-sm p-2 border rounded bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddConcept()}
                    autoFocus
                />
                <button onClick={handleAddConcept} className="bg-primary-600 text-white px-3 py-1 rounded text-sm">添加</button>
                <button onClick={() => setIsAddingConcept(false)} className="bg-gray-200 dark:bg-gray-600 px-3 py-1 rounded text-sm">取消</button>
            </div>
        ) : (
            <button onClick={() => setIsAddingConcept(true)} className="w-full flex items-center justify-center gap-2 text-sm p-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <PlusIcon className="w-4 h-4" />
                新增母概念
            </button>
        )}
      </div>
    </div>
  );
};

export default ClusterPanel;
import React, { useState, useRef } from 'react';
import { Concept, GraphNode } from '../types';
import { HierarchyIcon } from './icons/HierarchyIcon';

interface ClusterPanelProps {
  concepts: Concept[];
  onConceptsChange: (concepts: Concept[]) => void;
}

interface DraggedItem {
    node: GraphNode;
    sourceConceptId: string;
}

const ClusterPanel: React.FC<ClusterPanelProps> = ({ concepts, onConceptsChange }) => {
    const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const newGroupNameRef = useRef<HTMLInputElement>(null);

    const handleDragStart = (node: GraphNode, sourceConceptId: string) => {
        setDraggedItem({ node, sourceConceptId });
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.currentTarget.classList.add('bg-primary-100', 'dark:bg-primary-900/50');
    };
    
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('bg-primary-100', 'dark:bg-primary-900/50');
    };

    const handleDrop = (targetConceptId: string) => {
        if (!draggedItem) return;
        
        const { node, sourceConceptId } = draggedItem;
        if (sourceConceptId === targetConceptId) return; // No change if dropped in the same concept

        const newConcepts = concepts.map(c => ({ ...c, children: [...c.children] }));

        // Remove from source
        const sourceConcept = newConcepts.find(c => c.id === sourceConceptId);
        if(sourceConcept) {
            sourceConcept.children = sourceConcept.children.filter(child => child.id !== node.id);
        }

        // Add to target
        const targetConcept = newConcepts.find(c => c.id === targetConceptId);
        if(targetConcept) {
            targetConcept.children.push(node);
        }

        onConceptsChange(newConcepts.filter(c => c.children.length > 0)); // Remove empty concepts
        setDraggedItem(null);
    };

    const handleCreateNewGroup = (name: string) => {
        if (!draggedItem || !name.trim()) return;
        const { node, sourceConceptId } = draggedItem;
        
        const newConcepts = concepts.map(c => ({...c, children: [...c.children]}));
        
        // Remove from source
        const sourceConcept = newConcepts.find(c => c.id === sourceConceptId);
        if (sourceConcept) {
            sourceConcept.children = sourceConcept.children.filter(child => child.id !== node.id);
        }

        // Add to new concept
        const newConcept: Concept = {
            id: `${name}-${Date.now()}`,
            name: name,
            children: [node],
        };
        
        onConceptsChange([...newConcepts.filter(c => c.children.length > 0), newConcept]);
        setDraggedItem(null);
        setIsCreatingGroup(false);
    };


  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 flex-shrink-0">
        <HierarchyIcon className="w-5 h-5" />
        概念聚类
      </h2>
      <div className="space-y-4 overflow-y-auto flex-grow pr-2">
        {concepts.map((concept) => (
          <div 
            key={concept.id} 
            onDrop={(e) => {
                e.preventDefault();
                handleDrop(concept.id);
                handleDragLeave(e);
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg transition-colors"
          >
            <h3 className="font-semibold text-primary-700 dark:text-primary-400 text-sm mb-2">{concept.name}</h3>
            <div className="space-y-1">
              {concept.children.map((node) => (
                <div
                  key={node.id}
                  draggable
                  onDragStart={() => handleDragStart(node, concept.id)}
                  onDragEnd={() => setDraggedItem(null)}
                  className="text-xs p-2 bg-white dark:bg-gray-700 rounded shadow-sm cursor-grab active:cursor-grabbing"
                  title={node.id}
                >
                  <span className={`mr-2 font-bold ${node.isCore ? 'text-amber-500' : 'text-gray-400'}`} title={node.isCore ? '核心变量' : '次要变量'}>
                    {node.isCore ? '★' : '•'}
                  </span>
                  <span className="truncate">{node.id}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div
             onDrop={(e) => {
                e.preventDefault();
                setIsCreatingGroup(true);
                handleDragLeave(e);
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
             className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center text-sm text-gray-500 dark:text-gray-400"
        >
            {isCreatingGroup ? (
                <div className="flex flex-col items-center gap-2">
                    <input
                        ref={newGroupNameRef}
                        type="text"
                        placeholder="输入新分组名称..."
                        className="w-full text-sm p-1 border rounded bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-500"
                        onKeyDown={(e) => {
                           if(e.key === 'Enter') handleCreateNewGroup(newGroupNameRef.current?.value || '');
                           if(e.key === 'Escape') setIsCreatingGroup(false);
                        }}
                        autoFocus
                    />
                    <div className="flex gap-2">
                      <button onClick={() => handleCreateNewGroup(newGroupNameRef.current?.value || '')} className="text-xs bg-primary-600 text-white px-2 py-1 rounded">创建</button>
                      <button onClick={() => setIsCreatingGroup(false)} className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">取消</button>
                    </div>
                </div>
            ) : (
                '拖拽变量至此可新建分组'
            )}
        </div>
      </div>
    </div>
  );
};

export default ClusterPanel;

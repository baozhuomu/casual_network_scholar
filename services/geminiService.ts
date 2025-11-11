import { GoogleGenAI, Type } from "@google/genai";
import { GraphData, TopicSuggestion, GraphNode, GraphLink, Concept } from '../types';

// Fix: Initialize GoogleGenAI with process.env.API_KEY directly as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const detectDominantLanguage = (texts: string[]): 'en' | 'zh' => {
  let enChars = 0;
  let zhChars = 0;
  
  const enRegex = /[a-zA-Z]/g;
  const zhRegex = /[\u4e00-\u9fa5]/g;

  for (const text of texts) {
    if(!text) continue;
    enChars += (text.match(enRegex) || []).length;
    zhChars += (text.match(zhRegex) || []).length;
  }
  
  // If there's barely any text, default to English to avoid issues.
  if (enChars + zhChars < 100) return 'en';

  return zhChars > enChars ? 'zh' : 'en';
};

function parseJsonResponse(rawText: string): any {
    try {
        return JSON.parse(rawText);
    } catch (e) {
         console.error("Failed to parse API response as JSON", e);
         // Attempt to clean the string if it's wrapped in markdown
         const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
         const match = rawText.match(jsonRegex);
         if (match && match[1]) {
             try {
                return JSON.parse(match[1]);
             } catch (innerError) {
                console.error("Failed to parse extracted JSON from markdown", innerError);
             }
         }
         throw new Error("Response is not valid JSON, even after attempting to clean it.");
    }
}


export async function extractAndSuggest(papers: string[]): Promise<{ graphData: GraphData; topics: TopicSuggestion[]; concepts: Concept[] }> {
  const dominantLanguage = detectDominantLanguage(papers);
  const outputLanguageInstruction = dominantLanguage === 'en'
    ? "The output, including all variable names, concepts, topics, and hypotheses, MUST be in English."
    : "输出内容，包括所有变量名、概念、主题和假设，都必须使用简体中文。";

  const extractionPrompt = `
You are a highly advanced research assistant with expertise in semantic analysis and network science. Analyze the provided academic texts.
Your tasks are:
1.  **Identify Key Variables**: Extract all significant variables.
2.  **Classify Variables**: Determine if each variable is a "core" variable (central to the main arguments) or "secondary" (less critical, contextual).
3.  **Determine Causal Relationships**: Identify directed causal links between variables.
4.  **Perform Semantic Clustering**: Based on cross-lingual semantic similarity, group related variables under parent concepts. A variable should belong to only one concept.

${outputLanguageInstruction}

Provide the output in a single, valid JSON object with NO other text or markdown. The JSON structure MUST be:
{
  "nodes": [
    { "id": "Variable Name 1", "isCore": true },
    { "id": "Variable Name 2", "isCore": false }
  ],
  "links": [
    { "source": "Variable Name 1", "target": "Variable Name 2" }
  ],
  "concepts": [
    {
      "name": "Parent Concept A",
      "variables": ["Variable Name 1", "Variable Name 3"]
    },
    {
      "name": "Parent Concept B",
      "variables": ["Variable Name 2"]
    }
  ]
}

Here are the academic texts:
${papers.map((p, i) => `\nText ${i + 1}:\n"""\n${p}\n"""`).join('\n')}
`;
  
  const extractionResult = await ai.models.generateContent({
      model: 'gemini-2.5-pro', // Using a more powerful model for this complex task
      contents: extractionPrompt,
      config: {
        responseMimeType: "application/json",
      },
  });
  const extractionResponse = parseJsonResponse(extractionResult.text);

  const { nodes: responseNodes, links: responseLinks, concepts: responseConcepts } = extractionResponse;

  if (!responseNodes || !responseLinks || !responseConcepts) {
    throw new Error("Failed to extract valid data from the text. The response format was incorrect.");
  }

  // Create a map of variable ID to concept name for easy lookup
  const variableToConceptMap = new Map<string, string>();
  responseConcepts.forEach((concept: { name: string; variables: string[] }) => {
    concept.variables.forEach(variable => {
      variableToConceptMap.set(variable, concept.name);
    });
  });

  const nodes: GraphNode[] = responseNodes.map((node: { id: string; isCore: boolean }) => ({
    id: node.id,
    isCore: node.isCore,
    group: variableToConceptMap.get(node.id) || 'Default',
  }));

  const nodeSet = new Set(nodes.map(n => n.id));
  const links: GraphLink[] = responseLinks
    .filter((link: { source: string; target: string; }) => nodeSet.has(link.source) && nodeSet.has(link.target));
  
  const graphData = { nodes, links };
  
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const concepts: Concept[] = responseConcepts.map((concept: { name: string, variables: string[] }, index: number) => ({
      id: `${concept.name}-${index}`,
      name: concept.name,
      children: concept.variables
        .map(variableId => nodeMap.get(variableId))
        .filter((node): node is GraphNode => node !== undefined),
  }));


  // Step 2: Generate topic suggestions
  const suggestionPrompt = `
You are an AI research strategist. Based on the following network of causal relationships and conceptual clusters from academic papers, generate 3 innovative and feasible research topics.

For each topic, provide a brief research hypothesis, an "innovation score" (as a percentage from 70 to 95), and a "feasibility" statement.

Identify gaps, suggest new connections, or introduce new mediating/moderating variables.

${outputLanguageInstruction}

Here is the existing knowledge graph:
Causal Relations:
${JSON.stringify(links, null, 2)}

Concept Clusters:
${JSON.stringify(responseConcepts, null, 2)}

Provide the output as a single, valid JSON array of objects. Do not include any explanations, markdown formatting, or text outside of the JSON array.
The JSON structure for each object must be:
{
  "topic": "The role of [Variable] in the relationship between [Variable X] and [Variable Y]",
  "hypothesis": "[Variable X] positively influences [Variable Y] through...",
  "innovationScore": 85,
  "feasibility": "This builds upon existing research..."
}
`;

  const suggestionResult = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: suggestionPrompt,
      config: {
        responseMimeType: "application/json",
      }
  });
  const topics: TopicSuggestion[] = parseJsonResponse(suggestionResult.text);

  if (!topics || topics.length === 0) {
    throw new Error("Failed to generate valid topic suggestions.");
  }

  return { graphData, topics, concepts };
}

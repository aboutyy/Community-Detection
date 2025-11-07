
import { GoogleGenAI, Type } from "@google/genai";
import { Algorithm, CommunityAssignment, GraphData, LouvainParams, GirvanNewmanParams } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const convertGraphToEdgeList = (graphData: GraphData): string => {
  return graphData.links.map(link => `${link.source} ${link.target}`).join('\n');
}

export const runCommunityDetection = async (
  graphData: GraphData,
  algorithm: Algorithm,
  // Fix: Allow `params` to be an empty object for algorithms like Label Propagation
  // that do not have configurable parameters. This resolves the type error in App.tsx.
  params: LouvainParams | GirvanNewmanParams | {},
  signal: AbortSignal
): Promise<CommunityAssignment[]> => {
  const edgeList = convertGraphToEdgeList(graphData);

  let algorithmInstructions = '';
  switch(algorithm) {
    case Algorithm.LOUVAIN:
      const louvainParams = params as LouvainParams;
      algorithmInstructions = `
        Use the Louvain method for community detection. This is a widely-used greedy optimization method that attempts to maximize a modularity score for a network partition.
        You MUST follow these phases precisely:

        **Phase 1: Modularity Optimization**
        1.  **Initialization**: At the start, assign each node to its own unique community.
        2.  **Iterative Node Movement**: Repeatedly pass through all nodes in the network. For each node, evaluate the gain in modularity if you move it to the community of each of its neighbors.
        3.  **Greedy Choice**: Move the node to the community that yields the largest modularity increase, but only if this increase is positive. If no move results in a positive gain, the node stays in its current community.
        4.  **Convergence**: Repeat step 2 and 3 until no node movement can improve the modularity. This concludes Phase 1.

        **Phase 2: Community Aggregation**
        1.  **Coarsening**: Build a new network where each node is a community from Phase 1.
        2.  **Reweighting**: The weights of the links between the new nodes are given by the sum of the weights of the links between nodes in the corresponding two communities from the original graph. Links between nodes of the same community lead to self-loops in the new network.

        **Overall Algorithm & Termination**
        You must repeat Phase 1 and Phase 2. The algorithm MUST terminate if EITHER of the following conditions is met:
        a. **Convergence**: A full pass (Phase 1 followed by Phase 2) results in no change to the community assignments, and therefore no increase in modularity.
        b. **Maximum Passes**: You have completed 20 full passes.
        The algorithm stops as soon as one of these conditions is fulfilled.

        **Parameter:**
        You MUST use a resolution parameter of exactly ${louvainParams.resolution} in your modularity calculation. This parameter tunes the size of the communities.
        - A value < 1.0 tends to find larger communities.
        - A value > 1.0 tends to find smaller communities.
      `;
      break;
    case Algorithm.GIRVAN_NEWMAN:
      const gnParams = params as GirvanNewmanParams;
      algorithmInstructions = `
        Use the Girvan-Newman algorithm, a divisive hierarchical clustering method based on iterative edge removal.
        Follow these steps precisely:

        1.  **Initial State Check**: Before starting, count the number of connected components in the initial graph.
            - If this count is already greater than or equal to the target of ${gnParams.targetCommunities}, the process cannot proceed as intended. In this case, you MUST immediately STOP and output the current connected components as the final communities.

        2.  **Iterative Removal Loop**: If the initial component count is less than the target, begin this loop. The loop must terminate if EITHER of the following conditions is met:
            a. The number of connected components reaches the target of ${gnParams.targetCommunities}.
            b. There are no more edges left in the graph to remove.

        3.  **Inside the Loop**: On each iteration:
            a. **Calculate Betweenness**: For every edge currently in the network, calculate its "edge betweenness centrality". This is the number of shortest paths between all pairs of nodes that pass through that specific edge.
            b. **Find Maximum**: Identify the edge or edges with the absolute highest betweenness centrality.
            c. **Select & Remove One Edge**:
                - If only one edge has the highest value, remove it.
                - **CRITICAL TIE-BREAKING**: If multiple edges are tied for the highest value, you MUST select ONLY ONE to remove. To break the tie deterministically, select the edge whose source node ID comes first lexicographically (alphabetically). If there is still a tie (e.g., edges ('A', 'B') and ('A', 'C')), select the one whose target node ID comes first lexicographically.

        4.  **Final Output**: Once the loop terminates (for either reason specified in step 2), your final output must be the community assignments based on the connected components at that moment.
      `;
      break;
    case Algorithm.LABEL_PROPAGATION:
      algorithmInstructions = `
        Use the Label Propagation Algorithm (LPA) to find communities.
        This is an iterative algorithm where nodes adopt the community label of the majority of their neighbors.
        Follow these steps precisely:
        1.  **Initialization**: Assign a unique community label to every single node in the graph.
        2.  **Iteration Loop & Termination**: You must repeat the following update step. The algorithm MUST terminate if EITHER of the following conditions is met:
            a. **Convergence**: No node changes its community label during one full pass through all nodes.
            b. **Maximum Iterations**: You have completed 20 full iterations.
            The algorithm stops as soon as one of these conditions is fulfilled.
        3.  **Update Step**: In each iteration, for each node in the network (processed in a deterministic order, for example, sorted by ID):
            a. If the node has no neighbors (it is an isolated node), it keeps its current community label. Skip to the next node.
            b. Otherwise, collect the current community labels of all its immediate neighbors.
            c. Find which community label is the most frequent among its neighbors.
            d. **CRITICAL Tie-Breaking Rule**: If there's a tie for the most frequent label, you MUST choose the label with the smallest numerical value. For example, if labels 3 and 5 are both the most frequent, you must choose community 3.
            e. Update the current node's label to this chosen majority label.
        4.  **Final Output**: Once the algorithm has terminated (either by convergence or reaching the iteration limit), your final output must be the community assignments from that state.
      `;
      break;
  }

  const prompt = `
    You are an expert graph analysis tool specializing in network science.
    Your task is to perform community detection on a given graph and return the results in a specific JSON format.

    **Graph Data (Edge List):**
    ---
    ${edgeList}
    ---

    **Node ID Handling:**
    You MUST treat all node identifiers in the edge list as literal, case-sensitive strings. Do not interpret them as numbers, even if they look like numbers (e.g., "1", "34"). This is critical for sorting and processing nodes correctly.

    **Algorithm and Parameters:**
    ${algorithmInstructions}

    **CRITICAL OUTPUT INSTRUCTIONS:**
    1.  You MUST reply with ONLY a single, valid JSON object.
    2.  Do NOT include any markdown formatting (like \`\`\`json), comments, or any other text outside of the JSON object.
    3.  The JSON object must have one top-level key: "communities".
    4.  The "communities" value must be an array of objects.
    5.  Each object in the array must have two keys: "node" (string, the node ID) and "community" (integer, the community ID it belongs to).
    6.  Ensure every single node from the input graph is present in the output array.

    **Example of the required JSON output format:**
    {
      "communities": [
        { "node": "1", "community": 0 },
        { "node": "2", "community": 0 },
        { "node": "34", "community": 1 }
      ]
    }
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            communities: {
              type: Type.ARRAY,
              description: "An array of community assignments for each node.",
              items: {
                type: Type.OBJECT,
                properties: {
                  node: { type: Type.STRING, description: "The node identifier." },
                  community: { type: Type.INTEGER, description: "The integer ID of the community." }
                },
                required: ["node", "community"]
              }
            }
          },
          required: ["communities"]
        }
      },
    });

    const result = JSON.parse(response.text);

    if (!result.communities || !Array.isArray(result.communities)) {
      throw new Error("The AI's response was missing the required 'communities' array.");
    }
    
    // Validate that all nodes are accounted for
    const returnedNodes = new Set(result.communities.map((c: CommunityAssignment) => c.node));
    if (returnedNodes.size < graphData.nodes.length) {
       console.warn("AI did not return communities for all nodes. Some nodes may not be assigned a community.");
    }

    return result.communities;

  } catch (error) {
    if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      console.log("Community detection was cancelled by the user.");
      throw new DOMException("Request aborted by user", "AbortError");
    }
    console.error("Error calling or parsing Gemini API response for community detection:", error);
    let errorMessage = "Failed to run community detection via the API.";
    if (error instanceof SyntaxError) {
      errorMessage = "Failed to parse the AI's JSON response for community assignments.";
    } else if (error instanceof Error) {
      errorMessage += ` Details: ${error.message}`;
    } else if (typeof error === 'object' && error !== null) {
        errorMessage += ` Details: ${JSON.stringify(error)}`;
    }
    throw new Error(errorMessage);
  }
};


export const getAlgorithmExplanation = async (algorithm: Algorithm, signal: AbortSignal): Promise<string> => {

  const prompt = `
    You are an expert in complex network analysis.
    Your task is to provide a concise, university-level explanation for the following community detection algorithm.

    **Algorithm:**
    ${algorithm}

    **CRITICAL OUTPUT INSTRUCTIONS:**
    1.  You MUST reply with ONLY a single, valid JSON object.
    2.  Do NOT include any markdown formatting (like \`\`\`json), comments, or any other text outside of the JSON object.
    3.  The JSON object must have one top-level key: "explanation".
    4.  The "explanation" value must be a string containing the explanation. Focus on the core principles, how it works iteratively (if applicable), and its strengths or weaknesses.

    **Example of the required JSON output format:**
    {
      "explanation": "The Louvain method is a greedy optimization algorithm that attempts to maximize the modularity of a network's partitions. It works in two phases: first, it assigns each node to its own community and then iteratively moves nodes to neighboring communities if the move improves modularity. Second, it builds a new network where nodes are the communities from the first phase..."
    }
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: {
              type: Type.STRING,
              description: `A concise, university-level explanation of how the ${algorithm} algorithm works.`
            }
          },
          required: ["explanation"]
        }
      },
    });

    const result = JSON.parse(response.text);

    if (!result.explanation) {
        throw new Error("The AI's response was missing the required 'explanation' field.");
    }

    return result.explanation;

  } catch (error) {
    if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        console.log("Explanation generation was cancelled by the user.");
        throw new DOMException("Request aborted by user", "AbortError");
    }
    console.error("Error calling or parsing Gemini API response for explanation:", error);
    let errorMessage = "Failed to get algorithm explanation from the API.";
    if (error instanceof SyntaxError) {
        errorMessage = "Failed to parse the AI's JSON response for the explanation.";
    } else if (error instanceof Error) {
        errorMessage += ` Details: ${error.message}`;
    }
    throw new Error(errorMessage);
  }
};
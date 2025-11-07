import { GraphData, CommunityAssignment, GNParams, LFRParams, Node, Link } from '../types';

interface GenerationResult {
  graphData: GraphData;
  groundTruth: CommunityAssignment[];
  edgeList: string;
}

export const generateGNNetwork = (params: GNParams): GenerationResult => {
  const nodes: Node[] = [];
  const links: Link[] = [];
  const groundTruth: CommunityAssignment[] = [];

  for (let c = 0; c < params.numCommunities; c++) {
    for (let i = 0; i < params.nodesPerCommunity; i++) {
      const nodeId = `c${c}_n${i}`;
      nodes.push({ id: nodeId, community: c, groundTruthCommunity: c });
      groundTruth.push({ node: nodeId, community: c });
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const nodeA = nodes[i];
      const nodeB = nodes[j];
      const communityA = groundTruth.find(gt => gt.node === nodeA.id)!.community;
      const communityB = groundTruth.find(gt => gt.node === nodeB.id)!.community;

      const isIntraCommunity = communityA === communityB;
      const p = isIntraCommunity ? params.p_in : params.p_out;

      if (Math.random() < p) {
        links.push({ source: nodeA.id, target: nodeB.id });
      }
    }
  }
  
  const edgeList = links.map(l => `${l.source} ${l.target}`).join('\n');
  return { graphData: { nodes, links }, groundTruth, edgeList };
};

// Helper to shuffle an array
const shuffle = <T>(array: T[]): T[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};


// Helper to generate a random integer from a power-law distribution
const powerLawSample = (min: number, max: number, exponent: number): number => {
    // Using the transformation method
    const y = Math.random();
    const alpha = 1.0 - exponent;
    const minAlpha = Math.pow(min, alpha);
    const maxAlpha = Math.pow(max, alpha);
    const result = Math.pow((maxAlpha - minAlpha) * y + minAlpha, 1.0 / alpha);
    return Math.round(result);
};


export const generateLFRNetwork = (params: LFRParams): GenerationResult => {
    const { n, mu, degreeExponent, communityExponent } = params;
    
    // Ensure min <= max and validate parameters
    const minCommunity = Math.min(params.minCommunity, params.maxCommunity);
    const maxCommunity = Math.max(params.minCommunity, params.maxCommunity);
    const minDegree = Math.min(params.minDegree, params.maxDegree);
    const maxDegree = Math.max(params.minDegree, params.maxDegree);

    const nodes: Node[] = [];
    const groundTruth: CommunityAssignment[] = [];
    
    // 1. Generate community sizes from a power-law distribution
    let communitySizes: number[] = [];
    let nRemaining = n;
    while (nRemaining > 0) {
        const maxCSize = Math.min(maxCommunity, nRemaining);
        if (maxCSize < minCommunity) {
            // Add remaining nodes to the largest community if they can't form a new one
            if(communitySizes.length > 0) {
                const maxIndex = communitySizes.indexOf(Math.max(...communitySizes));
                communitySizes[maxIndex] += nRemaining;
            }
            nRemaining = 0;
            break;
        }

        let size = powerLawSample(minCommunity, maxCSize, communityExponent);
        
        // If remaining nodes after this one can't form a valid community,
        // just make this community take up all remaining nodes.
        if (nRemaining - size > 0 && nRemaining - size < minCommunity) {
            size = nRemaining;
        }

        communitySizes.push(size);
        nRemaining -= size;
    }
    
    // 2. Assign nodes to communities
    const communities: string[][] = [];
    let nodeIdCounter = 0;
    communitySizes.forEach((size, cIndex) => {
        const communityNodes: string[] = [];
        for (let i = 0; i < size; i++) {
            const nodeId = `n${nodeIdCounter++}`;
            nodes.push({ id: nodeId, community: cIndex, groundTruthCommunity: cIndex });
            groundTruth.push({ node: nodeId, community: cIndex });
            communityNodes.push(nodeId);
        }
        communities.push(communityNodes);
    });

    // Create a map from node ID to its community's size for later constraint checks
    const nodeToCommunitySize = new Map<string, number>();
    communities.forEach(communityNodes => {
        const size = communityNodes.length;
        communityNodes.forEach(nodeId => {
            nodeToCommunitySize.set(nodeId, size);
        });
    });

    // 3. Generate node degrees from a power-law distribution, respecting community constraints
    const degrees: Map<string, number> = new Map();
    let totalDegree = 0;
    nodes.forEach(node => {
        const communitySize = nodeToCommunitySize.get(node.id)!;
        
        // A node's internal degree (k_in) cannot exceed its community size minus 1.
        // k_in = k * (1 - mu)  =>  k * (1 - mu) <= communitySize - 1
        // Therefore, k <= (communitySize - 1) / (1 - mu)
        // This provides a hard upper bound on the total degree for each node.
        const maxDegreeFromCommunity = (1 - mu > 1e-9) ? Math.floor((communitySize - 1) / (1 - mu)) : (n - 1);
        
        const effectiveMaxDegree = Math.min(maxDegree, n - 1, maxDegreeFromCommunity);
        const effectiveMinDegree = Math.min(minDegree, effectiveMaxDegree);

        let degree = effectiveMinDegree;
        if (effectiveMinDegree < effectiveMaxDegree) {
            degree = powerLawSample(effectiveMinDegree, effectiveMaxDegree, degreeExponent);
        }
        
        degrees.set(node.id, degree);
        totalDegree += degree;
    });

    // Ensure total degree is even for graph construction
    if (totalDegree % 2 !== 0) {
        const randNodeId = nodes[Math.floor(Math.random() * nodes.length)].id;
        degrees.set(randNodeId, degrees.get(randNodeId)! + 1);
    }
    
    // 4. Determine internal/external degrees, ensuring constraints are met
    // This step is crucial for correctness and preserves the degree distribution.
    const nodeProperties = new Map<string, { internal: number; external: number }>();
    nodes.forEach(node => {
        const totalNodeDegree = degrees.get(node.id)!;
        const externalDegree = Math.round(totalNodeDegree * mu);
        const internalDegree = totalNodeDegree - externalDegree;
        nodeProperties.set(node.id, { internal: internalDegree, external: externalDegree });
    });

    // For each community, ensure the sum of internal degrees is even.
    // If not, swap one internal stub for an external one on a random node.
    // This preserves the node's total degree.
    communities.forEach((communityNodes) => {
        const internalDegreeSum = communityNodes.reduce((sum, nodeId) => {
            return sum + nodeProperties.get(nodeId)!.internal;
        }, 0);

        if (internalDegreeSum % 2 !== 0) {
            // Sum is odd, need to fix one node.
            const nodeToFixId = communityNodes[Math.floor(Math.random() * communityNodes.length)];
            const props = nodeProperties.get(nodeToFixId)!;
            
            // Swap one internal for one external stub, if possible
            if (props.internal > 0) {
                 props.internal--;
                 props.external++;
            } else {
                 // This is a rare edge case, but if a node has no internal stubs to swap,
                 // we must find another node in the community that does. If none exist,
                 // the most practical solution is to swap external for internal.
                 props.internal++;
                 props.external--;
            }
        }
    });

    // 5. Create internal and external stubs lists based on the corrected properties
    const internalStubs: { [key: number]: string[] } = {};
    const externalStubs: string[] = [];
    communities.forEach((communityNodes, cIndex) => {
        internalStubs[cIndex] = [];
        communityNodes.forEach(nodeId => {
            const props = nodeProperties.get(nodeId)!;
            for (let i = 0; i < props.internal; i++) internalStubs[cIndex].push(nodeId);
            for (let i = 0; i < props.external; i++) externalStubs.push(nodeId);
        });
    });

    // 6. Connect stubs to form links (Configuration Model)
    const links: Set<string> = new Set();
    const addLink = (u: string, v: string) => {
        if (u === v) return; // No self-loops
        const key1 = `${u}|${v}`;
        const key2 = `${v}|${u}`;
        if (!links.has(key1) && !links.has(key2)) {
            links.add(key1);
        }
    };

    // Connect internal stubs
    Object.values(internalStubs).forEach(stubs => {
        shuffle(stubs);
        for (let i = 0; i < stubs.length; i += 2) {
            if (stubs[i + 1]) {
                addLink(stubs[i], stubs[i + 1]);
            }
        }
    });

    // Connect external stubs
    shuffle(externalStubs);
    for (let i = 0; i < externalStubs.length; i += 2) {
        if (externalStubs[i + 1]) {
            addLink(externalStubs[i], externalStubs[i + 1]);
        }
    }
    
    const finalLinks: Link[] = Array.from(links).map(key => {
        const [source, target] = key.split('|');
        return { source, target };
    });

    const edgeList = finalLinks.map(l => `${l.source} ${l.target}`).join('\n');
    return { graphData: { nodes, links: finalLinks }, groundTruth, edgeList };
  };

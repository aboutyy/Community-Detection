import { CommunityAssignment, Node } from '../types';

/**
 * Calculates the Normalized Mutual Information (NMI) between two community partitions.
 * @param groundTruth - The ground truth community assignments.
 * @param detected - The detected community assignments from an algorithm.
 * @param nodes - The list of all nodes in the graph.
 * @returns The NMI score, a value between 0 and 1.
 */
export const calculateNMI = (groundTruth: CommunityAssignment[], detected: CommunityAssignment[], nodes: Node[]): number => {
    const n = nodes.length;
    
    // Create maps for quick lookup
    const groundTruthMap = new Map(groundTruth.map(item => [item.node, item.community]));
    const detectedMap = new Map(detected.map(item => [item.node, item.community]));

    // Get unique community labels
    const groundTruthLabels = [...new Set(groundTruth.map(c => c.community))];
    const detectedLabels = [...new Set(detected.map(c => c.community))];

    // Create a contingency table (confusion matrix)
    const contingencyTable: number[][] = Array(groundTruthLabels.length).fill(0).map(() => Array(detectedLabels.length).fill(0));
    
    for (const node of nodes) {
        const gtCommunity = groundTruthMap.get(node.id);
        const dtCommunity = detectedMap.get(node.id);
        
        if (gtCommunity !== undefined && dtCommunity !== undefined) {
            const gtIndex = groundTruthLabels.indexOf(gtCommunity);
            const dtIndex = detectedLabels.indexOf(dtCommunity);
            if (gtIndex !== -1 && dtIndex !== -1) {
                contingencyTable[gtIndex][dtIndex]++;
            }
        }
    }

    // Calculate mutual information (I) and entropies (H)
    let mutualInformation = 0;
    const eps = 1e-15; // Small epsilon to avoid log(0)

    for (let i = 0; i < groundTruthLabels.length; i++) {
        for (let j = 0; j < detectedLabels.length; j++) {
            if (contingencyTable[i][j] > 0) {
                const p_ij = contingencyTable[i][j] / n;
                const p_i = contingencyTable[i].reduce((a, b) => a + b, 0) / n;
                const p_j = contingencyTable.reduce((sum, row) => sum + row[j], 0) / n;
                mutualInformation += p_ij * Math.log2(p_ij / (p_i * p_j) + eps);
            }
        }
    }

    let entropyGroundTruth = 0;
    for (let i = 0; i < groundTruthLabels.length; i++) {
        const p_i = contingencyTable[i].reduce((a, b) => a + b, 0) / n;
        if (p_i > 0) {
            entropyGroundTruth -= p_i * Math.log2(p_i + eps);
        }
    }
    
    let entropyDetected = 0;
    for (let j = 0; j < detectedLabels.length; j++) {
        const p_j = contingencyTable.reduce((sum, row) => sum + row[j], 0) / n;
        if (p_j > 0) {
            entropyDetected -= p_j * Math.log2(p_j + eps);
        }
    }

    if (entropyGroundTruth === 0 && entropyDetected === 0) {
        return 1.0; // Both partitions are trivial (one community)
    }

    const nmi = (2 * mutualInformation) / (entropyGroundTruth + entropyDetected);
    
    // NMI can sometimes be slightly > 1 or < 0 due to floating point inaccuracies
    return Math.max(0, Math.min(1, nmi));
};
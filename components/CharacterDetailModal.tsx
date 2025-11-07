
import React, { useState, useEffect } from 'react';
import { Node } from '../types';

interface CharacterDetailModalProps {
  node: Node;
  onClose: () => void;
}

const CharacterDetailModal: React.FC<CharacterDetailModalProps> = ({ node, onClose }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    // Reset state whenever the node prop changes
    if (node?.imageUrl) {
      setIsLoading(true);
      setLoadFailed(false);
    } else {
      // If there's no image URL, don't show a loader, just the placeholder.
      setIsLoading(false);
      setLoadFailed(true); 
    }
  }, [node]);

  if (!node) {
    return null;
  }
  
  const showImage = node.imageUrl && !loadFailed;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md mx-4 relative transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="flex flex-col items-center text-center">
          <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-4 border-4 bg-gray-700 transition-colors ${showImage ? 'border-cyan-500' : 'border-gray-600'}`}>
            {isLoading && (
              <svg className="animate-spin h-8 w-8 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            
            {showImage && (
              <img
                src={node.imageUrl}
                alt={`Portrait of ${node.id}`}
                className={`w-full h-full rounded-full object-cover shadow-lg transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  console.error(`Failed to load image: ${node.imageUrl}`);
                  setIsLoading(false);
                  setLoadFailed(true);
                }}
              />
            )}

            {(!showImage && !isLoading) && (
               <span className="text-4xl text-gray-500 font-mono">?</span>
            )}
           </div>
          <h2 className="text-3xl font-bold text-cyan-400 mb-2">{node.id}</h2>
          {node.community !== undefined && (
            <p className="text-md text-gray-300 mb-4 bg-gray-700/50 px-3 py-1 rounded-full">
                Community: <span className="font-bold">{node.community}</span>
            </p>
          )}
          {node.description && (
            <p className="text-gray-300 text-lg">
              {node.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CharacterDetailModal;
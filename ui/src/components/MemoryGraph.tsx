import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import ForceGraph2D from 'react-force-graph-2d';
import * as THREE from 'three';
import { Layers, Search, X, ZoomIn, ZoomOut, Maximize, RefreshCw } from 'lucide-react';
import NodeDetailsPanel from './NodeDetailsPanel.js';

interface GraphData {
  nodes: any[];
  links: any[];
}

export default function MemoryGraph() {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [is3D, setIs3D] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState<'all'|'global'|'local'>('all');
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const fgRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(() => {
    setIsLoading(true);
    fetch('/api/graph')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to load graph data", err);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNode(null);
        setSearchQuery('');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    setSearchIndex(-1);
  }, [searchQuery]);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    // Aim at node from outside it
    const distance = 40;
    const distRatio = 1 + distance/Math.hypot(node.x || 1, node.y || 1, node.z || 1);

    if (fgRef.current && is3D) {
      fgRef.current.cameraPosition(
        { x: (node.x || 0) * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio }, // new position
        node, // lookAt ({ x, y, z })
        3000  // ms transition duration
      );
    } else if (fgRef.current && !is3D) {
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(8, 2000);
    }
  }, [is3D]);

  // Adjust Physics to reduce clustering
  useEffect(() => {
    if (fgRef.current && data.nodes.length > 0) {
      setTimeout(() => {
        if (fgRef.current && fgRef.current.d3Force) {
          fgRef.current.d3Force('charge')?.strength(-200)?.distanceMax(800);
          fgRef.current.d3Force('link')?.distance(60);
          fgRef.current.d3ReheatSimulation();
        }
      }, 500); // Slight delay ensures engine is mounted
    }
  }, [is3D, data]);

  const GraphComponent = is3D ? ForceGraph3D : ForceGraph2D as any;

  const filteredData = useMemo(() => {
    let filteredNodes = data.nodes;
    if (activeFilter === 'global') filteredNodes = filteredNodes.filter(n => n.sourceDb === 'global');
    if (activeFilter === 'local') filteredNodes = filteredNodes.filter(n => n.sourceDb !== 'global');

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filteredNodes = filteredNodes.map(n => ({
        ...n,
        _highlighted: n.fullText?.toLowerCase().includes(lowerQuery) || n.name?.toLowerCase().includes(lowerQuery)
      }));
    } else {
      filteredNodes = filteredNodes.map(n => ({ ...n, _highlighted: false }));
    }
    
    // Filter links to only those where both source and target are in filteredNodes
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = data.links.filter(l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });

    return {
      nodes: filteredNodes,
      links: filteredLinks
    };
  }, [data, searchQuery, activeFilter]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#0b0f19' }}>
      
      {/* Top Header & Search */}
      <div style={{ position: 'absolute', top: 20, left: 20, right: 20, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
        
        <div style={{ background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(10px)', padding: '12px 24px', borderRadius: 12, color: 'white', display: 'flex', alignItems: 'center', gap: 15, pointerEvents: 'auto', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Cognitive Memory</h2>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(10px)', padding: '8px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'auto', border: '1px solid rgba(255,255,255,0.1)', width: '300px' }}>
          <Search size={16} color="#94a3b8" />
          <input 
            ref={searchInputRef}
            type="text" 
            placeholder="Search memories... (Ctrl+K)" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && searchQuery) {
                const matchedNodes = filteredData.nodes.filter(n => n._highlighted);
                if (matchedNodes.length > 0) {
                  const nextIndex = (searchIndex + 1) % matchedNodes.length;
                  setSearchIndex(nextIndex);
                  handleNodeClick(matchedNodes[nextIndex]);
                }
              }
            }}
            style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', width: '100%', fontSize: '0.95rem' }}
          />
          {searchQuery && <X size={16} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />}
        </div>
      </div>

      {/* Quick Filters */}
      <div style={{ position: 'absolute', top: 75, right: 20, zIndex: 10, display: 'flex', gap: 8, pointerEvents: 'auto' }}>
        {(['all', 'global', 'local'] as const).map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            style={{
              background: activeFilter === filter ? 'rgba(59, 130, 246, 0.4)' : 'rgba(15, 23, 42, 0.7)',
              border: `1px solid ${activeFilter === filter ? 'rgba(59, 130, 246, 0.8)' : 'rgba(255,255,255,0.1)'}`,
              color: activeFilter === filter ? '#fff' : '#94a3b8',
              padding: '4px 12px', borderRadius: 12, fontSize: '0.8rem', cursor: 'pointer', backdropFilter: 'blur(10px)', transition: 'all 0.2s'
            }}
          >
            {filter === 'all' ? 'All' : filter === 'global' ? '🌍 Global' : '🏠 Local'}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={{
          position: 'absolute', top: '0', left: '0', right: '0', bottom: '0',
          background: 'rgba(11, 15, 25, 0.8)', backdropFilter: 'blur(10px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: 'white', zIndex: 50
        }}>
          <div style={{
            width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite'
          }} />
          <p style={{ marginTop: '20px', color: '#94a3b8', letterSpacing: '0.05em' }}>RECONSTRUCTING MEMORY LINKS...</p>
        </div>
      )}

      {/* Empty State */}
      {data.nodes.length === 0 && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(12px)',
          padding: '40px 50px', borderRadius: '24px', color: 'rgba(255, 255, 255, 0.8)',
          textAlign: 'center', maxWidth: '550px', border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', zIndex: 5
        }}>
          <h3 style={{ marginTop: 0, fontSize: '1.8rem', color: 'white', fontWeight: 600, letterSpacing: '-0.02em' }}>🧠 Empty Mind</h3>
          <p style={{ lineHeight: '1.6', fontSize: '1.1rem', marginBottom: 0 }}>
            Your memory graph is currently empty. Start chatting with an AI assistant or run a sync with Obsidian!
          </p>
        </div>
      )}

      {/* Sidebar Details Panel */}
      <NodeDetailsPanel 
        selectedNode={selectedNode} 
        onClose={() => setSelectedNode(null)} 
      />

      {/* Graph Controls Overlay */}
      <div style={{ 
        position: 'absolute', bottom: 30, right: selectedNode ? 400 : 30, zIndex: 10, 
        display: 'flex', flexDirection: 'column', gap: 10, 
        transition: 'right 0.4s cubic-bezier(0.16, 1, 0.3, 1)' 
      }}>
        <button onClick={() => { if(is3D){ fgRef.current?.cameraPosition({ x:0, y:0, z:800 }, { x:0, y:0, z:0 }, 1000); } else { fgRef.current?.zoomToFit(1000); } }} style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '50%', color: '#94a3b8', cursor: 'pointer', display: 'flex' }} title="Reset View">
          <Maximize size={18} />
        </button>
        <button onClick={() => { if(is3D){ const pos = fgRef.current?.cameraPosition(); fgRef.current?.cameraPosition({ x: pos.x*0.6, y: pos.y*0.6, z: pos.z*0.6 }, pos.lookAt, 400); } else { fgRef.current?.zoom(fgRef.current.zoom() * 1.5, 400); } }} style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '50%', color: '#94a3b8', cursor: 'pointer', display: 'flex' }} title="Zoom In">
          <ZoomIn size={18} />
        </button>
        <button onClick={() => { if(is3D){ const pos = fgRef.current?.cameraPosition(); fgRef.current?.cameraPosition({ x: pos.x*1.5, y: pos.y*1.5, z: pos.z*1.5 }, pos.lookAt, 400); } else { fgRef.current?.zoom(fgRef.current.zoom() / 1.5, 400); } }} style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '50%', color: '#94a3b8', cursor: 'pointer', display: 'flex' }} title="Zoom Out">
          <ZoomOut size={18} />
        </button>
        <button onClick={() => setIs3D(!is3D)} style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.5)', padding: '12px', borderRadius: '50%', color: '#60a5fa', cursor: 'pointer', display: 'flex' }} title={is3D ? "Switch to 2D" : "Switch to 3D"}>
          <Layers size={18} />
        </button>
        <button onClick={loadData} style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.5)', padding: '12px', borderRadius: '50%', color: '#34d399', cursor: 'pointer', display: 'flex' }} title="Sync / Refresh Data">
          <RefreshCw size={18} />
        </button>
      </div>

      <GraphComponent
        ref={fgRef}
        graphData={filteredData}
        nodeLabel={(node: any) => {
          const badgeColor = node.sourceDb === 'global' ? '#f59e0b' : (node.isActive ? '#10b981' : '#6b7280');
          const typeLabel = node.sourceDb === 'global' ? 'Global Node' : 'Local Node';
          return `
            <div class="custom-tooltip">
              <div class="tooltip-badge" style="color: ${badgeColor}; border-color: ${badgeColor}40; background: ${badgeColor}15;">
                <span class="tooltip-dot" style="background: ${badgeColor};"></span>
                ${typeLabel}
              </div>
              <div class="tooltip-title">${node.name}</div>
            </div>
          `;
        }}
        linkWidth={1.5}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={4}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleSpeed={0.005}
        linkColor={() => 'rgba(255,255,255,0.1)'}
        onNodeClick={handleNodeClick}
        onBackgroundClick={() => setSelectedNode(null)}
        nodeThreeObject={is3D ? (node: any) => {
          const opacity = (!searchQuery || node._highlighted) ? 1 : 0.15;
          const isGlobal = node.sourceDb === 'global';
          const colorHex = isGlobal ? 0xf59e0b : (node.isActive ? 0x10b981 : 0x6b7280);
          
          const radius = Math.cbrt(node.val) * 4;
          const geometry = new THREE.SphereGeometry(radius, 32, 32); 
          const material = new THREE.MeshPhysicalMaterial({ 
            color: colorHex, 
            transparent: true, 
            opacity: opacity,
            transmission: 0.2,
            roughness: 0.1,
            metalness: 0.1,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            emissive: colorHex,
            emissiveIntensity: 0.3
          });
          return new THREE.Mesh(geometry, material);
        } : undefined}
        nodeCanvasObject={!is3D ? (node: any, ctx: any) => {
          const opacity = (!searchQuery || node._highlighted) ? 1 : 0.15;
          const isGlobal = node.sourceDb === 'global';
          const colorStr = isGlobal 
            ? `rgba(245, 158, 11, ${opacity})` 
            : (node.isActive ? `rgba(16, 185, 129, ${opacity})` : `rgba(107, 114, 128, ${opacity})`);
            
          const radius = Math.cbrt(node.val) * 6;

          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = colorStr;
          ctx.fill();

          // Draw Icon
          const fontSize = radius * 1.2;
          ctx.font = `${fontSize}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.9})`;
          ctx.fillText(isGlobal ? '🌍' : '🏠', node.x, node.y);
        } : undefined}
      />
    </div>
  );
}

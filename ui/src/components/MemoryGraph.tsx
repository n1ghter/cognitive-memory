import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import ForceGraph2D from 'react-force-graph-2d';
import SpriteText from 'three-spritetext';
import { Layers, Search, X, Database, Hash } from 'lucide-react';

interface GraphData {
  nodes: any[];
  links: any[];
}

export default function MemoryGraph() {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [is3D, setIs3D] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const fgRef = useRef<any>(null);

  useEffect(() => {
    fetch('/api/graph')
      .then(res => res.json())
      .then(data => {
        setData(data);
      })
      .catch(err => console.error("Failed to load graph data", err));
  }, []);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    // Aim at node from outside it
    const distance = 40;
    const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);

    if (fgRef.current && is3D) {
      fgRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new position
        node, // lookAt ({ x, y, z })
        3000  // ms transition duration
      );
    } else if (fgRef.current && !is3D) {
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(8, 2000);
    }
  }, [is3D]);

  const GraphComponent = is3D ? ForceGraph3D : ForceGraph2D as any;

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    
    const lowerQuery = searchQuery.toLowerCase();
    const filteredNodes = data.nodes.map(n => ({
      ...n,
      _highlighted: n.fullText?.toLowerCase().includes(lowerQuery) || n.name?.toLowerCase().includes(lowerQuery)
    }));
    
    return {
      nodes: filteredNodes,
      links: data.links
    };
  }, [data, searchQuery]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#0b0f19' }}>
      
      {/* Top Header & Search */}
      <div style={{ position: 'absolute', top: 20, left: 20, right: 20, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
        
        <div style={{ background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(10px)', padding: '12px 24px', borderRadius: 12, color: 'white', display: 'flex', alignItems: 'center', gap: 15, pointerEvents: 'auto', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Cognitive Memory</h2>
          <button 
            onClick={() => setIs3D(!is3D)}
            style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.5)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.85rem', transition: 'all 0.2s' }}
          >
            <Layers size={14} />
            {is3D ? 'Switch to 2D' : 'Switch to 3D'}
          </button>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(10px)', padding: '8px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'auto', border: '1px solid rgba(255,255,255,0.1)', width: '300px' }}>
          <Search size={16} color="#94a3b8" />
          <input 
            type="text" 
            placeholder="Search memories..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', width: '100%', fontSize: '0.95rem' }}
          />
          {searchQuery && <X size={16} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />}
        </div>
      </div>

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
      <div style={{
        position: 'absolute', right: selectedNode ? '20px' : '-400px', top: '90px', bottom: '20px', width: '350px',
        background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(20px)', borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', zIndex: 20,
        transition: 'right 0.3s cubic-bezier(0.16, 1, 0.3, 1)', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', color: 'white', padding: '20px'
      }}>
        {selectedNode && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px', marginBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: selectedNode.isActive ? '#10b981' : '#6b7280' }} />
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Memory Node</span>
              </div>
              <button onClick={() => setSelectedNode(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '5px' }}>
              <p style={{ fontSize: '1.1rem', lineHeight: '1.6', margin: '0 0 20px 0', fontWeight: 400 }}>
                {selectedNode.fullText || selectedNode.name}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', color: '#cbd5e1' }}>
                  <Hash size={14} color="#64748b" />
                  <span style={{ color: '#64748b', width: '80px' }}>ID</span>
                  <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{selectedNode.id?.split('-')[0]}...</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', color: '#cbd5e1' }}>
                  <Database size={14} color="#64748b" />
                  <span style={{ color: '#64748b', width: '80px' }}>Importance</span>
                  <span>{(selectedNode.val / 10).toFixed(2)}</span>
                </div>
              </div>

              {selectedNode.metadata && (
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Metadata</h4>
                  <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', fontSize: '0.8rem', color: '#a7f3d0', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                    {typeof selectedNode.metadata === 'string' ? (
                      (() => { try { return JSON.stringify(JSON.parse(selectedNode.metadata), null, 2) } catch { return selectedNode.metadata } })()
                    ) : JSON.stringify(selectedNode.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <GraphComponent
        ref={fgRef}
        graphData={filteredData}
        nodeLabel={is3D ? undefined : "name"}
        nodeAutoColorBy="isActive"
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.005}
        onNodeClick={handleNodeClick}
        onBackgroundClick={() => setSelectedNode(null)}
        nodeThreeObject={is3D ? (node: any) => {
          const opacity = (!searchQuery || node._highlighted) ? 1 : 0.15;
          const bgOpacity = opacity === 1 ? 0.8 : 0.1;

          const sprite = new SpriteText(node.fullText || node.name);
          sprite.color = node.isActive ? `rgba(16, 185, 129, ${opacity})` : `rgba(107, 114, 128, ${opacity})`;
          sprite.textHeight = 4;
          sprite.padding = [4, 6] as any;
          sprite.backgroundColor = `rgba(15, 23, 42, ${bgOpacity})`;
          sprite.borderRadius = 4;
          sprite.borderColor = node.isActive ? `rgba(16, 185, 129, ${opacity * 0.5})` : `rgba(107, 114, 128, ${opacity * 0.5})`;
          sprite.borderWidth = 0.5;
          
          sprite.text = (node.fullText || node.name).replace(/(.{1,40})(\s+|$)/g, "$1\n").trim();
          
          return sprite;
        } : undefined}
        nodeCanvasObject={!is3D ? (node: any, ctx: any, globalScale: number) => {
          const label = node.name;
          const fontSize = 12/globalScale;
          const opacity = (!searchQuery || node._highlighted) ? 1 : 0.15;
          
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.8);

          ctx.fillStyle = `rgba(15, 23, 42, ${opacity === 1 ? 0.8 : 0.2})`;
          ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = node.isActive ? `rgba(16, 185, 129, ${opacity})` : `rgba(107, 114, 128, ${opacity})`;
          ctx.fillText(label, node.x, node.y);

          node.__bckgDimensions = bckgDimensions;
        } : undefined}
      />
    </div>
  );
}

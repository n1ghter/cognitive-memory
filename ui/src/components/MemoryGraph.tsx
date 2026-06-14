import { useState, useEffect, useRef, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import ForceGraph2D from 'react-force-graph-2d';
import * as THREE from 'three';
import { Layers } from 'lucide-react';

interface GraphData {
  nodes: any[];
  links: any[];
}

export default function MemoryGraph() {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [is3D, setIs3D] = useState(true);
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
    // Aim at node from outside it
    const distance = 40;
    const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);

    if (fgRef.current && is3D) {
      fgRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new position
        node, // lookAt ({ x, y, z })
        3000  // ms transition duration
      );
    }
  }, [fgRef, is3D]);

  const GraphComponent = is3D ? ForceGraph3D : ForceGraph2D;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, background: 'rgba(0,0,0,0.7)', padding: '10px 20px', borderRadius: 8, color: 'white', display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2>Cognitive Memory Graph</h2>
        <button 
          onClick={() => setIs3D(!is3D)}
          style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <Layers size={16} />
          Toggle {is3D ? '2D' : '3D'}
        </button>
      </div>

      {data.nodes.length === 0 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: '40px 50px',
          borderRadius: '24px',
          color: 'rgba(255, 255, 255, 0.8)',
          textAlign: 'center',
          maxWidth: '550px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          zIndex: 5
        }}>
          <h3 style={{ marginTop: 0, fontSize: '1.8rem', color: 'white', fontWeight: 600, letterSpacing: '-0.02em' }}>🧠 Пустой разум</h3>
          <p style={{ lineHeight: '1.6', fontSize: '1.1rem', marginBottom: 0 }}>
            Ваш граф памяти пока пуст. Начните общаться с AI-ассистентом или запустите синхронизацию с Obsidian!
          </p>
        </div>
      )}

      <GraphComponent
        ref={fgRef}
        graphData={data}
        nodeLabel="name"
        nodeAutoColorBy="isActive"
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        onNodeClick={handleNodeClick}
        nodeThreeObject={is3D ? (node: any) => {
          const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({ color: node.isActive ? '#10b981' : '#6b7280' })
          );
          sprite.scale.set(node.val, node.val, 1);
          return sprite;
        } : undefined}
      />
    </div>
  );
}

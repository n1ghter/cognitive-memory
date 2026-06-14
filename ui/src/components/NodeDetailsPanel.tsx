import { Check, Copy, Database, Hash, X } from 'lucide-react';
import { useState } from 'react';

interface NodeDetailsPanelProps {
  selectedNode: any;
  onClose: () => void;
  links: any[];
  allNodes: any[];
  onNavigateToNode: (node: any) => void;
}

export default function NodeDetailsPanel({
  selectedNode,
  onClose,
  links,
  allNodes,
  onNavigateToNode,
}: NodeDetailsPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className={`node-details-panel ${selectedNode ? 'open' : 'closed'}`}>
      {selectedNode && (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background:
                    selectedNode.sourceDb === 'global'
                      ? '#f59e0b'
                      : selectedNode.isActive
                        ? '#10b981'
                        : '#6b7280',
                  boxShadow: `0 0 10px ${selectedNode.sourceDb === 'global' ? '#f59e0b' : selectedNode.isActive ? '#10b981' : '#6b7280'}`,
                }}
              />
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 600,
                }}
              >
                {selectedNode.sourceDb === 'global' ? 'Global Node' : 'Local Node'}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                color: '#cbd5e1',
                cursor: 'pointer',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
              onFocus={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
              onBlur={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          <div
            style={{
              overflowY: 'auto',
              flex: 1,
              paddingRight: '5px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '10px',
              }}
            >
              <p
                style={{
                  fontSize: '1.05rem',
                  lineHeight: '1.6',
                  margin: '0',
                  fontWeight: 400,
                  color: '#f8fafc',
                }}
              >
                {selectedNode.fullText || selectedNode.name}
              </p>
              <button
                type="button"
                onClick={() => handleCopy(selectedNode.fullText || selectedNode.name, 'text')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: copiedId === 'text' ? '#10b981' : '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  marginTop: '4px',
                }}
                title="Copy text"
              >
                {copiedId === 'text' ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                background: 'rgba(0, 0, 0, 0.2)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.03)',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.85rem' }}
                >
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      padding: 6,
                      borderRadius: 6,
                    }}
                  >
                    <Hash size={14} stroke="#94a3b8" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span
                      style={{
                        color: '#64748b',
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      ID
                    </span>
                    <span style={{ fontFamily: 'monospace', color: '#e2e8f0' }}>
                      {selectedNode.id.substring(0, 8)}...
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(selectedNode.id, 'id')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: copiedId === 'id' ? '#10b981' : '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                  }}
                  title="Copy ID"
                >
                  {copiedId === 'id' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.85rem' }}>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    padding: '6px',
                    borderRadius: '6px',
                  }}
                >
                  <Database size={14} color="#94a3b8" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span
                    style={{
                      color: '#64748b',
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Importance
                  </span>
                  <span style={{ color: '#e2e8f0', fontWeight: 500 }}>
                    {(selectedNode.val / 10).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {selectedNode.metadata && (
              <div>
                <h4
                  style={{
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginBottom: '12px',
                    fontWeight: 600,
                  }}
                >
                  Metadata
                </h4>
                <pre
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.03)',
                    fontSize: '0.8rem',
                    color: '#34d399',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    margin: 0,
                  }}
                >
                  {typeof selectedNode.metadata === 'string'
                    ? (() => {
                        try {
                          return JSON.stringify(JSON.parse(selectedNode.metadata), null, 2);
                        } catch {
                          return selectedNode.metadata;
                        }
                      })()
                    : JSON.stringify(selectedNode.metadata, null, 2)}
                </pre>
              </div>
            )}

            {/* Connected Memories */}
            <div style={{ marginTop: 'auto', paddingBottom: '10px' }}>
              <h4
                style={{
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: '12px',
                  fontWeight: 600,
                }}
              >
                Connected Memories
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(() => {
                  const connectedEdges = links.filter(
                    (link) =>
                      link.source.id === selectedNode.id ||
                      link.target.id === selectedNode.id ||
                      link.source === selectedNode.id ||
                      link.target === selectedNode.id
                  );
                  if (connectedEdges.length === 0) {
                    return (
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>No connections.</span>
                    );
                  }

                  // Map to the other node
                  const connectedNodes = connectedEdges
                    .map((link) => {
                      const sourceId =
                        typeof link.source === 'object' ? link.source.id : link.source;
                      const targetId =
                        typeof link.target === 'object' ? link.target.id : link.target;
                      const otherId = sourceId === selectedNode.id ? targetId : sourceId;
                      return allNodes.find((n) => n.id === otherId);
                    })
                    .filter(Boolean);

                  return connectedNodes.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => onNavigateToNode(node)}
                      style={{
                        background: 'rgba(59, 130, 246, 0.15)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        color: '#93c5fd',
                        padding: '6px 12px',
                        borderRadius: '100px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      /* v8 ignore start */
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)';
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                      }}
                      /* v8 ignore stop */
                    >
                      {node.name || node.fullText || node.id.substring(0, 8)}
                    </button>
                  ));
                })()}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

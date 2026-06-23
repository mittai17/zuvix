import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Line, Stars, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import type { AgentNode } from '../store/agentStore';

/* ─── Types & Constants ─── */
interface MapAgent {
  id: string;
  name: string;
  color: string;
  status: 'idle' | 'busy' | 'thinking' | 'success' | 'error';
  buildingId: string;
  targetBuildingId: string | null;
  x: number;
  y: number;
  targetX: number | null;
  targetY: number | null;
  progress: number;
}

interface Building {
  id: string;
  name: string;
  x: number;
  y: number;
  icon: string;
  color: string;
  description: string;
}

// 2D grid coordinates (0-800, 0-700)
const BUILDINGS: Building[] = [
  { id: 'comm-center',     name: 'Comm Center',     x: 120, y: 60,  icon: '📡', color: '#3b82f6', description: 'Agent coordination' },
  { id: 'shop',            name: 'Tool Shop',       x: 120, y: 250, icon: '🛒', color: '#f59e0b', description: 'Download tools' },
  { id: 'rel-house',       name: 'Relative House',  x: 120, y: 440, icon: '🏡', color: '#10b981', description: 'Related agent hub' },
  { id: 'home-base',       name: 'Home Base',       x: 400, y: 60,  icon: '🏠', color: '#8b5cf6', description: 'Main operations' },
  { id: 'friends',         name: 'Friends Hub',     x: 400, y: 250, icon: '👥', color: '#ec4899', description: 'Nearby agents' },
  { id: 'hospital',        name: 'Hospital',        x: 400, y: 440, icon: '🏥', color: '#ef4444', description: 'System repair' },
  { id: 'police',          name: 'Police Station',   x: 400, y: 620, icon: '🚔', color: '#1e40af', description: 'Security enforcement' },
  { id: 'research',        name: 'Research Center', x: 680, y: 60,  icon: '🔬', color: '#8b5cf6', description: 'Agent training' },
  { id: 'ext-shop',        name: 'External Shop',   x: 680, y: 250, icon: '🌐', color: '#14b8a6', description: 'External marketplace' },
  { id: 'data-center',     name: 'Data Center',     x: 680, y: 440, icon: '💾', color: '#6366f1', description: 'Memory management' },
  { id: 'security',        name: 'Security Center', x: 680, y: 620, icon: '🔒', color: '#dc2626', description: 'Security monitoring' },
];

const PATHS: [string, string][] = [
  ['comm-center', 'home-base'], ['home-base', 'research'],
  ['shop', 'friends'], ['friends', 'ext-shop'],
  ['rel-house', 'hospital'], ['hospital', 'data-center'],
  ['hospital', 'police'], ['police', 'security'],
  ['comm-center', 'shop'], ['home-base', 'friends'], ['research', 'ext-shop'],
  ['shop', 'rel-house'], ['friends', 'hospital'], ['ext-shop', 'data-center'],
  ['police', 'security'],
  ['comm-center', 'friends'], ['home-base', 'shop'], ['home-base', 'ext-shop'],
  ['research', 'friends'], ['rel-house', 'friends'], ['data-center', 'security'],
];

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f97316', '#84cc16', '#06b6d4', '#a855f7', '#e11d48',
];

const buildingMap = new Map(BUILDINGS.map(b => [b.id, b]));

// Coordinate converter: Map 2D to 3D space
const to3D = (x: number, y: number): [number, number, number] => {
  return [(x / 100) - 4, 0, (y / 100) - 3.5];
};

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/* ─── Agent Simulation Hook ─── */
function useAgentSimulation(agents: AgentNode[]) {
  const [mapAgents, setMapAgents] = useState<MapAgent[]>([]);

  useEffect(() => {
    const initial = agents.map((a, i) => {
      const bIds = BUILDINGS.map(b => b.id);
      const startB = bIds[i % bIds.length];
      const b = buildingMap.get(startB)!;
      return {
        id: a.id, name: a.name, color: COLORS[i % COLORS.length],
        status: a.status, buildingId: startB, targetBuildingId: null,
        x: b.x, y: b.y, targetX: null, targetY: null, progress: 1,
      };
    });
    setMapAgents(initial);
  }, [agents]);

  useEffect(() => {
    setMapAgents(prev => prev.map(ma => {
      const prop = agents.find(a => a.id === ma.id);
      return prop ? { ...ma, status: prop.status } : ma;
    }));
  }, [agents]);

  useEffect(() => {
    const int = setInterval(() => {
      setMapAgents(prev => {
        const next = [...prev];
        const idle = next.filter(a => a.targetBuildingId === null);
        if (!idle.length) return prev;
        const chosen = idle[Math.floor(Math.random() * idle.length)];
        const others = BUILDINGS.filter(b => b.id !== chosen.buildingId);
        if (!others.length) return prev;
        const target = others[Math.floor(Math.random() * others.length)];
        const idx = next.findIndex(a => a.id === chosen.id);
        next[idx] = {
          ...chosen, targetBuildingId: target.id, targetX: target.x, targetY: target.y, progress: 0,
        };
        return next;
      });
    }, 4000);
    return () => clearInterval(int);
  }, []);

  useFrame((_, delta) => {
    setMapAgents(prev => {
      let changed = false;
      const next = prev.map(ma => {
        if (ma.targetX === null || ma.targetY === null) return ma;
        const newProgress = ma.progress + delta * 0.4;
        changed = true;
        if (newProgress >= 1) {
          return { ...ma, x: ma.targetX, y: ma.targetY, buildingId: ma.targetBuildingId!, targetBuildingId: null, targetX: null, targetY: null, progress: 1 };
        }
        return { ...ma, progress: newProgress };
      });
      return changed ? next : prev;
    });
  });

  return mapAgents;
}

/* ─── 3D Components ─── */

const AmongUs3D: React.FC<{ agent: MapAgent; isSelected: boolean }> = ({ agent, isSelected }) => {
  const group = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const visor = useRef<THREE.Mesh>(null);

  // Calculate position
  let [px, , pz] = to3D(agent.x, agent.y);
  let targetAngle = 0;

  if (agent.targetX !== null && agent.targetY !== null && agent.progress < 1) {
    const startB = buildingMap.get(agent.buildingId)!;
    const t = easeInOut(agent.progress);
    const currX = startB.x + (agent.targetX - startB.x) * t;
    const currY = startB.y + (agent.targetY - startB.y) * t;
    [px, , pz] = to3D(currX, currY);
    targetAngle = Math.atan2(agent.targetX - startB.x, agent.targetY - startB.y);
  }

  useFrame((state) => {
    if (!group.current) return;
    
    // Smooth rotation towards target
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetAngle, 0.1);

    const isWalking = agent.targetBuildingId !== null;
    const isThinking = agent.status === 'thinking';
    const time = state.clock.getElapsedTime();

    if (isWalking) {
      // Bobbing
      group.current.position.y = Math.sin(time * 15) * 0.05 + 0.35;
      // Leg swing
      if (leftLeg.current) leftLeg.current.rotation.x = Math.sin(time * 15) * 0.5;
      if (rightLeg.current) rightLeg.current.rotation.x = Math.sin(time * 15 + Math.PI) * 0.5;
    } else {
      group.current.position.y = Math.sin(time * 3) * 0.02 + 0.35;
      if (leftLeg.current) leftLeg.current.rotation.x = 0;
      if (rightLeg.current) rightLeg.current.rotation.x = 0;
    }

    if (isThinking && visor.current) {
      const mat = visor.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = Math.abs(Math.sin(time * 4)) * 0.8;
    } else if (visor.current) {
      (visor.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
    }
  });

  return (
    <group position={[px, 0.35, pz]} ref={group}>
      {/* HTML Label */}
      <Html position={[0, 0.8, 0]} center zIndexRange={[100, 0]}>
        <div style={{
          background: isSelected ? 'rgba(59,130,246,0.8)' : 'rgba(0,0,0,0.6)',
          border: `1px solid ${agent.color}`,
          color: 'white', padding: '2px 6px', borderRadius: '4px',
          fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap',
          pointerEvents: 'none'
        }}>
          {agent.name}
        </div>
      </Html>

      {/* Selected Indicator */}
      {isSelected && (
        <mesh position={[0, -0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.4, 0.5, 32]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Body */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <capsuleGeometry args={[0.22, 0.3, 16, 16]} />
        <meshStandardMaterial color={agent.color} roughness={0.3} />
      </mesh>

      {/* Visor */}
      <mesh ref={visor} position={[0, 0.15, 0.18]} castShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#aaddff" roughness={0.1} emissive="#aaddff" emissiveIntensity={0} />
      </mesh>

      {/* Backpack */}
      <mesh position={[0, 0.05, -0.2]} castShadow>
        <boxGeometry args={[0.3, 0.4, 0.15]} />
        <meshStandardMaterial color={agent.color} roughness={0.4} />
      </mesh>

      {/* Left Leg */}
      <group position={[-0.1, -0.15, 0]} ref={leftLeg}>
        <mesh position={[0, -0.15, 0]} castShadow>
          <boxGeometry args={[0.15, 0.25, 0.15]} />
          <meshStandardMaterial color={agent.color} roughness={0.3} />
        </mesh>
      </group>

      {/* Right Leg */}
      <group position={[0.1, -0.15, 0]} ref={rightLeg}>
        <mesh position={[0, -0.15, 0]} castShadow>
          <boxGeometry args={[0.15, 0.25, 0.15]} />
          <meshStandardMaterial color={agent.color} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
};

const Building3D: React.FC<{ b: Building }> = ({ b }) => {
  const [hovered, setHovered] = useState(false);
  const [px, , pz] = to3D(b.x, b.y);

  return (
    <group position={[px, 0, pz]} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      <Html position={[0, 0.8, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          transition: 'transform 0.2s', transform: hovered ? 'scale(1.2)' : 'scale(1)'
        }}>
          <div style={{ fontSize: '24px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>{b.icon}</div>
          <div style={{
            background: 'rgba(0,0,0,0.7)', color: b.color, padding: '2px 6px',
            borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', marginTop: '4px',
            border: `1px solid ${b.color}44`, whiteSpace: 'nowrap'
          }}>
            {b.name}
          </div>
          {hovered && (
            <div style={{
              background: '#1a1a2e', color: '#94a3b8', fontSize: '9px',
              padding: '4px 8px', borderRadius: '4px', marginTop: '4px',
              border: `1px solid rgba(255,255,255,0.1)`, whiteSpace: 'nowrap'
            }}>
              {b.description}
            </div>
          )}
        </div>
      </Html>

      {/* Building Base Pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[0.6, 32]} />
        <meshStandardMaterial color={b.color} opacity={0.2} transparent />
      </mesh>

      {/* Building Structure */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.6, 0.8]} />
        <meshStandardMaterial color="#1e1e2e" roughness={0.8} />
      </mesh>
      
      {/* Glowing roof edge */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.85, 0.05, 0.85]} />
        <meshStandardMaterial color={b.color} emissive={b.color} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
};

const MapPaths: React.FC<{ mapAgents: MapAgent[] }> = ({ mapAgents }) => {
  return (
    <>
      {PATHS.map(([fromId, toId], i) => {
        const from = buildingMap.get(fromId)!;
        const to = buildingMap.get(toId)!;
        const [x1, , z1] = to3D(from.x, from.y);
        const [x2, , z2] = to3D(to.x, to.y);

        const isActive = mapAgents.some(a => 
          (a.buildingId === fromId && a.targetBuildingId === toId) ||
          (a.buildingId === toId && a.targetBuildingId === fromId)
        );

        return (
          <Line
            key={i}
            points={[[x1, 0.02, z1], [x2, 0.02, z2]]}
            color={isActive ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}
            lineWidth={isActive ? 3 : 1}
            dashed={!isActive}
            dashSize={0.2}
            gapSize={0.2}
          />
        );
      })}
    </>
  );
};

/* ─── Main Scene Component ─── */
const Scene: React.FC<{ agents: AgentNode[]; selectedAgentId?: string | null }> = ({ agents, selectedAgentId }) => {
  const mapAgents = useAgentSimulation(agents);

  return (
    <>
      <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2.1} minDistance={3} maxDistance={15} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 15, 10]} intensity={1} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 5, 0]} intensity={0.5} color="#8b5cf6" />
      <Environment preset="city" />
      <Stars radius={50} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />

      {/* Grid Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#0a0a14" roughness={0.8} />
      </mesh>
      <gridHelper args={[20, 20, '#333344', '#11111a']} position={[0, 0.01, 0]} />
      
      <ContactShadows position={[0, 0.02, 0]} opacity={0.4} scale={20} blur={2} far={2} />

      {/* Buildings */}
      {BUILDINGS.map(b => <Building3D key={b.id} b={b} />)}

      {/* Paths */}
      <MapPaths mapAgents={mapAgents} />

      {/* Agents */}
      {mapAgents.map(ma => (
        <AmongUs3D key={ma.id} agent={ma} isSelected={ma.id === selectedAgentId} />
      ))}
    </>
  );
};

/* ─── Export Wrapper ─── */
interface Props {
  agents: AgentNode[];
  onAgentClick?: (agent: AgentNode) => void;
  selectedAgentId?: string | null;
  onStatusChange?: (agentId: string, status: string) => void;
}

export const AgentWorldMap: React.FC<Props> = ({ agents, selectedAgentId }) => {
  return (
    <div style={{ width: '100%', height: '100%', background: '#05050a', borderRadius: '14px', overflow: 'hidden' }}>
      <Canvas shadows camera={{ position: [0, 6, 8], fov: 45 }}>
        <Scene agents={agents} selectedAgentId={selectedAgentId} />
      </Canvas>
    </div>
  );
};

export default AgentWorldMap;

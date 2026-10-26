import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { KnowledgeRelationship, KnowledgeRelationshipType } from "../../types/knowledge";
import type { Note } from "../../types/note";
import type { Page, Document, Transcript, Recording, LifeMemory } from "../../types/knowledge";

export interface KnowledgeGraphNode {
  id: ID;
  type: "note" | "page" | "document" | "journal_entry" | "transcript" | "recording" | "life_memory";
  title: string;
  tags: string[];
}

export interface KnowledgeGraphEdge {
  source: ID;
  target: ID;
  type: KnowledgeRelationshipType;
  confidence: number;
}

export interface KnowledgeGraph {
  nodes: Map<ID, KnowledgeGraphNode>;
  edges: KnowledgeGraphEdge[];
  adjacency: Map<ID, Set<ID>>;
  reverseAdjacency: Map<ID, Set<ID>>;
}

export function buildKnowledgeGraph(state: AppState): KnowledgeGraph {
  const nodes = new Map<ID, KnowledgeGraphNode>();
  const edges: KnowledgeGraphEdge[] = [];
  const adjacency = new Map<ID, Set<ID>>();
  const reverseAdjacency = new Map<ID, Set<ID>>();

  const addNode = (item: any, type: KnowledgeGraphNode["type"]) => {
    if (!item) return;
    nodes.set(item.id, {
      id: item.id,
      type,
      title: item.title,
      tags: item.tags ?? [],
    });
    if (!adjacency.has(item.id)) adjacency.set(item.id, new Set());
    if (!reverseAdjacency.has(item.id)) reverseAdjacency.set(item.id, new Set());
  };

  for (const note of Object.values(state.notes)) if (note.status === "active") addNode(note, "note");
  for (const page of Object.values(state.pages)) if (page.status === "active") addNode(page, "page");
  for (const doc of Object.values(state.documents)) if (doc.status === "ready") addNode(doc, "document");
  for (const entry of Object.values(state.journalEntries)) if (entry.status !== "trashed") addNode(entry, "journal_entry");
  for (const transcript of Object.values(state.transcripts)) if (transcript.status === "ready") addNode(transcript, "transcript");
  for (const rec of Object.values(state.recordings)) if (rec.status === "ready") addNode(rec, "recording");
  for (const memory of Object.values(state.lifeMemories)) if (memory.status === "active") addNode(memory, "life_memory");

  for (const rel of Object.values(state.knowledgeRelationships)) {
    if (nodes.has(rel.sourceId) && nodes.has(rel.targetId)) {
      edges.push({
        source: rel.sourceId,
        target: rel.targetId,
        type: rel.relationshipType,
        confidence: rel.confidence,
      });
      const adj = adjacency.get(rel.sourceId) ?? new Set();
      adj.add(rel.targetId);
      adjacency.set(rel.sourceId, adj);

      const revAdj = reverseAdjacency.get(rel.targetId) ?? new Set();
      revAdj.add(rel.sourceId);
      reverseAdjacency.set(rel.targetId, revAdj);
    }
  }

  return { nodes, edges, adjacency, reverseAdjacency };
}

export function getOutgoingRelationships(
  graph: KnowledgeGraph,
  nodeId: ID,
  types?: KnowledgeRelationshipType[],
): KnowledgeGraphEdge[] {
  const edges: KnowledgeGraphEdge[] = [];
  for (const edge of graph.edges) {
    if (edge.source === nodeId && (!types || types.includes(edge.type))) {
      edges.push(edge);
    }
  }
  return edges;
}

export function getIncomingRelationships(
  graph: KnowledgeGraph,
  nodeId: ID,
  types?: KnowledgeRelationshipType[],
): KnowledgeGraphEdge[] {
  const edges: KnowledgeGraphEdge[] = [];
  for (const edge of graph.edges) {
    if (edge.target === nodeId && (!types || types.includes(edge.type))) {
      edges.push(edge);
    }
  }
  return edges;
}

export function getRelatedNodes(
  graph: KnowledgeGraph,
  nodeId: ID,
  maxDepth = 2,
  relationshipTypes?: KnowledgeRelationshipType[],
): Map<ID, { node: KnowledgeGraphNode; distance: number; path: KnowledgeGraphEdge[] }> {
  const visited = new Map<ID, { node: KnowledgeGraphNode; distance: number; path: KnowledgeGraphEdge[] }>();
  const queue: Array<{ id: ID; distance: number; path: KnowledgeGraphEdge[] }> = [{ id: nodeId, distance: 0, path: [] }];

  while (queue.length > 0) {
    const { id, distance, path } = queue.shift()!;
    if (distance > maxDepth) continue;
    if (visited.has(id) && visited.get(id)!.distance <= distance) continue;

    const node = graph.nodes.get(id);
    if (node) visited.set(id, { node, distance, path });

    if (distance === maxDepth) continue;

    const outgoing = getOutgoingRelationships(graph, id, relationshipTypes);
    for (const edge of outgoing) {
      if (!visited.has(edge.target) || visited.get(edge.target)!.distance > distance + 1) {
        queue.push({ id: edge.target, distance: distance + 1, path: [...path, edge] });
      }
    }
  }

  return visited;
}

export function findShortestPath(
  graph: KnowledgeGraph,
  sourceId: ID,
  targetId: ID,
  relationshipTypes?: KnowledgeRelationshipType[],
): KnowledgeGraphEdge[] | null {
  const queue: Array<{ id: ID; path: KnowledgeGraphEdge[] }> = [{ id: sourceId, path: [] }];
  const visited = new Set<ID>();

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    if (id === targetId) return path;
    if (visited.has(id)) continue;
    visited.add(id);

    const outgoing = getOutgoingRelationships(graph, id, relationshipTypes);
    for (const edge of outgoing) {
      if (!visited.has(edge.target)) {
        queue.push({ id: edge.target, path: [...path, edge] });
      }
    }
  }

  return null;
}

export function getClusterCoefficient(graph: KnowledgeGraph, nodeId: ID): number {
  const neighbors = new Set<ID>();
  for (const edge of graph.edges) {
    if (edge.source === nodeId) neighbors.add(edge.target);
    if (edge.target === nodeId) neighbors.add(edge.source);
  }

  if (neighbors.size < 2) return 0;

  let triangles = 0;
  const neighborArray = Array.from(neighbors);
  for (let i = 0; i < neighborArray.length; i++) {
    for (let j = i + 1; j < neighborArray.length; j++) {
      const connected = graph.edges.some(
        (e) =>
          (e.source === neighborArray[i] && e.target === neighborArray[j]) ||
          (e.source === neighborArray[j] && e.target === neighborArray[i]),
      );
      if (connected) triangles++;
    }
  }

  const possible = (neighbors.size * (neighbors.size - 1)) / 2;
  return triangles / possible;
}

export function getPageRank(
  graph: KnowledgeGraph,
  iterations = 20,
  damping = 0.85,
): Map<ID, number> {
  const nodes = Array.from(graph.nodes.keys());
  const n = nodes.length;
  if (n === 0) return new Map();

  const scores = new Map<ID, number>();
  nodes.forEach((id) => scores.set(id, 1 / n));

  for (let iter = 0; iter < iterations; iter++) {
    const newScores = new Map<ID, number>();
    nodes.forEach((id) => newScores.set(id, (1 - damping) / n));

    for (const edge of graph.edges) {
      const sourceScore = scores.get(edge.source) ?? 0;
      const outDegree = Array.from(graph.adjacency.get(edge.source) ?? []).length;
      if (outDegree > 0) {
        const contribution = (damping * sourceScore) / outDegree;
        newScores.set(edge.target, (newScores.get(edge.target) ?? 0) + contribution);
      }
    }

    scores.forEach((_, id) => scores.set(id, newScores.get(id) ?? 0));
  }

  return scores;
}

export function suggestRelationships(
  state: AppState,
  sourceId: ID,
  sourceType: "note" | "page" | "document" | "journal_entry" | "transcript" | "recording" | "life_memory",
  limit = 10,
): Array<{ targetId: ID; targetType: string; targetTitle: string; suggestedType: KnowledgeRelationshipType; confidence: number; reason: string }> {
  const suggestions: Array<{ targetId: ID; targetType: string; targetTitle: string; suggestedType: KnowledgeRelationshipType; confidence: number; reason: string }> = [];

  const sourceItem = getItemByType(state, sourceType, sourceId);
  if (!sourceItem) return [];

  const sourceTags = new Set(sourceItem.tags ?? []);
  const sourceTitle = sourceItem.title.toLowerCase();

  const checkItem = (item: any, type: string) => {
    if (item.id === sourceId) return;
    const itemTags = new Set(item.tags ?? []);
    const sharedTags = [...sourceTags].filter((t) => itemTags.has(t)).length;
    const titleSimilarity = jaccardSimilarity(sourceTitle, item.title.toLowerCase());

    if (sharedTags > 0) {
      suggestions.push({
        targetId: item.id,
        targetType: type,
        targetTitle: item.title,
        suggestedType: "related_to",
        confidence: Math.min(0.9, sharedTags * 0.2 + titleSimilarity * 0.3),
        reason: `Shares ${sharedTags} tag${sharedTags > 1 ? "s" : ""}`,
      });
    }

    if (titleSimilarity > 0.3) {
      suggestions.push({
        targetId: item.id,
        targetType: type,
        targetTitle: item.title,
        suggestedType: "related_to",
        confidence: Math.min(0.8, titleSimilarity),
        reason: "Similar title",
      });
    }
  };

  for (const note of Object.values(state.notes)) if (note.status === "active") checkItem(note, "note");
  for (const page of Object.values(state.pages)) if (page.status === "active") checkItem(page, "page");
  for (const doc of Object.values(state.documents)) if (doc.status === "ready") checkItem(doc, "document");
  for (const entry of Object.values(state.journalEntries)) if (entry.status !== "trashed") checkItem(entry, "journal_entry");
  for (const transcript of Object.values(state.transcripts)) if (transcript.status === "ready") checkItem(transcript, "transcript");
  for (const rec of Object.values(state.recordings)) if (rec.status === "ready") checkItem(rec, "recording");
  for (const memory of Object.values(state.lifeMemories)) if (memory.status === "active") checkItem(memory, "life_memory");

  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

function getItemByType(state: AppState, type: string, id: ID): any {
  switch (type) {
    case "note": return state.notes[id];
    case "page": return state.pages[id];
    case "document": return state.documents[id];
    case "journal_entry": return state.journalEntries[id];
    case "transcript": return state.transcripts[id];
    case "recording": return state.recordings[id];
    case "life_memory": return state.lifeMemories[id];
    default: return null;
  }
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(/\s+/).filter(Boolean));
  const setB = new Set(b.split(/\s+/).filter(Boolean));
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function detectCycles(graph: KnowledgeGraph): ID[][] {
  const visited = new Set<ID>();
  const recStack = new Set<ID>();
  const cycles: ID[][] = [];
  const path: ID[] = [];

  function dfs(nodeId: ID) {
    visited.add(nodeId);
    recStack.add(nodeId);
    path.push(nodeId);

    const neighbors = graph.adjacency.get(nodeId) ?? new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), neighbor]);
        }
      }
    }

    recStack.delete(nodeId);
    path.pop();
    return false;
  }

  for (const nodeId of graph.nodes.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId);
    }
  }

  return cycles;
}

export function getOrphanNodes(graph: KnowledgeGraph): KnowledgeGraphNode[] {
  const orphans: KnowledgeGraphNode[] = [];
  for (const [id, node] of graph.nodes) {
    const hasEdges = (graph.adjacency.get(id)?.size ?? 0) > 0 || (graph.reverseAdjacency.get(id)?.size ?? 0) > 0;
    if (!hasEdges) orphans.push(node);
  }
  return orphans;
}

export function getHubNodes(graph: KnowledgeGraph, limit = 10): Array<{ node: KnowledgeGraphNode; degree: number }> {
  const hubs: Array<{ node: KnowledgeGraphNode; degree: number }> = [];
  for (const [id, node] of graph.nodes) {
    const outDegree = graph.adjacency.get(id)?.size ?? 0;
    const inDegree = graph.reverseAdjacency.get(id)?.size ?? 0;
    hubs.push({ node, degree: outDegree + inDegree });
  }
  return hubs.sort((a, b) => b.degree - a.degree).slice(0, limit);
}
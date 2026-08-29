import blind75Track from "./tracks/blind75.json";
import carl200Track from "./tracks/carl200.json";
import grind75Track from "./tracks/grind75.json";
import neetcode25Track from "./tracks/neetcode25.json";
import neetcode150Track from "./tracks/neetcode150.json";
import topInterview150Track from "./tracks/top-interview-150.json";

export interface TrackProblem {
  id: number;
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topic: string;
}

export interface TrackCategory {
  name: string;
  problems: {
    id: number;
    slug: string;
    title: string;
    difficulty: "Easy" | "Medium" | "Hard";
  }[];
}

export interface TrackManifest {
  id: string;
  name: string;
  description: string;
  author?: string;
  version: string;
  categories: TrackCategory[];
}

export class TrackRegistry {
  private static readonly TRACKS: TrackManifest[] = [
    blind75Track as TrackManifest,
    grind75Track as TrackManifest,
    neetcode25Track as TrackManifest,
    neetcode150Track as TrackManifest,
    topInterview150Track as TrackManifest,
    carl200Track as TrackManifest,
  ];

  static getAllTracks(): TrackManifest[] {
    return TrackRegistry.TRACKS;
  }

  static getTrack(id: string): TrackManifest {
    const found = TrackRegistry.TRACKS.find((t) => t.id === id);
    return found || TrackRegistry.TRACKS[0];
  }

  static getTrackProblems(trackId: string): TrackProblem[] {
    const track = TrackRegistry.getTrack(trackId);
    const result: TrackProblem[] = [];
    for (const cat of track.categories) {
      for (const p of cat.problems) {
        result.push({
          id: p.id,
          slug: p.slug,
          title: p.title,
          difficulty: p.difficulty,
          topic: cat.name,
        });
      }
    }
    return result;
  }

  static getAllUniqueProblems(): TrackProblem[] {
    const map = new Map<string, TrackProblem>();
    for (const track of TrackRegistry.TRACKS) {
      for (const p of TrackRegistry.getTrackProblems(track.id)) {
        if (!map.has(p.slug)) {
          map.set(p.slug, p);
        }
      }
    }
    return Array.from(map.values());
  }

  static findProblem(slugOrId: string | number): TrackProblem | undefined {
    const all = TrackRegistry.getAllUniqueProblems();
    if (typeof slugOrId === "number" || /^\d+$/.test(String(slugOrId))) {
      const num = typeof slugOrId === "number" ? slugOrId : parseInt(slugOrId, 10);
      return all.find((p) => p.id === num);
    }
    return all.find((p) => p.slug === String(slugOrId));
  }
}

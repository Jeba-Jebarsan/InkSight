
export enum AppView {
  LANDING = 'LANDING',
  SIMULATOR = 'SIMULATOR',
  GALLERY = 'GALLERY'
}

export interface TattooSimulation {
  id: string;
  originalImage: string;
  resultImage: string;
  prompt: string;
  style: string;
  boldnessRating: number;
  analysis: string;
  timestamp: number;
}

export interface UserPreferences {
  style: string;
  size: 'Small' | 'Medium' | 'Large' | 'Full Body';
  complexity: number;
}

export interface HealingScan {
  id: string;
  image: string;
  analysis: string;
  status: 'Healthy' | 'Needs Attention' | 'Action Required' | string;
  timestamp: number;
  tips?: string[]; // Inferred from result.tips usage, though not strictly in newScan construction, it might be part of the interface if used elsewhere or intended
}
